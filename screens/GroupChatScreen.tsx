import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import type { RealtimeChannel, User as AuthUser } from '@supabase/supabase-js';
import {
  ActivityIndicator,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import ChatComposer from '../components/chat/ChatComposer';
import ChatHeader from '../components/chat/ChatHeader';
import MessageBubble, { DateSeparator } from '../components/chat/MessageBubble';
import MessageMenu from '../components/chat/MessageMenu';
import {
  actionFor,
  dropReaction,
  mergeReactions,
  myReaction,
  putReaction,
  summarise,
  type ReactionMap,
} from '../components/chat/reactions';
import {
  quoteOf,
  refreshQuotes,
  resolveQuote,
  resolveQuotes,
} from '../components/chat/replies';
import SearchOverlay from '../components/chat/SearchOverlay';
import SquadPicker from '../components/chat/SquadPicker';
import { mentionIds, toMembers, type Member } from '../components/chat/mentions';
import { dropMissingImages, restoreOutbox } from '../components/chat/cache';
import { attachmentPath, mergeSigned, pathsToSign, type SignedMap } from '../components/chat/media';
import { buildRows, type LocalImage, type OutgoingMessage, type Row } from '../components/chat/messageRows';
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
  typingLabel,  
  TYPING_THROTTLE_MS,
  type Typist,
} from '../components/chat/typing';
import { newId } from '../lib/ids';
import {
  referencedImages,
  readMessages as readCachedMessages,
  readOutbox as readCachedOutbox,
  readSquads as readCachedSquads,
  writeMessages as writeCachedMessages,
  writeOutbox as writeCachedOutbox,
  writeSquads as writeCachedSquads,
} from '../services/serviceCache';
import type { Group } from '../services/serviceGroup';
import {
  deleteMessage,
  editMessage,
  getGroupPreviews,
  getGroupsForUser,
  getMemberNames,
  getMentionCounts,
  setMentions,
  getMessages,
  getMessagesAfter,
  getUnreadCounts,
  markGroupRead,
  clearReaction,
  getReactions,
  setReaction,
  toReaction,
  sendMessage,
  toChatMessage,
  type ChatMessage,
  type GroupPreview,
} from '../services/serviceGroup';
import {
  discardImage,
  imageExists,
  persistImage,
  pickImage,
  prepareImage,
  removeImage,
  signImages,
  sweepOutboxImages,
  uploadImage,
} from '../services/serviceMedia';
import { closeGroupChat, sendTyping, startChat } from '../services/serviceRealtime';
import { getUserById } from '../services/serviceUser';
import { layout, paper, paperFont, space } from '../theme';

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
  onThreadChange?: (open: boolean) => void;
};

