import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import type { RealtimeChannel, User as AuthUser } from '@supabase/supabase-js';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import ChatComposer from '../components/chat/ChatComposer';
import MessageBubble, { DateSeparator } from '../components/chat/MessageBubble';
import SquadPicker, { SquadMonogram } from '../components/chat/SquadPicker';
import { buildRows, type OutgoingMessage, type Row } from '../components/chat/messageRows';
import {
  applyMessageUpdate,
  connectionFrom,
  connectionLabel,
  mergeNewMessages,
  type Connection,
} from '../components/chat/connection';
import {
  activeTypists,
  noteTyping,
  presenceLabel,
  typingLabel,
  TYPING_THROTTLE_MS,
  type Typist,
} from '../components/chat/typing';
import {
  highlightParts,
  isSearchable,
  snippet,
} from '../components/chat/search';
import { newMessageId } from '../lib/ids';
import type { Group } from '../services/serviceGroup';
import {
  deleteMessage,
  editMessage,
  getGroupPreviews,
  getGroupsForUser,
  getMemberNames,
  getMessages,
  getMessagesAfter,
  getUnreadCounts,
  markGroupRead,
  searchMessages,
  sendMessage,
  toChatMessage,
  type SearchHit,
  type ChatMessage,
  type GroupPreview,
} from '../services/serviceGroup';
import { closeGroupChat, sendTyping, startChat } from '../services/serviceRealtime';
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
  // Αδιάβαστα ανά παρέα. Μόνο όσες έχουν αδιάβαστα υπάρχουν στον χάρτη.
  const [unread, setUnread] = useState<Record<string, number>>({});
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
  // Το μήνυμα που κρατάει ανοιχτό το μενού Edit / Delete· null = κλειστό.
  const [menuFor, setMenuFor] = useState<ChatMessage | null>(null);
  // Το μήνυμα που διορθώνεται αυτή τη στιγμή στον composer.
  const [editing, setEditing] = useState<ChatMessage | null>(null);
  // Ποιοι γράφουν αυτή τη στιγμή, και πόσοι είναι συνδεδεμένοι.
  const [typists, setTypists] = useState<Typist[]>([]);
  const [online, setOnline] = useState(0);
  // Αναζήτηση: null = κλειστή. Το κείμενο ζει χωριστά από τα αποτελέσματα,
  // επειδή τα δεύτερα έρχονται με καθυστέρηση.
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchHits, setSearchHits] = useState<SearchHit[] | null>(null);
  const [searching, setSearching] = useState(false);

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
  // Το τελευταίο mark_group_read που ταξιδεύει. Το loadUnread το περιμένει πριν
  // ρωτήσει τη βάση: αλλιώς, βγαίνοντας από ένα chat, το unread_counts μπορεί να
  // προλάβει το mark και να ξαναανάψει το badge που μόλις σβήσαμε.
  const markingRef = useRef<Promise<unknown>>(Promise.resolve());
  // Ποιοι είμαστε, για presence και broadcast. Σε ref επειδή το κανάλι στήνεται
  // μία φορά ανά παρέα, ενώ το όνομα φτάνει αργότερα από το προφίλ.
  const meRef = useRef({ id: user.id, name: '' });
  meRef.current = { id: user.id, name: displayName };
  // Το ανοιχτό κανάλι, ώστε ο composer να μπορεί να στείλει «γράφω».
  const channelRef = useRef<RealtimeChannel | null>(null);
  // Πότε στείλαμε τελευταία φορά — το throttle του typing.
  const typingSentRef = useRef(0);

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

  // Ίδια λογική με τα previews: αν αποτύχει, η λίστα δουλεύει χωρίς badges.
  const loadUnread = useCallback(async function load() {
    try {
      await markingRef.current;
      setUnread(await getUnreadCounts());
    } catch {
      // σιωπηλά
    }
  }, []);

  // Σημειώνει την παρέα διαβασμένη και σβήνει ΑΜΕΣΩΣ το badge της, χωρίς να
  // περιμένει τη βάση: το badge είναι δική μας ένδειξη, δεν έχει νόημα να
  // μένει αναμμένο ενώ κοιτάς τη συνομιλία. Αν το αίτημα αποτύχει, ο μετρητής
  // απλώς επανέρχεται στο επόμενο loadUnread.
  const markRead = useCallback(
    function mark(groupId: string) {
      setUnread(function (current) {
        if (!(groupId in current)) {
          return current;
        }
        const next = { ...current };
        delete next[groupId];
        return next;
      });

      markingRef.current = markGroupRead(groupId).catch(function () {
        // σιωπηλά — ο μετρητής θα διορθωθεί στο επόμενο loadUnread.
      });
    },
    [],
  );

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
        loadUnread();
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
  }, [user.id, loadPreviews, loadUnread]);

  // 3. Ιστορικό + realtime κανάλι της ενεργής παρέας.
  useEffect(() => {
    // Καμία ενεργή παρέα -> είμαστε στη λίστα, δεν ανοίγουμε κανάλι.
    if (!activeId) {
      setMessages([]);
      setOutbox([]);
      setMemberCount(0);
      setHasMore(false);
      setConnection('connecting');
      setTypists([]);
      setOnline(0);
      return;
    }

    // Το activeId είναι ήδη ελεγμένο παραπάνω, αλλά η handleStatus είναι hoisted
    // function declaration και η TypeScript δεν κρατά τη στένωση μέσα της.
    const chatGroupId: string = activeId;

    // Άνοιγμα = διάβασμα. Εδώ και όχι στην openGroup, ώστε να καλύπτεται και το
    // initialGroupId — όταν η οθόνη ανοίγει κατευθείαν σε συνομιλία, δεν περνάει
    // ποτέ από την openGroup.
    markRead(chatGroupId);

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
    setTypists([]);
    setOnline(0);
    typingSentRef.current = 0;

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

    // «Γράφει…» από άλλον. Το broadcast δεν ξέρει τα profiles, οπότε αν το
    // όνομα δεν ήρθε, το συμπληρώνουμε από τον χάρτη μελών.
    function handleTyping(who: { id: string; name: string }) {
      const name = who.name || namesRef.current[who.id] || '';
      setTypists(function (prev) {
        return noteTyping(prev, { id: who.id, name, at: Date.now() });
      });
    }

    // Διόρθωση ή διαγραφή από άλλον. Και τα δύο φτάνουν σαν UPDATE, επειδή η
    // διαγραφή είναι soft.
    function handleUpdatedRow(row: any) {
      const senderName = namesRef.current[row.sender_id];
      const updated = toChatMessage(row, senderName);

      setMessages(function (prev) {
        return applyMessageUpdate(prev, updated);
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

        const chat = await startChat(groupId, meRef.current, {
          onNewMessage: handleIncomingRow,
          onMessageUpdate: handleUpdatedRow,
          onStatus: handleStatus,
          onTyping: handleTyping,
          onPresence: setOnline,
        });
        channelRef.current = chat.channel;

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
      // Κλείσιμο = διάβασμα, δεύτερη φορά: όσα ήρθαν ΟΣΟ κοιτούσες τη συνομιλία
      // τα είδες κι αυτά. Χωρίς αυτό, βγαίνοντας από ένα ανοιχτό chat θα έβρισκες
      // badge για μηνύματα που μόλις διάβασες.
      markRead(chatGroupId);
      channelRef.current = null;
      if (channel) {
        closeGroupChat(channel);
      }
    };
  }, [activeId, markRead]);

  /**
   * Οι ενδείξεις «γράφει…» λήγουν μόνες τους.
   *
   * Το broadcast δεν έχει «σταμάτησε να γράφει» — μόνο σιωπή. Χωρίς αυτόν τον
   * καθαρισμό, ένα tab που έκλεισε στη μέση μιας λέξης θα άφηνε το «γράφει…»
   * αναμμένο για πάντα. Ο timer τρέχει μόνο όσο υπάρχει κάποιος στη λίστα.
   */
  useEffect(() => {
    if (typists.length === 0) {
      return;
    }

    const timer = setInterval(function prune() {
      setTypists(function (prev) {
        const alive = activeTypists(prev, Date.now());
        // Ίδιο μήκος -> κανείς δεν έληξε -> ίδια αναφορά, κανένα render.
        return alive.length === prev.length ? prev : alive;
      });
    }, 1000);

    return function cleanup() {
      clearInterval(timer);
    };
  }, [typists.length]);

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

  /**
   * Διόρθωση και διαγραφή, και οι δύο αισιόδοξες.
   *
   * Η αλλαγή φαίνεται αμέσως και, αν η βάση την απορρίψει, η οθόνη γυρίζει στο
   * μήνυμα όπως ήταν. Κρατάμε ολόκληρο το παλιό αντικείμενο για την επαναφορά
   * αντί για ένα flag: ο trigger μπορεί να αρνηθεί για λόγους που δεν ξέρουμε
   * εκ των προτέρων, και τότε το μόνο σωστό είναι να ξαναδείξουμε ό,τι ίσχυε.
   */
  const applyEdit = useCallback(
    async function apply(target: ChatMessage, text: string) {
      if (text === target.content) {
        return;
      }

      setError(null);
      setMessages(function (prev) {
        return applyMessageUpdate(prev, {
          ...target,
          content: text,
          editedAt: new Date().toISOString(),
        });
      });

      try {
        const saved = await editMessage(target.id, text);
        setMessages(function (prev) {
          return applyMessageUpdate(prev, saved);
        });
      } catch {
        setMessages(function (prev) {
          return applyMessageUpdate(prev, target);
        });
        setError("Couldn't save that edit.");
      }
    },
    [],
  );

  const applyDelete = useCallback(
    async function apply(target: ChatMessage) {
      setError(null);
      setMessages(function (prev) {
        return applyMessageUpdate(prev, {
          ...target,
          content: '',
          deletedAt: new Date().toISOString(),
        });
      });

      try {
        const saved = await deleteMessage(target.id);
        setMessages(function (prev) {
          return applyMessageUpdate(prev, saved);
        });
      } catch {
        setMessages(function (prev) {
          return applyMessageUpdate(prev, target);
        });
        setError("Couldn't delete that message.");
      }
    },
    [],
  );

  /**
   * Η αναζήτηση, με καθυστέρηση.
   *
   * Χωρίς αυτήν θα έφευγε ένα ερώτημα ανά πλήκτρο, και οι απαντήσεις θα
   * επέστρεφαν με άλλη σειρά από αυτή που στάλθηκαν — «παρα» θα μπορούσε να
   * απαντηθεί μετά το «παραλ» και να δείξει λάθος αποτελέσματα. Η σημαία
   * `cancelled` κόβει κάθε απάντηση που δεν αφορά πια τον τρέχοντα όρο.
   */
  useEffect(() => {
    if (!searchOpen || !activeId) {
      return;
    }

    if (!isSearchable(searchTerm)) {
      setSearchHits(null);
      setSearching(false);
      return;
    }

    let cancelled = false;
    setSearching(true);

    const timer = setTimeout(async function run() {
      try {
        const hits = await searchMessages(activeId, searchTerm);
        if (!cancelled) {
          setSearchHits(hits);
        }
      } catch {
        if (!cancelled) {
          setSearchHits([]);
        }
      } finally {
        if (!cancelled) {
          setSearching(false);
        }
      }
    }, 250);

    return function cleanup() {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [searchOpen, searchTerm, activeId]);

  function openSearch() {
    setSearchTerm('');
    setSearchHits(null);
    setSearchOpen(true);
  }

  function closeSearch() {
    setSearchOpen(false);
    setSearchTerm('');
    setSearchHits(null);
    setSearching(false);
  }

  /**
   * Λέει στους άλλους ότι γράφουμε — με throttle.
   *
   * Χωρίς αυτό θα έφευγε ένα broadcast ανά πλήκτρο. Το κατώφλι είναι αισθητά
   * μικρότερο από τον χρόνο ζωής της ένδειξης, ώστε το «γράφει…» του άλλου να
   * μη σβήνει ανάμεσα σε δύο αποστολές.
   */
  const handleTypingActivity = useCallback(function activity() {
    const channel = channelRef.current;
    if (!channel) {
      return;
    }

    const now = Date.now();
    if (now - typingSentRef.current < TYPING_THROTTLE_MS) {
      return;
    }
    typingSentRef.current = now;
    sendTyping(channel, meRef.current);
  }, []);

  // Ο composer έχει δύο δουλειές πλέον. Ποια από τις δύο, το λέει το `editing`.
  const handleComposerSend = useCallback(
    function submit(text: string) {
      if (editing) {
        const target = editing;
        setEditing(null);
        applyEdit(target, text);
        return;
      }
      handleSend(text);
    },
    [editing, applyEdit, handleSend],
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

  // Ο ενικός/πληθυντικός των μελών μετακόμισε στην presenceLabel, μαζί με το
  // «· N online» — τα δύο μπαίνουν στην ίδια γραμμή και κρίνονται μαζί.
  const typing = typingLabel(
    activeTypists(typists, Date.now()).map(function (entry) {
      return entry.name;
    }),
  );

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
    // Το markRead του cleanup έσβησε ήδη τοπικά το badge αυτής της παρέας· αυτό
    // εδώ φέρνει τους μετρητές των ΑΛΛΩΝ, που μπορεί να άλλαξαν όσο έλειπες.
    loadUnread();
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
        editedAt={message.editedAt}
        deleted={message.deletedAt !== null}
        // Το μενού ανοίγει μόνο στα δικά μου και μόνο σε όσα έχει επιβεβαιώσει
        // η βάση: ένα μήνυμα που ταξιδεύει ακόμα δεν έχει τι να διορθώσει.
        onLongPress={
          isMine && !item.status
            ? function () {
                setMenuFor(message);
              }
            : undefined
        }
      />
    );
  }

  /**
   * Το μενού ενός μηνύματος. Modal και όχι φύλλο μέσα στη λίστα: πρέπει να
   * σκεπάσει και τον composer, και να κλείνει με το πίσω κουμπί στο Android.
   */
  function renderMessageMenu() {
    const target = menuFor;
    if (!target) {
      return null;
    }

    function close() {
      setMenuFor(null);
    }

    return (
      <Modal
        transparent
        visible
        animationType="fade"
        onRequestClose={close}
        accessibilityViewIsModal
      >
        {/* Το πάτημα εκτός του φύλλου κλείνει — το αναμενόμενο σε action sheet. */}
        <Pressable style={styles.menuBackdrop} onPress={close} accessibilityLabel="Close menu">
          {/* Δεύτερο Pressable χωρίς onPress: σταματά το πάτημα ώστε να μην
              κλείνει το μενού όταν πατάς μέσα του. */}
          <Pressable style={styles.menuSheet}>
            <Text style={styles.menuPreview} numberOfLines={2}>
              {target.content}
            </Text>

            <Pressable
              onPress={function () {
                setMenuFor(null);
                setEditing(target);
              }}
              accessibilityRole="button"
              style={menuItemStyle}
            >
              <Ionicons name="pencil" size={17} color={paper.ink} />
              <Text style={styles.menuText}>Edit</Text>
            </Pressable>

            <View style={styles.menuDivider} />

            <Pressable
              onPress={function () {
                setMenuFor(null);
                // Αν το μήνυμα που σβήνουμε είναι αυτό που διορθώναμε, η
                // διόρθωση δεν έχει πλέον αντικείμενο.
                setEditing(function (current) {
                  return current && current.id === target.id ? null : current;
                });
                applyDelete(target);
              }}
              accessibilityRole="button"
              style={menuItemStyle}
            >
              <Ionicons name="trash-outline" size={17} color={paper.danger} />
              <Text style={[styles.menuText, styles.menuTextDanger]}>Delete</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    );
  }

  function menuItemStyle({ pressed }: { pressed: boolean }): StyleProp<ViewStyle> {
    if (pressed) {
      return [styles.menuItem, styles.menuItemPressed];
    }
    return styles.menuItem;
  }

  /** Το αποτέλεσμα μιας αναζήτησης — ο όρος τονισμένος μέσα στο απόσπασμα. */
  function renderHit(hit: SearchHit) {
    const text = snippet(hit.content, searchTerm);
    const who = hit.senderName || 'Someone';

    return (
      <View key={hit.id} style={styles.hit}>
        <Text style={styles.hitWho}>
          {who} · {new Date(hit.createdAt).toLocaleDateString('en-GB', {
            day: 'numeric',
            month: 'short',
          })}
        </Text>
        <Text style={styles.hitText}>
          {highlightParts(text, searchTerm).map(function (part, index) {
            // Το key είναι ο δείκτης επίτηδες: τα κομμάτια δεν αναδιατάσσονται
            // ποτέ — ξαναφτιάχνονται από την αρχή σε κάθε αλλαγή του όρου.
            return (
              <Text key={index} style={part.match ? styles.hitMatch : undefined}>
                {part.text}
              </Text>
            );
          })}
        </Text>
      </View>
    );
  }

  function renderSearch() {
    if (!searchOpen) {
      return null;
    }

    let body;
    if (!isSearchable(searchTerm)) {
      body = <Text style={styles.searchNote}>Type at least two characters.</Text>;
    } else if (searching && searchHits === null) {
      body = <ActivityIndicator style={styles.searchSpinner} color={paper.accent} />;
    } else if (searchHits && searchHits.length === 0) {
      body = <Text style={styles.searchNote}>Nothing found for "{searchTerm.trim()}".</Text>;
    } else if (searchHits) {
      body = searchHits.map(renderHit);
    }

    return (
      <Modal transparent visible animationType="fade" onRequestClose={closeSearch}>
        <View style={styles.searchScreen}>
          <View style={styles.searchBar}>
            <Ionicons name="search" size={16} color={paper.inkFaint} />
            <TextInput
              style={styles.searchInput}
              value={searchTerm}
              onChangeText={setSearchTerm}
              placeholder="Search this squad"
              placeholderTextColor={paper.inkFaint}
              autoCorrect={false}
              autoFocus
              accessibilityLabel="Search messages"
            />
            <Pressable onPress={closeSearch} accessibilityRole="button" accessibilityLabel="Close search" hitSlop={8}>
              <Ionicons name="close" size={18} color={paper.inkSoft} />
            </Pressable>
          </View>

          <ScrollView
            style={styles.searchResults}
            contentContainerStyle={styles.searchResultsInner}
            keyboardShouldPersistTaps="handled"
          >
            {body}
          </ScrollView>
        </View>
      </Modal>
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
          unread={unread}
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
            <Text style={styles.subtitle}>{presenceLabel(memberCount, online)}</Text>
          </View>

          <Pressable
            onPress={openSearch}
            accessibilityRole="button"
            accessibilityLabel="Search messages"
            style={backButtonStyle}
          >
            <Ionicons name="search" size={19} color={paper.ink} />
          </Pressable>
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

          {/* Πάνω από τον composer και όχι μέσα στη λίστα: η λίστα είναι
              ανεστραμμένη, και μια γραμμή που μπαίνει και βγαίνει εκεί θα
              κουνούσε το σκρολ. */}
          {typing ? <Text style={styles.typing}>{typing}</Text> : null}

          {/* Το key ξαναστήνει τον composer όταν αλλάζει το μήνυμα που
              διορθώνουμε — έτσι το initialText διαβάζεται ξανά χωρίς effect. */}
          <ChatComposer
            key={editing ? 'edit-' + editing.id : 'new'}
            initialText={editing ? editing.content : ''}
            editing={editing !== null}
            onCancel={function () {
              setEditing(null);
            }}
            onSend={handleComposerSend}
            onTyping={handleTypingActivity}
            disabled={!activeId}
          />

          {renderMessageMenu()}
          {renderSearch()}
        </KeyboardAvoidingView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, backgroundColor: paper.bg, alignItems: 'center', justifyContent: 'center' },
  screen: { flex: 1, backgroundColor: paper.bg },
  column: { flex: 1, width: '100%', maxWidth: layout.column, alignSelf: 'center' },

  // Μενού μηνύματος: φύλλο στο κάτω μέρος, όπως τα action sheets του συστήματος.
  menuBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(31, 30, 29, 0.35)',
  },
  menuSheet: {
    width: '100%',
    maxWidth: layout.column,
    alignSelf: 'center',
    paddingVertical: space.xs,
    paddingBottom: space.md,
    backgroundColor: paper.bg,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
  },
  // Το κείμενο του μηνύματος στην κορυφή, ώστε να ξέρεις σε ποιο ενεργείς.
  menuPreview: {
    paddingHorizontal: space.md,
    paddingTop: space.sm,
    paddingBottom: space.sm,
    color: paper.inkFaint,
    fontFamily: paperFont.regular,
    fontSize: 13,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingHorizontal: space.md,
    paddingVertical: 14,
  },
  menuItemPressed: { backgroundColor: paper.surfaceAlt },
  menuDivider: { height: 1, marginLeft: space.md, backgroundColor: paper.lineSoft },
  // Ίδια θέση και μέγεθος με την ένδειξη σύνδεσης — οι δύο δεν εμφανίζονται
  // ποτέ μαζί για πολύ, και όταν εναλλάσσονται δεν πρέπει να πηδάει η οθόνη.
  typing: {
    paddingHorizontal: space.md,
    paddingBottom: space.xxs,
    color: paper.inkFaint,
    fontFamily: paperFont.regular,
    fontSize: 12,
    fontStyle: 'italic',
  },
  // Αναζήτηση: πλήρης οθόνη, όχι φύλλο. Τα αποτελέσματα θέλουν ύψος, και το
  // πληκτρολόγιο στο κινητό τρώει το μισό.
  searchScreen: { flex: 1, backgroundColor: paper.bg },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    width: '100%',
    maxWidth: layout.column,
    alignSelf: 'center',
    marginTop: space.xl,
    marginHorizontal: space.md,
    paddingHorizontal: 14,
    height: 42,
    backgroundColor: paper.surface,
    borderWidth: 1,
    borderColor: paper.line,
    borderRadius: radius.pill,
  },
  searchInput: {
    flex: 1,
    color: paper.ink,
    fontFamily: paperFont.regular,
    fontSize: 14,
    outlineStyle: 'none',
  } as any,
  searchResults: { flex: 1 },
  searchResultsInner: {
    width: '100%',
    maxWidth: layout.column,
    alignSelf: 'center',
    paddingHorizontal: space.md,
    paddingTop: space.md,
    paddingBottom: space.xl,
  },
  searchNote: {
    paddingTop: space.lg,
    color: paper.inkSoft,
    fontFamily: paperFont.regular,
    fontSize: 13,
    textAlign: 'center',
  },
  searchSpinner: { paddingTop: space.lg },
  hit: {
    paddingVertical: space.sm,
    borderBottomWidth: 1,
    borderBottomColor: paper.lineSoft,
  },
  hitWho: {
    marginBottom: 3,
    color: paper.inkFaint,
    fontFamily: paperFont.medium,
    fontSize: 11,
  },
  hitText: { color: paper.ink, fontFamily: paperFont.regular, fontSize: 14, lineHeight: 20 },
  // Τονισμός με φόντο και όχι με χρώμα γράμματος: διαβάζεται και όταν ο όρος
  // πέφτει πάνω σε σημεία στίξης.
  hitMatch: { backgroundColor: paper.accentSoft, color: paper.accent, fontFamily: paperFont.semi },

  menuText: { color: paper.ink, fontFamily: paperFont.medium, fontSize: 15 },
  menuTextDanger: { color: paper.danger },

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
