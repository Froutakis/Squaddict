import type { ChatMessage } from '../../services/serviceGroup';
import type { OutgoingMessage } from './messageRows';

/**
 * Ανεβάζεται όταν αλλάζει το ΣΧΗΜΑ όσων αποθηκεύουμε. Τα παλιά κλειδιά παύουν
 * να διαβάζονται και η εφαρμογή ξεκινά από το δίκτυο, αντί να προσπαθεί να
 * καταλάβει δεδομένα γραμμένα από άλλη έκδοση.
 */
export const CACHE_VERSION = 1;

/** Πόσα μηνύματα ανά Παρέα κρατάμε τοπικά. */
export const CACHED_MESSAGES = 50;

const PREFIX = 'sq' + CACHE_VERSION + ':';

/** Κάθε κλειδί του συγκεκριμένου λογαριασμού — δύο λογαριασμοί δεν μπλέκουν. */
export function userPrefix(userId: string): string {
  return PREFIX + userId + ':';
}

export function squadsKey(userId: string): string {
  return userPrefix(userId) + 'squads';
}

export function messagesKey(userId: string, groupId: string): string {
  return userPrefix(userId) + 'msg:' + groupId;
}

export function outboxKey(userId: string, groupId: string): string {
  return userPrefix(userId) + 'out:' + groupId;
}

/** Τα τελευταία `CACHED_MESSAGES` — αυτά που θα φανούν με το άνοιγμα. */
export function trimForCache(messages: ChatMessage[]): ChatMessage[] {
  return messages.length <= CACHED_MESSAGES
    ? messages
    : messages.slice(messages.length - CACHED_MESSAGES);
}

/**
 * Τι απομένει από ένα outbox που επέζησε από επανεκκίνηση.
 *
 * Όσα βρίσκονται ήδη στο ιστορικό είχαν φύγει — φεύγουν από το outbox. Τα
 * υπόλοιπα γυρίζουν ως `failed` και όχι ως `pending`: δεν ξέρουμε αν έφτασαν,
 * και δεν στέλνουμε ξανά κάτι εν αγνοία του χρήστη. Το πάτημα είναι δικό του.
 */
/**
 * Πετάει τις φωτογραφίες που δεν υπάρχουν πια στη συσκευή.
 *
 * Με μόνιμο αντίγραφο δεν πρέπει να συμβαίνει· συμβαίνει αν ο χρήστης καθαρίσει
 * τα δεδομένα της εφαρμογής. Ό,τι είχε και λεζάντα επιβιώνει ως σκέτο κείμενο —
 * μισό μήνυμα είναι καλύτερο από ένα που δεν στέλνεται ποτέ. Ό,τι ήταν μόνο
 * φωτογραφία δεν έχει τι να στείλει και φεύγει.
 */
export function dropMissingImages(
  outbox: OutgoingMessage[],
  exists: (uri: string) => boolean,
): OutgoingMessage[] {
  const kept: OutgoingMessage[] = [];

  for (const item of outbox) {
    if (!item.image || exists(item.image.uri)) {
      kept.push(item);
      continue;
    }
    if (item.content.trim().length > 0) {
      kept.push({ ...item, image: undefined });
    }
  }

  return kept;
}

export function restoreOutbox(
  saved: OutgoingMessage[],
  history: ChatMessage[],
): OutgoingMessage[] {
  const confirmed = new Set(
    history.map(function (message) {
      return message.id;
    }),
  );

  return saved
    .filter(function (item) {
      return !confirmed.has(item.id);
    })
    .map(function (item) {
      return item.status === 'failed' ? item : { ...item, status: 'failed' as const };
    });
}