export default function GroupChatScreen({
  user,
  initialGroupId = null,
  onBack,
  onThreadChange,
}: GroupChatScreenProps) {
  const [groups, setGroups] = useState<Group[]>([]);
  // null = κανένα ανοιχτό chat, δηλαδή δείχνουμε τη λίστα με τις παρέες.
  const [activeId, setActiveId] = useState<string | null>(initialGroupId);
  const [previews, setPreviews] = useState<Record<string, GroupPreview>>({});
  // Αδιάβαστα ανά παρέα. Μόνο όσες έχουν αδιάβαστα υπάρχουν στον χάρτη.
  const [unread, setUnread] = useState<Record<string, number>>({});
  const [mentionCounts, setMentionCounts] = useState<Record<string, number>>({});
  const [displayName, setDisplayName] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  // Δικά μου μηνύματα που δεν έχουν επιβεβαιωθεί ακόμα από τη βάση.
  const [outbox, setOutbox] = useState<OutgoingMessage[]>([]);
  const [memberCount, setMemberCount] = useState(0);
  const [members, setMembers] = useState<Member[]>([]);
  /** Σε ποια Παρέα ανήκουν τα `messages`. Φυλάει το αντίγραφο από λάθος κλειδί. */
  const [messagesFor, setMessagesFor] = useState<string | null>(null);
  /** Η φωτογραφία που διάλεξε ο χρήστης και δεν έχει σταλεί ακόμα. */
  const [pendingImage, setPendingImage] = useState<LocalImage | null>(null);
  /** Υπογεγραμμένοι σύνδεσμοι ανά διαδρομή. Λήγουν, γι' αυτό κρατάμε και ώρα. */
  const [signed, setSigned] = useState<SignedMap>({});
  /** Η φωτογραφία που κοιτάμε σε πλήρη οθόνη. */
  const [viewing, setViewing] = useState<string | null>(null);
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
  // Το μήνυμα στο οποίο απαντάμε. Αποκλείεται με το editing.
  const [replyingTo, setReplyingTo] = useState<ChatMessage | null>(null);
  // Ποιοι γράφουν αυτή τη στιγμή, και πόσοι είναι συνδεδεμένοι.
  const [typists, setTypists] = useState<Typist[]>([]);
  const [online, setOnline] = useState(0);
  // Αντιδράσεις των φορτωμένων μηνυμάτων, ανά message id.
  const [reactions, setReactions] = useState<ReactionMap>({});
  // Το μόνο που ξέρει ο γονιός για την αναζήτηση: αν είναι ανοιχτή. Τον όρο
  // και τα αποτελέσματα τα κρατά το SearchOverlay.
  const [searchOpen, setSearchOpen] = useState(false);

  // Τα ονόματα των μελών ζουν και σε ref: ο realtime handler φτιάχνεται μία φορά
  // ανά παρέα και πρέπει να βλέπει πάντα τον τρέχοντα χάρτη.
  const namesRef = useRef<Record<string, string>>({});
  const membersRef = useRef<Member[]>([]);
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
  const groupsRef = useRef<Group[]>([]);
  groupsRef.current = groups;
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
  useEffect(() => {
    onThreadChange?.(activeId !== null);
  }, [activeId, onThreadChange]);

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
      const [counts, mine] = await Promise.all([getUnreadCounts(), getMentionCounts()]);
      setUnread(counts);
      setMentionCounts(mine);
    } catch {
      // σιωπηλά
    }
  }, []);

  /**
   * Οι αντιδράσεις μιας σελίδας μηνυμάτων.
   *
   * Ξεχωριστό ερώτημα και όχι join στα μηνύματα: ένα μήνυμα με δέκα αντιδράσεις
   * θα επαναλάμβανε δέκα φορές το κείμενό του στην απάντηση.
   */
  const loadReactionsFor = useCallback(async function load(ids: string[]) {
    if (ids.length === 0) {
      return;
    }
    try {
      const rows = await getReactions(ids);
      setReactions(function (prev) {
        return mergeReactions(prev, rows);
      });
    } catch {
      // σιωπηλά — οι αντιδράσεις είναι επιπλέον, όχι περιεχόμενο.
    }
  }, []);

  // Σημειώνει την παρέα διαβασμένη και σβήνει ΑΜΕΣΩΣ το badge της, χωρίς να
  // περιμένει τη βάση: το badge είναι δική μας ένδειξη, δεν έχει νόημα να
  // μένει αναμμένο ενώ κοιτάς τη συνομιλία. Αν το αίτημα αποτύχει, ο μετρητής
  // απλώς επανέρχεται στο επόμενο loadUnread.
  const markRead = useCallback(
    function mark(groupId: string) {
      /** Βγάζει αυτή την Παρέα από έναν χάρτη μετρητών. */
      function forget(current: Record<string, number>) {
        if (!(groupId in current)) {
          return current;
        }
        const next = { ...current };
        delete next[groupId];
        return next;
      }

      setUnread(forget);
      setMentionCounts(forget);

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

    // Το τοπικό αντίγραφο ζωγραφίζει τη λίστα αμέσως· το δίκτυο το διορθώνει
    // από πάνω. Χωρίς αυτό, κάθε άνοιγμα της εφαρμογής ξεκινά με spinner.
    async function loadCached() {
      const cached = await readCachedSquads(user.id);
      if (cancelled || !cached || cached.groups.length === 0) {
        return;
      }

      setGroups(function (current) {
        return current.length === 0 ? cached.groups : current;
      });
      setPreviews(function (current) {
        return Object.keys(current).length === 0 ? cached.previews : current;
      });
      setLoadingGroups(false);
    }

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
        if (!cancelled && groupsRef.current.length === 0) {
          setError("Couldn't load your squads.");
        }
      } finally {
        // Το finally τρέχει και σε επιτυχία και σε αποτυχία.
        if (!cancelled) {
          setLoadingGroups(false);
        }
      }
    }

    loadCached();
    loadGroups();
    // Φωτογραφίες που διαλέχτηκαν και δεν στάλθηκαν ποτέ: κανένα outbox δεν τις
    // διεκδικεί, και ο φάκελος θα μεγάλωνε για πάντα.
    referencedImages(user.id).then(sweepOutboxImages);

    // Cleanup: τρέχει στο unmount ή πριν ξανατρέξει το effect.
    return function cleanup() {
      cancelled = true;
    };
  }, [user.id, loadPreviews, loadUnread]);

  // 2β. Το αντίγραφο της λίστας, όποτε αλλάξει κάτι ορατό σε αυτήν.
  useEffect(() => {
    if (groups.length === 0) {
      return;
    }
    writeCachedSquads(user.id, { groups, previews });
  }, [user.id, groups, previews]);

  // 2γ. Το αντίγραφο της συνομιλίας. Το `messagesFor` είναι ο φύλακας: όταν
  // αλλάζει Παρέα, τα messages είναι για μια στιγμή ακόμα της προηγούμενης.
  useEffect(() => {
    if (messagesFor === null || messagesFor !== activeId || messages.length === 0) {
      return;
    }
    writeCachedMessages(user.id, messagesFor, messages);
  }, [user.id, activeId, messagesFor, messages]);

  // 2δ. Το outbox. Γράφεται και άδειο — έτσι φεύγει ό,τι τελικά στάλθηκε.
  useEffect(() => {
    if (messagesFor === null || messagesFor !== activeId) {
      return;
    }
    writeCachedOutbox(user.id, messagesFor, outbox);
  }, [user.id, activeId, messagesFor, outbox]);

  // 2ε. Υπογεγραμμένοι σύνδεσμοι για τις φωτογραφίες που φορτώθηκαν.
  //
  // Το bucket είναι κλειστό: χωρίς υπογραφή δεν εμφανίζεται εικόνα. Οι σύνδεσμοι
  // λήγουν, γι' αυτό ο έλεγχος δεν είναι «λείπει;» αλλά «λείπει ή κοντεύει;».
  useEffect(() => {
    let cancelled = false;

    const paths = messages
      .map(function (message) {
        return message.attachment?.path;
      })
      .filter(function (path): path is string {
        return typeof path === 'string';
      });

    const missing = pathsToSign(paths, signed, Date.now());
    if (missing.length === 0) {
      return;
    }

    signImages(missing)
      .then(function (fresh) {
        if (!cancelled) {
          setSigned(function (prev) {
            return mergeSigned(prev, fresh);
          });
        }
      })
      .catch(function (problem) {
        console.error('[squaddict] η υπογραφή συνδέσμων απέτυχε:', problem);
      });

    return function cleanup() {
      cancelled = true;
    };
  }, [messages, signed]);

  // 3. Ιστορικό + realtime κανάλι της ενεργής παρέας.
  useEffect(() => {
    // Καμία ενεργή παρέα -> είμαστε στη λίστα, δεν ανοίγουμε κανάλι.
    if (!activeId) {
      setMessages([]);
      setMessagesFor(null);
      setOutbox([]);
      setPendingImage(null);
      setSigned({});
      setViewing(null);
      setMemberCount(0);
      setHasMore(false);
      setConnection('connecting');
      setTypists([]);
      setOnline(0);
      setReactions({});
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
    setMessagesFor(null);
    setOutbox([]);
    setPendingImage(null);
    setSigned({});
    setViewing(null);
    setHasMore(false);
    setConnection('connecting');
    connectionRef.current = 'connecting';
    setLoadingOlder(false);
    loadingOlderRef.current = false;
    setError(null);
    setTypists([]);
    setOnline(0);
    setReactions({});
    setEditing(null);
    setReplyingTo(null);
    replyOfOutgoingRef.current = {};
    typingSentRef.current = 0;

    // Καλείται όταν ο server στείλει νέα γραμμή μηνύματος.
    // Το `row` ΔΕΝ το δίνουμε εμείς — το δίνει η startChat όταν φτάσει το μήνυμα.
    function handleIncomingRow(row: any) {
      const senderName = namesRef.current[row.sender_id];
      // Το payload του realtime δεν περνάει από joins: αν είναι απάντηση, η
      // παράθεση λείπει και τη συμπληρώνουμε από όσα μηνύματα έχουμε ήδη.
      const incoming = resolveQuote(toChatMessage(row, senderName), messagesRef.current);

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

    function handleReaction(row: any) {
      setReactions(function (prev) {
        return putReaction(prev, toReaction(row));
      });
    }

    // Στο DELETE έρχεται η ΠΑΛΙΑ γραμμή — από αυτήν χρειαζόμαστε ποιος ήταν.
    function handleReactionGone(row: any) {
      setReactions(function (prev) {
        return dropReaction(prev, row.message_id, row.user_id);
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
        // Δύο δουλειές: το ίδιο το μήνυμα, και κάθε απάντηση που το παραθέτει.
        // Αυτό είναι το τίμημα της ζωντανής παράθεσης — και ο λόγος που την
        // επιλέξαμε: σβήνοντας ένα μήνυμα φεύγει το κείμενό του παντού.
        return refreshQuotes(applyMessageUpdate(prev, updated), updated);
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
          setMessages(resolveQuotes(fresh.messages));
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
          membersRef.current = toMembers(names);
          setMembers(membersRef.current);
          setMemberCount(Object.keys(names).length);
        }
      } catch {
        // Τα ονόματα είναι καλλωπισμός· τα μηνύματα μετράνε.
      }

      if (!cancelled) {
        setMessages(function (prev) {
          return resolveQuotes(mergeNewMessages(prev, collected));
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

    // Τρέχει παράλληλα με το openChat και χάνει τη μάχη αν το δίκτυο προλάβει:
    // ο έλεγχος `prev.length === 0` δεν αφήνει το αντίγραφο να σκεπάσει φρέσκα.
    async function showCached(groupId: string) {
      const cached = await readCachedMessages(user.id, groupId);
      if (cancelled || !cached || cached.length === 0) {
        return;
      }

      let used = false;
      setMessages(function (prev) {
        if (prev.length > 0) return prev;
        used = true;
        return resolveQuotes(cached);
      });

      if (used) {
        setMessagesFor(groupId);
        setLoadingChat(false);
      }
    }

    async function openChat(groupId: string) {
      try {
        const names = await getMemberNames(groupId);
        if (cancelled) {
          return;
        }

        namesRef.current = names;
        membersRef.current = toMembers(names);
        setMembers(membersRef.current);
        // Object.keys(names) = πίνακας με τα user ids -> το μήκος του = πλήθος μελών.
        const memberIds = Object.keys(names);
        setMemberCount(memberIds.length);

        const chat = await startChat(groupId, meRef.current, {
          onNewMessage: handleIncomingRow,
          onMessageUpdate: handleUpdatedRow,
          onStatus: handleStatus,
          onTyping: handleTyping,
          onPresence: setOnline,
          onReaction: handleReaction,
          onReactionGone: handleReactionGone,
        });
        channelRef.current = chat.channel;
        loadReactionsFor(chat.messages.map(function (m) { return m.id; }));

        // Αν άλλαξε παρέα όσο άνοιγε το κανάλι, το cleanup έχει ήδη τρέξει και δεν
        // ξέρει γι' αυτό το κανάλι. Κλείσ' το εδώ, αλλιώς μένει ανοιχτό socket.
        if (cancelled) {
          await closeGroupChat(chat.channel);
          return;
        }

        channel = chat.channel;
        setMessages(resolveQuotes(chat.messages));
        setMessagesFor(groupId);
        setHasMore(chat.hasMore);

        const saved = await readCachedOutbox(user.id, groupId);
        if (!cancelled && saved && saved.length > 0) {
          const left = dropMissingImages(restoreOutbox(saved, chat.messages), imageExists);
          for (const item of left) {
            if (item.replyTo) {
              replyOfOutgoingRef.current[item.id] = item.replyTo;
            }
          }
          setOutbox(left);
        }
      } catch (problem) {
        console.error('[squaddict] το άνοιγμα της συνομιλίας απέτυχε:', problem);
        // Με το αντίγραφο στην οθόνη δεν υπάρχει σφάλμα να δείξουμε: διαβάζεις
        // κανονικά, και η ένδειξη σύνδεσης λέει ήδη ότι δεν είμαστε online.
        if (!cancelled && messagesRef.current.length === 0) {
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
    showCached(activeId);
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
  }, [activeId, markRead, loadReactionsFor]);

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
    async function deliver(
      groupId: string,
      id: string,
      text: string,
      replyTo?: string | null,
      image?: LocalImage | null,
    ) {
      try {
        // Η εικόνα πρώτη: αν το ανέβασμα αποτύχει, δεν θέλουμε μήνυμα που να
        // δείχνει σε αρχείο που δεν υπάρχει. Το ίδιο id δίνει το ίδιο όνομα
        // αρχείου, οπότε η επανάληψη γράφει από πάνω αντί να αφήσει δεύτερο.
        const attachment = image ? await uploadImage(attachmentPath(groupId, id), image) : null;
        const saved = await sendMessage(groupId, user.id, text, id, replyTo, attachment);
        setMentions(saved.id, mentionIds(text, membersRef.current));

        setMessages(function (prev) {
          if (prev.some((m) => m.id === saved.id)) return prev;
          // Το ερώτημα δεν φέρνει αξιοποιήσιμη παράθεση (γυρίζει πίνακα σε
          // αυτο-αναφορική σχέση), οπότε τη συμπληρώνουμε από τη λίστα — όπως
          // κάνουμε και για ό,τι φτάνει από το κανάλι.
          return [...prev, resolveQuote(saved, prev)];
        });
        setOutbox(function (prev) {
          return prev.filter((item) => item.id !== id);
        });
        if (image) {
          discardImage(image.uri);
        }
      } catch (problem) {
        // Ο χρήστης βλέπει «Not sent» — εμείς χρειαζόμαστε το ΓΙΑΤΙ. Χωρίς αυτό
        // το σφάλμα της Postgres χάνεται και μένει μόνο ένα κόκκινο κουτάκι.
        console.error('[squaddict] η αποστολή απέτυχε:', problem);
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

      const id = newId();
      const answering = replyingTo;
      const image = pendingImage;

      setOutbox(function (prev) {
        return [
          ...prev,
          {
            id,
            content: text,
            createdAt: new Date().toISOString(),
            status: 'pending' as const,
            replyTo: answering ? answering.id : null,
            image: image ?? undefined,
          },
        ];
      });
      setError(null);
      if (answering) {
        replyOfOutgoingRef.current[id] = answering.id;
      }
      // Η μπάρα φεύγει αμέσως: το μήνυμα έχει ήδη φύγει με τον δείκτη μέσα του,
      // και μια μπάρα που μένει ανοιχτή μοιάζει σαν να μη στάλθηκε.
      setReplyingTo(null);
      setPendingImage(null);

      deliver(activeId, id, text, answering ? answering.id : null, image);
    },
    [activeId, deliver, replyingTo, pendingImage],
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
        setMentions(saved.id, mentionIds(text, membersRef.current));
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
        // Ο trigger μηδένισε ήδη τη διαδρομή στη γραμμή· το αρχείο το σβήνουμε
        // εμείς. Αν αποτύχει, μένει απρόσιτο — κοστίζει χώρο, όχι ιδιωτικότητα.
        if (target.attachment) {
          removeImage(target.attachment.path);
        }
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

  /**
   * Βάζει, αλλάζει ή παίρνει πίσω τη δική μου αντίδραση.
   *
   * Αισιόδοξη, όπως το edit και το delete: η αλλαγή φαίνεται αμέσως και, αν η
   * βάση την απορρίψει, ο χάρτης γυρίζει σε αυτό που ήταν. Κρατάμε ολόκληρο τον
   * προηγούμενο χάρτη για την επαναφορά — είναι φθηνός, μόνο αναφορές.
   */
  // Σε ποιο μήνυμα απαντούσε ένα ανεπιβεβαίωτο. Χωρίς αυτό, το retry θα
  // ξανάστελνε το μήνυμα χωρίς την απάντηση — και θα εμφανιζόταν ξεκρέμαστο.
  const replyOfOutgoingRef = useRef<Record<string, string>>({});

  const toggleReaction = useCallback(
    function toggle(messageId: string, emoji: string) {
      const mine = myReaction(reactions[messageId], user.id);
      const action = actionFor(mine, emoji);
      const before = reactions;

      if (action === 'clear') {
        setReactions(dropReaction(before, messageId, user.id));
        clearReaction(messageId).catch(function () {
          setReactions(before);
          setError("Couldn't remove that reaction.");
        });
        return;
      }

      setReactions(putReaction(before, { messageId, userId: user.id, emoji }));
      setReaction(messageId, emoji).catch(function () {
        setReactions(before);
        setError("Couldn't add that reaction.");
      });
    },
    [reactions, user.id],
  );

  /** Ανοίγει τη συλλογή και κρατά τη σμικρυμένη εικόνα μέχρι να πατηθεί αποστολή. */
  const choosePhoto = useCallback(async function choose() {
    try {
      const picked = await pickImage();
      if (!picked) {
        return;
      }
      const ready = await prepareImage(picked);
      setError(null);
      // Μόνιμο αντίγραφο εδώ και όχι στην αποστολή: ανάμεσα στα δύο μπορεί να
      // περάσει ώρα, και ο επεξεργαστής γράφει σε προσωρινή μνήμη.
      setPendingImage(persistImage(ready, newId()));
    } catch (problem) {
      console.error('[squaddict] η επιλογή φωτογραφίας απέτυχε:', problem);
      setError(problem instanceof Error ? problem.message : "Couldn't use that photo.");
    }
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

      deliver(activeId, id, item.content, replyOfOutgoingRef.current[id] ?? null, item.image);
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

        // Έξω από τον state updater: ο updater μπορεί να ξανατρέξει και δεν
        // στέλνουμε αιτήματα μέσα του.
        loadReactionsFor(page.messages.map(function (m) { return m.id; }));

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
          // Οι παλιότερες μπορεί να παραθέτουν η μία την άλλη, και μπορεί να
          // είναι το πρωτότυπο για απαντήσεις που ήδη δείχνουμε.
          return resolveQuotes([...fresh, ...prev]);
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
    [activeId, hasMore, messages, loadReactionsFor],
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
    // Τοπικό αρχείο όσο ανεβαίνει, υπογεγραμμένος σύνδεσμος μόλις φτάσει.
    const photoUri =
      item.image?.uri ??
      (message.attachment ? signed[message.attachment.path]?.url ?? null : null);

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
        // Το μενού ανοίγει πλέον και σε ξένα μηνύματα — εκεί έχει μόνο
        // αντιδράσεις. Ο περιορισμός που μένει είναι η επιβεβαίωση από τη βάση:
        // σε μήνυμα που ταξιδεύει ακόμα δεν υπάρχει id για να αντιδράσεις.
        onLongPress={
          item.status
            ? undefined
            : function () {
                setMenuFor(message);
              }
        }
        reply={message.reply}
        // Είναι απάντηση, αλλά το πρωτότυπο δεν είναι στη φορτωμένη σελίδα.
        replyUnknown={message.replyTo !== null && message.reply === null}
        members={members}
        meId={user.id}
        imageUri={photoUri}
        imageWidth={item.image?.width ?? message.attachment?.width}
        imageHeight={item.image?.height ?? message.attachment?.height}
        onOpenImage={
          photoUri
            ? function () {
                setViewing(photoUri);
              }
            : undefined
        }
        reactions={summarise(reactions[message.id], user.id)}
        onToggleReaction={
          item.status
            ? undefined
            : function (emoji) {
                toggleReaction(message.id, emoji);
              }
        }
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
          unread={unread}
          mentions={mentionCounts}
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
        <ChatHeader
          name={activeGroup.name}
          memberCount={memberCount}
          online={online}
          onBack={closeGroup}
          onSearch={function () {
            setSearchOpen(true);
          }}
        />

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
            replyTo={replyingTo ? quoteOf(replyingTo) : null}
            onCancel={function () {
              setEditing(null);
              setReplyingTo(null);
            }}
            onSend={handleComposerSend}
            onTyping={handleTypingActivity}
            members={members}
            meId={user.id}
            attachment={pendingImage}
            onPickImage={choosePhoto}
            onClearImage={function () {
              if (pendingImage) {
                discardImage(pendingImage.uri);
              }
              setPendingImage(null);
            }}
            disabled={!activeId}
          />

          <MessageMenu
            message={menuFor}
            myEmoji={menuFor ? myReaction(reactions[menuFor.id], user.id) : null}
            canEdit={menuFor ? menuFor.senderId === user.id : false}
            onReact={function (target, emoji) {
              setMenuFor(null);
              toggleReaction(target.id, emoji);
            }}
            onReply={function (target) {
              setMenuFor(null);
              // Διορθώνεις ή απαντάς, όχι και τα δύο.
              setEditing(null);
              setReplyingTo(target);
            }}
            onClose={function () {
              setMenuFor(null);
            }}
            onEdit={function (target) {
              setMenuFor(null);
              setEditing(target);
            }}
            onDelete={function (target) {
              setMenuFor(null);
              // Αν το μήνυμα που σβήνουμε είναι αυτό που διορθώναμε, η
              // διόρθωση δεν έχει πλέον αντικείμενο.
              setEditing(function (current) {
                return current && current.id === target.id ? null : current;
              });
              applyDelete(target);
            }}
          />
          <Modal
            visible={viewing !== null}
            transparent
            animationType="fade"
            onRequestClose={function () {
              setViewing(null);
            }}
          >
            {/* Ολόκληρο το φόντο κλείνει: σε πλήρη οθόνη το μόνο που θέλει ο
                χρήστης είναι να βγει, και το X είναι μικρός στόχος. */}
            <Pressable
              style={styles.viewer}
              onPress={function () {
                setViewing(null);
              }}
              accessibilityRole="button"
              accessibilityLabel="Close photo"
            >
              {viewing ? (
                <Image source={{ uri: viewing }} style={styles.viewerImage} resizeMode="contain" />
              ) : null}
            </Pressable>
          </Modal>

          <SearchOverlay
            groupId={activeGroup.id}
            visible={searchOpen}
            onClose={function () {
              setSearchOpen(false);
            }}
          />
        </KeyboardAvoidingView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  viewer: {
    flex: 1,
    backgroundColor: 'rgba(12, 25, 38, 0.94)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: space.md,
  },
  viewerImage: { width: '100%', height: '100%' },
  center: { flex: 1, backgroundColor: paper.bg, alignItems: 'center', justifyContent: 'center' },
  screen: { flex: 1, backgroundColor: paper.bg },
  column: { flex: 1, width: '100%', maxWidth: layout.column, alignSelf: 'center' },
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
