import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import type { RealtimeChannel, User as AuthUser } from '@supabase/supabase-js';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import ChatComposer from '../components/chat/ChatComposer';
import MessageBubble, { DateSeparator } from '../components/chat/MessageBubble';
import SquadPicker, { SquadMonogram } from '../components/chat/SquadPicker';
import { buildRows, type OutgoingMessage, type Row } from '../components/chat/messageRows';
import {
  connectionFrom,
  connectionLabel,
  mergeNewMessages,
  type Connection,
} from '../components/chat/connection';
import { newMessageId } from '../lib/ids';
import type { Group } from '../services/serviceGroup';
import {
  getGroupPreviews,
  getGroupsForUser,
  getMemberNames,
  getMessages,
  getMessagesAfter,
  sendMessage,
  toChatMessage,
  type ChatMessage,
  type GroupPreview,
} from '../services/serviceGroup';
import { closeGroupChat, startChat } from '../services/serviceRealtime';
import { getUserById } from '../services/serviceUser';
import { layout, paper, paperFont, radius, space } from '../theme';

/**
 * Πόσα χαμένα μηνύματα γεφυρώνουμε σελίδα-σελίδα πριν τα παρατήσουμε και
 * ξαναρχίσουμε από την πρώτη σελίδα. Μετά από μέρες εκτός, ο βρόχος θα ήταν
 * δεκάδες αιτήματα σε μια συσκευή που μόλις ξύπνησε — ενώ το αποτέλεσμα είναι
 * το ίδιο, αφού το παλιότερο ιστορικό έρχεται με scroll προς τα πάνω.
 */
const CATCH_UP_LIMIT = 300;

type GroupChatScreenProps = {
  user: AuthUser;
  /** Αν δοθεί, ανοίγει κατευθείαν αυτή η παρέα· αλλιώς ξεκινάμε από τη λίστα. */
  initialGroupId?: string | null;
  /** Αν λείπει, δεν εμφανίζεται βελάκι πίσω από τη λίστα — η πλοήγηση γίνεται από το BottomNav. */
  onBack?: () => void;
};

