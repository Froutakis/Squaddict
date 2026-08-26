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
import { buildRows, type Row } from '../components/chat/messageRows';
import type { Group } from '../services/serviceGroup';
import {
  getGroupPreviews,
  getGroupsForUser,
  getMemberNames,
  sendMessage,
  toChatMessage,
  type ChatMessage,
  type GroupPreview,
} from '../services/serviceGroup';
import { closeGroupChat, startChat } from '../services/serviceRealtime';
import { getUserById } from '../services/serviceUser';
import { layout, paper, paperFont, radius, space } from '../theme';

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
  const [memberCount, setMemberCount] = useState(0);
  const [loadingGroups, setLoadingGroups] = useState(true);
  const [loadingChat, setLoadingChat] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Τα ονόματα των μελών ζουν και σε ref: ο realtime handler φτιάχνεται μία φορά
  // ανά παρέα και πρέπει να βλέπει πάντα τον τρέχοντα χάρτη.
  const namesRef = useRef<Record<string, string>>({});
  const listRef = useRef<FlatList<Row>>(null);

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
      setMemberCount(0);
      return;
    }

    let cancelled = false;
    // Χρειάζεται ρητός τύπος: με σκέτο `= null` η TS θα κλείδωνε τον τύπο σε `null`.
    let channel: RealtimeChannel | null = null;

    setLoadingChat(true);
    setMessages([]);
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

        const chat = await startChat(groupId, handleIncomingRow);

        // Αν άλλαξε παρέα όσο άνοιγε το κανάλι, το cleanup έχει ήδη τρέξει και δεν
        // ξέρει γι' αυτό το κανάλι. Κλείσ' το εδώ, αλλιώς μένει ανοιχτό socket.
        if (cancelled) {
          await closeGroupChat(chat.channel);
          return;
        }

        channel = chat.channel;
        setMessages(chat.messages);
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

  // Στέλνει μήνυμα. Επιστρέφει true/false ώστε ο composer να καθαρίσει το input
  // μόνο όταν όντως στάλθηκε.
  const handleSend = useCallback(
    async function send(text: string) {
      if (!activeId) {
        return false;
      }

      try {
        await sendMessage(activeId, user.id, text);
        setError(null);
        return true;
      } catch {
        setError('Message not sent. Tap send to try again.');
        return false;
      }
    },
    // Ξαναφτιάχνεται μόνο όταν αλλάξει η παρέα ή ο χρήστης.
    [activeId, user.id],
  );

  // Τα μηνύματα -> γραμμές λίστας (με διαχωριστικά ημέρας).
  // Ξαναϋπολογίζεται μόνο όταν αλλάξουν τα messages.
  const rows = useMemo(
    function () {
      return buildRows(messages);
    },
    [messages],
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

  function scrollToBottom() {
    // Το ref είναι null μέχρι να μπει η λίστα στην οθόνη.
    if (listRef.current !== null) {
      listRef.current.scrollToEnd({ animated: true });
    }
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

          {loadingChat ? (
            <View style={styles.empty}>
              <ActivityIndicator color={paper.accent} />
            </View>
          ) : (
            <FlatList
              ref={listRef}
              data={rows}
              keyExtractor={function (item) {
                return item.id;
              }}
              contentContainerStyle={styles.list}
              onContentSizeChange={scrollToBottom}
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
  list: {
    flexGrow: 1,
    paddingHorizontal: space.md,
    paddingTop: space.sm,
    paddingBottom: space.md,
  },

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
});
