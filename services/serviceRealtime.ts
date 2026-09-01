import { supabase } from './supabaseClient';
import { getMessages } from './serviceGroup';
import type { RealtimeChannel } from '@supabase/supabase-js';

/** Το όνομα του broadcast event — ίδιο στον αποστολέα και στον παραλήπτη. */
const TYPING_EVENT = 'typing';

export type ChatHandlers = {
  /** Νέο μήνυμα από τη βάση. */
  onNewMessage: (message: any) => void;
  /** Διόρθωση ή διαγραφή — και τα δύο είναι UPDATE, η διαγραφή είναι soft. */
  onMessageUpdate?: (message: any) => void;
  /** Κάθε αλλαγή κατάστασης του καναλιού, όχι μόνο η πρώτη. */
  onStatus?: (status: string) => void;
  /** Κάποιος άλλος πληκτρολογεί. Ποτέ ο εαυτός μας. */
  onTyping?: (who: { id: string; name: string }) => void;
  /** Πόσοι είναι συνδεδεμένοι στη συνομιλία αυτή τη στιγμή. */
  onPresence?: (online: number) => void;
  /** Μπήκε ή άλλαξε αντίδραση. Η γραμμή, όπως έρχεται από τη βάση. */
  onReaction?: (row: any) => void;
  /** Αφαιρέθηκε αντίδραση. Εδώ έρχεται η ΠΑΛΙΑ γραμμή. */
  onReactionGone?: (row: any) => void;
};

/** Ποιοι είμαστε — το presence θέλει ταυτότητα, το broadcast θέλει όνομα. */
export type Me = { id: string; name: string };

/**
 * Το κανάλι μιας συνομιλίας: μηνύματα από τη βάση, «γράφει…» από τους άλλους
 * πελάτες, και ποιος είναι παρών.
 *
 * ΠΡΟΣΟΧΗ: τα postgres_changes περνάνε από τα RLS policies μας· το broadcast και
 * το presence ΟΧΙ. Με τις προεπιλογές του Supabase, όποιος ξέρει το id μιας
 * Παρέας μπορεί να μπει σε αυτό το κανάλι και να δει ποιος γράφει και ποιος
 * είναι online, χωρίς να είναι μέλος. Το id είναι UUID και δεν μαντεύεται, αλλά
 * το κλείσιμο θέλει Realtime Authorization (RLS πάνω στον realtime.messages).
 */
export function openGroupChat(
  groupId: string,
  me: Me,
  handlers: ChatHandlers,
): RealtimeChannel {
  const filter = `group_id=eq.${groupId}`;

  const channel = supabase.channel('group-' + groupId, {
    config: {
      // Το κλειδί ξεχωρίζει τους παρόντες. Με το user id, δύο συσκευές του ίδιου
      // ανθρώπου μετράνε ως ένας — που είναι και το σωστό για «2 online».
      presence: { key: me.id },
      // Ρητά: δεν θέλουμε να ακούμε το δικό μας «γράφει…».
      broadcast: { self: false },
    },
  });

  channel
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'messages', filter },
      (payload) => handlers.onNewMessage(payload.new),
    )
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'messages', filter },
      (payload) => handlers.onMessageUpdate?.(payload.new),
    )
    // Αντιδράσεις. Το insert και το update είναι το ίδιο πράγμα για την οθόνη —
    // ένα άτομο έχει το πολύ μία, οπότε η αλλαγή emoji είναι update της ίδιας
    // γραμμής και όχι δεύτερη.
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'message_reactions', filter },
      (payload) => handlers.onReaction?.(payload.new),
    )
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'message_reactions', filter },
      (payload) => handlers.onReaction?.(payload.new),
    )
    // Το φίλτρο εδώ δουλεύει μόνο επειδή ο πίνακας έχει replica identity full:
    // αλλιώς η παλιά γραμμή θα είχε μόνο το primary key, χωρίς group_id.
    .on(
      'postgres_changes',
      { event: 'DELETE', schema: 'public', table: 'message_reactions', filter },
      (payload) => handlers.onReactionGone?.(payload.old),
    )
    .on('broadcast', { event: TYPING_EVENT }, function (message) {
      const payload = message.payload as { id?: string; name?: string } | undefined;
      if (!payload?.id || payload.id === me.id) {
        return;
      }
      handlers.onTyping?.({ id: payload.id, name: payload.name ?? '' });
    })
    // Το sync έρχεται και στην αρχή και σε κάθε είσοδο/έξοδο. Δεν χρειαζόμαστε
    // τα join/leave events ξεχωριστά — μας ενδιαφέρει μόνο το πλήθος.
    .on('presence', { event: 'sync' }, function () {
      handlers.onPresence?.(Object.keys(channel.presenceState()).length);
    })
    .subscribe(function (status) {
      handlers.onStatus?.(status);
      // Το track ΠΡΕΠΕΙ να γίνει αφού συνδεθεί το κανάλι. Τρέχει και σε κάθε
      // επανασύνδεση, γιατί ο server έχει ξεχάσει ότι είμαστε εδώ.
      if (status === 'SUBSCRIBED') {
        channel.track({ id: me.id, name: me.name }).catch(function () {
          // Το presence είναι διακόσμηση — μια αποτυχία δεν χαλάει τη συνομιλία.
        });
      }
    });

  return channel;
}

/**
 * Λέει στους άλλους ότι γράφουμε. Δεν περιμένουμε απάντηση και δεν μας νοιάζει
 * αν χαθεί: η επόμενη αποστολή έρχεται σε ενάμισι δευτερόλεπτο.
 */
export function sendTyping(channel: RealtimeChannel, me: Me): void {
  channel
    .send({ type: 'broadcast', event: TYPING_EVENT, payload: { id: me.id, name: me.name } })
    .catch(function () {
      // σιωπηλά
    });
}

export async function closeGroupChat(channel: RealtimeChannel): Promise<void> {
  await supabase.removeChannel(channel);
}

/**
 * Ανοίγει μια συνομιλία: η πρώτη σελίδα ιστορικού και το κανάλι μαζί.
 *
 * Το ιστορικό φορτώνεται ΠΡΙΝ ανοίξει το κανάλι, ώστε ένα μήνυμα που φτάνει
 * ενδιάμεσα να μη χαθεί — στη χειρότερη θα έρθει δύο φορές, και η οθόνη
 * ξεχωρίζει τα διπλά από το id.
 */
export async function startChat(
  groupId: string,
  me: Me,
  handlers: ChatHandlers,
  limit?: number,
) {
  const page = await getMessages(groupId, { limit });
  const channel = openGroupChat(groupId, me, handlers);
  return { messages: page.messages, hasMore: page.hasMore, channel };
}