export default function GroupChatScreen({
  user,
  initialGroupId = null,
  onBack,
}: GroupChatScreenProps) {
  const [groups, setGroups] = useState<Group[]>([]);
  // null = κανένα ανοιχτό chat, δηλαδή δείχνουμε τη λίστα με τις παρέες.
  const [activeId, setActiveId] = useState<string | null>(initialGroupId);
  const [previews, setPreviews] = useState<Record<string, GroupPreview>>({});
  const [displayName, setDisplayName] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  // Δικά μου μηνύματα που δεν έχουν επιβεβαιωθεί ακόμα από τη βάση.
  const [outbox, setOutbox] = useState<OutgoingMessage[]>([]);
  const [memberCount, setMemberCount] = useState(0);
  const [loadingGroups, setLoadingGroups] = useState(true);
  const [loadingChat, setLoadingChat] = useState(false);
  // Η δική μας σύνδεση με το κανάλι της συνομιλίας.
  const [connection, setConnection] = useState<Connection>('connecting');
  // Υπάρχει κι άλλο ιστορικό πάνω από όσα δείχνουμε;
  const [hasMore, setHasMore] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Τα ονόματα των μελών ζουν και σε ref: ο realtime handler φτιάχνεται μία φορά
  // ανά παρέα και πρέπει να βλέπει πάντα τον τρέχοντα χάρτη.
  const namesRef = useRef<Record<string, string>>({});
  // Φρουρά για το onEndReached, που πυροδοτείται και δύο φορές στο ίδιο σκρολ.
  // Δεν είναι state: το χρειαζόμαστε ΤΩΡΑ μέσα στην loadOlder, όχι στο επόμενο
  // render — μέχρι τότε θα έχει ήδη φύγει δεύτερο αίτημα για την ίδια σελίδα.
  const loadingOlderRef = useRef(false);
  // Το outbox και σε ref, ώστε η retrySend να διαβάζει την τρέχουσα λίστα χωρίς
  // να ξαναφτιάχνεται σε κάθε αλλαγή της — αλλιώς άλλαζε σε κάθε πληκτρολόγηση.
  const outboxRef = useRef<OutgoingMessage[]>([]);
  outboxRef.current = outbox;
  // Ίδιος λόγος: το catch-up ζει μέσα στο effect του καναλιού, που στήνεται μία
  // φορά ανά παρέα. Χωρίς ref θα έβλεπε για πάντα την άδεια αρχική λίστα.
  const messagesRef = useRef<ChatMessage[]>([]);
  messagesRef.current = messages;
  const connectionRef = useRef<Connection>('connecting');

  // Φέρνει τα τελευταία μηνύματα για την προεπισκόπηση της λίστας.
  // Αν αποτύχει το αφήνουμε να περάσει: η λίστα δουλεύει και χωρίς previews.
  const loadPreviews = useCallback(async function load(forGroups: Group[]) {
    const ids = forGroups.map(function (group) {
      return group.id;
    });

    try {
      const latest = await getGroupPreviews(ids);
      setPreviews(latest);
    } catch {
      // σιωπηλά — η προεπισκόπηση είναι διακόσμηση, όχι περιεχόμενο.
    }
  }, []);

  // 1. Το όνομα του χρήστη — μόνο για τον χαιρετισμό, γι' αυτό αν αποτύχει
  // απλώς μένει άδειο και ο χαιρετισμός εμφανίζεται χωρίς όνομα.
  useEffect(() => {
    let cancelled = false;

    async function loadProfile() {
      try {
        const profile = await getUserById(user.id);
        if (!cancelled && profile) {
          setDisplayName(profile.name);
        }
      } catch {
        // σιωπηλά
      }
    }

    loadProfile();

    return function cleanup() {
      cancelled = true;
    };
  }, [user.id]);

  // 2. Οι παρέες του χρήστη — μία φορά.
  useEffect(() => {
    // Σημαία ακύρωσης: αν φύγει η οθόνη όσο τρέχει το await, δεν κάνουμε setState.
    let cancelled = false;

    async function loadGroups() {
      try {
        const myGroups = await getGroupsForUser(user.id);
        if (cancelled) {
          return;
        }

        setGroups(myGroups);
        loadPreviews(myGroups);
      } catch {
        // Δεν μας ενδιαφέρει ΤΙ έσκασε, μόνο ότι απέτυχε.
        if (!cancelled) {
          setError("Couldn't load your squads.");
        }
      } finally {
        // Το finally τρέχει και σε επιτυχία και σε αποτυχία.
        if (!cancelled) {
          setLoadingGroups(false);
        }
      }
    }

    loadGroups();

    // Cleanup: τρέχει στο unmount ή πριν ξανατρέξει το effect.
    return function cleanup() {
      cancelled = true;
    };
  }, [user.id, loadPreviews]);

  // 3. Ιστορικό + realtime κανάλι της ενεργής παρέας.
  useEffect(() => {
    // Καμία ενεργή παρέα -> είμαστε στη λίστα, δεν ανοίγουμε κανάλι.
    if (!activeId) {
      setMessages([]);
      setOutbox([]);
      setMemberCount(0);
      setHasMore(false);
      setConnection('connecting');
      return;
    }

    // Το activeId είναι ήδη ελεγμένο παραπάνω, αλλά η handleStatus είναι hoisted
    // function declaration και η TypeScript δεν κρατά τη στένωση μέσα της.
    const chatGroupId: string = activeId;

    let cancelled = false;
    // Χρειάζεται ρητός τύπος: με σκέτο `= null` η TS θα κλείδωνε τον τύπο σε `null`.
    let channel: RealtimeChannel | null = null;

    setLoadingChat(true);
    setMessages([]);
    // Ό,τι δεν πρόλαβε να φύγει χάνεται όταν αλλάξεις Παρέα: για να επιβιώνει
    // θέλει αποθήκευση στη συσκευή, που είναι επόμενη φάση.
    setOutbox([]);
    setHasMore(false);
    setConnection('connecting');
    connectionRef.current = 'connecting';
    setLoadingOlder(false);
    loadingOlderRef.current = false;
    setError(null);

    // Καλείται όταν ο server στείλει νέα γραμμή μηνύματος.
    // Το `row` ΔΕΝ το δίνουμε εμείς — το δίνει η startChat όταν φτάσει το μήνυμα.
    function handleIncomingRow(row: any) {
      const senderName = namesRef.current[row.sender_id];
      const incoming = toChatMessage(row, senderName);

      setMessages(function (prev) {
        // Το ίδιο μήνυμα μπορεί να ξαναέρθει σε reconnect — κράτα ένα.
        let alreadyExists = false;
        for (let i = 0; i < prev.length; i++) {
          if (prev[i].id === incoming.id) {
            alreadyExists = true;
            break;
          }
        }

        if (alreadyExists) {
          // Ίδια αναφορά πίνακα -> το React καταλαβαίνει ότι τίποτα δεν άλλαξε.
          return prev;
        }

        // Νέος πίνακας με το μήνυμα στο τέλος.
        // Ποτέ prev.push() — το state του React δεν το πειράζουμε επί τόπου.
        return [...prev, incoming];
      });
    }

    /**
     * Γεφυρώνει το κενό μιας αποσύνδεσης.
     *
     * Το postgres_changes δεν ξαναστέλνει όσα έχασες: το κανάλι ξανασυνδέεται
     * σιωπηλά και συνεχίζει από εκείνη τη στιγμή. Χωρίς αυτό, τα μηνύματα του
     * διαστήματος δεν εμφανίζονται ποτέ.
     */
    async function catchUp(groupId: string) {
      // Δείκτης: το πιο πρόσφατο που ξέρουμε. Χωρίς μηνύματα δεν υπάρχει κενό
      // να γεφυρωθεί — η openChat έφερε ήδη την πρώτη σελίδα.
      const latest = messagesRef.current[messagesRef.current.length - 1];
      if (!latest) {
        return;
      }

      let since = latest.createdAt;
      let collected: ChatMessage[] = [];

      for (;;) {
        const page = await getMessagesAfter(groupId, since);
        if (cancelled) {
          return;
        }

        collected = [...collected, ...page.messages];

        if (!page.hasMore || page.messages.length === 0) {
          break;
        }

        // Πάνω από το όριο, το κενό είναι πολύ μεγάλο για να το γεφυρώσουμε
        // σελίδα-σελίδα. Ξαναρχίζουμε από την πρώτη σελίδα: τίποτα δεν χάνεται,
        // το παλιότερο ιστορικό μένει προσβάσιμο με scroll προς τα πάνω.
        if (collected.length >= CATCH_UP_LIMIT) {
          const fresh = await getMessages(groupId);
          if (cancelled) {
            return;
          }
          setMessages(fresh.messages);
          setHasMore(fresh.hasMore);
          return;
        }

        since = page.messages[page.messages.length - 1].createdAt;
      }

      if (collected.length === 0) {
        return;
      }

      // Μπορεί να μπήκε καινούργιο μέλος όσο ήμασταν εκτός· χωρίς αυτό τα
      // μηνύματά του θα έφταναν από το κανάλι χωρίς όνομα αποστολέα.
      try {
        const names = await getMemberNames(groupId);
        if (!cancelled) {
          namesRef.current = names;
          setMemberCount(Object.keys(names).length);
        }
      } catch {
        // Τα ονόματα είναι καλλωπισμός· τα μηνύματα μετράνε.
      }

      if (!cancelled) {
        setMessages(function (prev) {
          return mergeNewMessages(prev, collected);
        });
      }
    }

    // Κάθε αλλαγή κατάστασης του καναλιού, και στις επανασυνδέσεις.
    function handleStatus(status: string) {
      if (cancelled) {
        return;
      }

      const next = connectionFrom(status);
      // Η σύγκριση γίνεται σε ref και όχι μέσα στον updater του setConnection:
      // ο updater μπορεί να τρέξει δύο φορές (StrictMode), και το catch-up είναι
      // αίτημα δικτύου — δεν έχει θέση μέσα σε συνάρτηση που πρέπει να είναι καθαρή.
      const wasOnline = connectionRef.current === 'online';
      connectionRef.current = next;
      setConnection(next);

      // Η επιστροφή στο online είναι το σήμα: ό,τι έτρεξε στο μεταξύ λείπει.
      if (!wasOnline && next === 'online') {
        catchUp(chatGroupId).catch(function () {
          // Αν αποτύχει, η επόμενη επανασύνδεση ξαναδοκιμάζει από τον ίδιο
          // δείκτη. Δεν χαλάμε την οθόνη για κάτι που επανορθώνεται μόνο του.
        });
      }
    }

    async function openChat(groupId: string) {
      try {
        const names = await getMemberNames(groupId);
        if (cancelled) {
          return;
        }

        namesRef.current = names;
        // Object.keys(names) = πίνακας με τα user ids -> το μήκος του = πλήθος μελών.
        const memberIds = Object.keys(names);
        setMemberCount(memberIds.length);

        const chat = await startChat(groupId, handleIncomingRow, undefined, handleStatus);

        // Αν άλλαξε παρέα όσο άνοιγε το κανάλι, το cleanup έχει ήδη τρέξει και δεν
        // ξέρει γι' αυτό το κανάλι. Κλείσ' το εδώ, αλλιώς μένει ανοιχτό socket.
        if (cancelled) {
          await closeGroupChat(chat.channel);
          return;
        }

        channel = chat.channel;
        setMessages(chat.messages);
        setHasMore(chat.hasMore);
      } catch {
        if (!cancelled) {
          setError("Couldn't load this conversation.");
        }
      } finally {
        if (!cancelled) {
          setLoadingChat(false);
        }
      }
    }

    // Εδώ η TypeScript ξέρει ότι το activeId είναι `string` (όχι null),
    // επειδή το `if (!activeId) return;` παραπάνω απέκλεισε το null.
    openChat(activeId);

    return function cleanup() {
      cancelled = true;
      if (channel) {
        closeGroupChat(channel);
      }
    };
  }, [activeId]);

  /**
   * Η αποστολή, από τη στιγμή που το μήνυμα είναι ήδη στην οθόνη.
   *
   * Σε επιτυχία το μήνυμα περνάει μόνο του στα επιβεβαιωμένα — δεν περιμένουμε
   * το realtime echo. Αν το κανάλι είναι πεσμένο, το μήνυμα πρέπει να μείνει
   * εκεί που το βλέπει ο χρήστης· το echo, όταν έρθει, φέρνει το ίδιο id και
   * το κόβει ο έλεγχος διπλών.
   */
  const deliver = useCallback(
    async function deliver(groupId: string, id: string, text: string) {
      try {
        const saved = await sendMessage(groupId, user.id, text, id);

        setMessages(function (prev) {
          if (prev.some((m) => m.id === saved.id)) return prev;
          return [...prev, saved];
        });
        setOutbox(function (prev) {
          return prev.filter((item) => item.id !== id);
        });
      } catch {
        setOutbox(function (prev) {
          return prev.map((item) =>
            item.id === id ? { ...item, status: 'failed' as const } : item,
          );
        });
      }
    },
    [user.id],
  );

  // Ο composer δεν περιμένει τίποτα: το μήνυμα μπαίνει στη λίστα και φεύγει.
  const handleSend = useCallback(
    function send(text: string) {
      if (!activeId) {
        return;
      }

      const id = newMessageId();
      setOutbox(function (prev) {
        return [...prev, { id, content: text, createdAt: new Date().toISOString(), status: 'pending' }];
      });
      setError(null);

      deliver(activeId, id, text);
    },
    [activeId, deliver],
  );

  // Δεύτερη προσπάθεια για μήνυμα που απέτυχε — με το ΙΔΙΟ id, ώστε μια αποστολή
  // που τελικά είχε περάσει να μη γραφτεί δεύτερη φορά.
  const retrySend = useCallback(
    function retry(id: string) {
      if (!activeId) {
        return;
      }

      const item = outboxRef.current.find((entry) => entry.id === id);
      if (!item || item.status !== 'failed') {
        return;
      }

      setOutbox(function (prev) {
        return prev.map((entry) =>
          entry.id === id ? { ...entry, status: 'pending' as const } : entry,
        );
      });

      deliver(activeId, id, item.content);
    },
    [activeId, deliver],
  );

  // Φέρνει την επόμενη σελίδα παλιότερων και τη βάζει ΜΠΡΟΣΤΑ από όσα έχουμε.
  // Την καλεί η λίστα όταν ο χρήστης φτάσει στην κορυφή του ιστορικού.
  const loadOlder = useCallback(
    async function older() {
      // Η ref κόβει τη διπλή πυροδότηση· τα υπόλοιπα είναι απλή λογική.
      if (!activeId || loadingOlderRef.current || !hasMore) {
        return;
      }

      // Δείκτης: το παλαιότερο που κρατάμε. Χωρίς μηνύματα δεν έχει νόημα —
      // την πρώτη σελίδα την έφερε ήδη η openChat.
      const oldest = messages[0];
      if (!oldest) {
        return;
      }

      loadingOlderRef.current = true;
      setLoadingOlder(true);

      try {
        const page = await getMessages(activeId, { before: oldest.createdAt });

        setMessages(function (prev) {
          // Ό,τι ήρθε και το έχουμε ήδη πέφτει έξω. Δεν το περιμένουμε με
          // δείκτη χρόνου, αλλά ένα διπλό id στη λίστα σπάει το keyExtractor.
          const known = new Set(
            prev.map(function (message) {
              return message.id;
            }),
          );
          const fresh = page.messages.filter(function (message) {
            return !known.has(message.id);
          });

          if (fresh.length === 0) {
            return prev;
          }
          return [...fresh, ...prev];
        });

        setHasMore(page.hasMore);
      } catch {
        // Σιωπηλή αποτυχία: το ιστορικό που ήδη βλέπεις μένει στη θέση του και
        // η επόμενη προσπάθεια σκρολ ξαναζητάει την ίδια σελίδα.
        setHasMore(true);
      } finally {
        loadingOlderRef.current = false;
        setLoadingOlder(false);
      }
    },
    [activeId, hasMore, messages],
  );

  // Τα μηνύματα -> γραμμές λίστας (με διαχωριστικά ημέρας).
  // Ξαναϋπολογίζεται μόνο όταν αλλάξουν τα messages.
  const rows = useMemo(
    function () {
      return buildRows(messages, outbox, { id: user.id, name: displayName });
    },
    [messages, outbox, user.id, displayName],
  );

  // Η λίστα είναι inverted: ζωγραφίζει το index 0 στο ΚΑΤΩ μέρος και ανεβαίνει.
  // Δίνοντάς της τις γραμμές ανάποδα, η οθόνη διαβάζεται πάλι από πάνω προς τα
  // κάτω σε χρονολογική σειρά — και τα διαχωριστικά ημέρας μένουν πάνω από τη
  // μέρα τους, χωρίς να αλλάξει τίποτα στην buildRows.
  const invertedRows = useMemo(
    function () {
      return rows.slice().reverse();
    },
    [rows],
  );

  // Ποια παρέα είναι ανοιχτή. Δεν είναι state — προκύπτει από το state.
  let activeGroup: Group | null = null;
  for (let i = 0; i < groups.length; i++) {
    if (groups[i].id === activeId) {
      activeGroup = groups[i];
      break;
    }
  }

  // ---- Τιμές που θα μπουν στο JSX, υπολογισμένες εκ των προτέρων ----

  let memberLabel = 'members';
  if (memberCount === 1) {
    memberLabel = 'member';
  }

  // Το KeyboardAvoidingView θέλει 'padding' μόνο στο iOS.
  let keyboardBehavior: 'padding' | undefined = undefined;
  let keyboardOffset = 0;
  if (Platform.OS === 'ios') {
    keyboardBehavior = 'padding';
    keyboardOffset = 8;
  }

  // ---- Ενέργειες ----

  function openGroup(id: string) {
    setError(null);
    setActiveId(id);
  }

  // Πίσω από το ανοιχτό chat: κλείνει τη συνομιλία και ξαναδείχνει τη λίστα,
  // με φρέσκια προεπισκόπηση ώστε να φαίνεται το μήνυμα που μόλις γράφτηκε.
  function closeGroup() {
    setActiveId(null);
    setError(null);
    loadPreviews(groups);
  }

  // ---- Βοηθητικές συναρτήσεις εμφάνισης ----

  // Το Pressable καλεί αυτή τη συνάρτηση και της δίνει { pressed: true/false }.
  function backButtonStyle({ pressed }: { pressed: boolean }): StyleProp<ViewStyle> {
    if (pressed) {
      return [styles.back, styles.pressed];
    }
    return styles.back;
  }

  // Σε inverted λίστα το footer ζωγραφίζεται στην ΚΟΡΥΦΗ — ακριβώς εκεί που
  // περιμένει ο χρήστης την ένδειξη ότι κατεβαίνει κι άλλο ιστορικό.
  function renderOlderSpinner() {
    if (!loadingOlder) {
      return null;
    }
    return (
      <View style={styles.olderSpinner}>
        <ActivityIndicator color={paper.accent} size="small" />
      </View>
    );
  }

  // Το FlatList καλεί αυτή τη συνάρτηση για κάθε γραμμή και της δίνει το item.
  function renderRow({ item }: { item: Row }) {
    // Το `kind` ξεχωρίζει τα δύο είδη γραμμής (discriminated union):
    // μέσα σε κάθε κλάδο η TypeScript ξέρει ακριβώς ποια πεδία υπάρχουν.
    if (item.kind === 'date') {
      return <DateSeparator label={item.label} />;
    }

    const message = item.message;
    const isMine = message.senderId === user.id;

    return (
      <MessageBubble
        content={message.content}
        senderName={message.senderName}
        createdAt={message.createdAt}
        mine={isMine}
        isFirst={item.isFirst}
        isLast={item.isLast}
        status={item.status}
        onRetry={function () {
          retrySend(message.id);
        }}
      />
    );
  }

  function renderEmptyList() {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyTitle}>Quiet in here</Text>
        <Text style={styles.emptyText}>Write the squad's first message.</Text>
      </View>
    );
  }

  // ---- Η οθόνη ----

  if (loadingGroups) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator size="large" color={paper.accent} />
      </SafeAreaView>
    );
  }

  // α) Καμία ανοιχτή παρέα -> η λίστα επιλογής.
  if (activeGroup === null) {
    return (
      <SafeAreaView style={styles.screen}>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <SquadPicker
          groups={groups}
          previews={previews}
          displayName={displayName}
          onSelect={openGroup}
          onBack={onBack}
        />
      </SafeAreaView>
    );
  }

  // β) Ανοιχτή συνομιλία.
  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.column}>
        <View style={styles.topBar}>
          <Pressable
            onPress={closeGroup}
            accessibilityRole="button"
            accessibilityLabel="Back to squads"
            style={backButtonStyle}
          >
            <Ionicons name="chevron-back" size={20} color={paper.ink} />
          </Pressable>

          <SquadMonogram name={activeGroup.name} size={32} />

          <View style={styles.headerText}>
            <Text style={styles.title} numberOfLines={1}>
              {activeGroup.name}
            </Text>
            <Text style={styles.subtitle}>
              {memberCount} {memberLabel}
            </Text>
          </View>
        </View>

        <KeyboardAvoidingView
          style={styles.chat}
          behavior={keyboardBehavior}
          keyboardVerticalOffset={keyboardOffset}
        >
          {error ? <Text style={styles.error}>{error}</Text> : null}

          {/* Μόνο όταν φταίει κάτι. Στο online δεν υπάρχει τίποτα εδώ. */}
          {connectionLabel(connection) ? (
            <Text style={styles.connection}>{connectionLabel(connection)}</Text>
          ) : null}

          {loadingChat ? (
            <View style={styles.empty}>
              <ActivityIndicator color={paper.accent} />
            </View>
          ) : (
            <FlatList
              inverted
              data={invertedRows}
              keyExtractor={function (item) {
                return item.id;
              }}
              contentContainerStyle={styles.list}
              // Σε inverted λίστα το "τέλος" είναι η κορυφή του ιστορικού.
              onEndReached={loadOlder}
              onEndReachedThreshold={0.5}
              ListFooterComponent={renderOlderSpinner()}
              ListEmptyComponent={renderEmptyList()}
              renderItem={renderRow}
            />
          )}

          <ChatComposer onSend={handleSend} disabled={!activeId} />
        </KeyboardAvoidingView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, backgroundColor: paper.bg, alignItems: 'center', justifyContent: 'center' },
  screen: { flex: 1, backgroundColor: paper.bg },
  column: { flex: 1, width: '100%', maxWidth: layout.column, alignSelf: 'center' },

  // Header της συνομιλίας: μία λεπτή γραμμή τον χωρίζει από τα μηνύματα — καμία σκιά.
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingHorizontal: space.md,
    paddingTop: space.sm,
    paddingBottom: space.sm,
    borderBottomWidth: 1,
    borderBottomColor: paper.line,
    backgroundColor: paper.bg,
  },
  back: {
    width: 32,
    height: 32,
    marginLeft: -4,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { backgroundColor: paper.surfaceAlt },
  headerText: { flex: 1 },
  title: { color: paper.ink, fontFamily: paperFont.semi, fontSize: 16 },
  subtitle: { marginTop: 1, color: paper.inkFaint, fontFamily: paperFont.regular, fontSize: 12 },

  chat: { flex: 1 },
  // Η λίστα είναι inverted, άρα ο content container είναι αναποδογυρισμένος:
  // το paddingTop εμφανίζεται κάτω και το paddingBottom πάνω. Τα γράφουμε
  // ανάποδα ώστε η οθόνη να δείχνει όπως πριν.
  list: {
    flexGrow: 1,
    paddingHorizontal: space.md,
    paddingTop: space.md,
    paddingBottom: space.sm,
  },

  olderSpinner: { paddingVertical: space.md, alignItems: 'center' },

  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 4, padding: space.lg },
  emptyTitle: { color: paper.ink, fontFamily: paperFont.serifSemi, fontSize: 20 },
  emptyText: {
    color: paper.inkSoft,
    fontFamily: paperFont.regular,
    fontSize: 14,
    textAlign: 'center',
  },
  error: {
    paddingHorizontal: space.md,
    paddingVertical: space.xs,
    color: paper.accent,
    fontFamily: paperFont.medium,
    fontSize: 13,
    textAlign: 'center',
  },

  // Πιο σβηστή από το error: η αποσύνδεση είναι κατάσταση, όχι σφάλμα, και
  // περνάει από μόνη της.
  connection: {
    paddingHorizontal: space.md,
    paddingVertical: space.xs,
    backgroundColor: paper.surfaceAlt,
    color: paper.inkSoft,
    fontFamily: paperFont.medium,
    fontSize: 12,
    textAlign: 'center',
  },
});
