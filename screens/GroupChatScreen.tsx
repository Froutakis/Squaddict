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
import GradientAvatar, { initialsFor } from '../components/general/GradientAvatar';
import ChatComposer from '../components/chat/ChatComposer';
import GroupBar from '../components/general/GroupBar';
import MessageBubble, { DateSeparator } from '../components/chat/MessageBubble';
import { buildRows, type Row } from '../components/chat/messageRows';
import type { Group } from '../services/serviceGroup';
import {
  getGroupsForUser,
  getMemberNames,
  sendMessage,
  toChatMessage,
  type ChatMessage,
} from '../services/serviceGroup';
import { closeGroupChat, startChat } from '../services/serviceRealtime';
import { colors, font, layout, radius, space } from '../theme';

type GroupChatScreenProps = {
  user: AuthUser;
  /** Ποια παρέα ανοίγει πρώτη — αλλιώς η πρώτη της λίστας. */
  initialGroupId?: string | null;
  /** Αν λείπει, δεν εμφανίζεται βελάκι πίσω — η πλοήγηση γίνεται από το BottomNav. */
  onBack?: () => void;
};

export default function GroupChatScreen({
  user,
  initialGroupId = null,
  onBack,
}: GroupChatScreenProps) {
  const [groups, setGroups] = useState<Group[]>([]);
  const [activeId, setActiveId] = useState<string | null>(initialGroupId);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [memberCount, setMemberCount] = useState(0);
  const [loadingGroups, setLoadingGroups] = useState(true);
  const [loadingChat, setLoadingChat] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Τα ονόματα των μελών ζουν και σε ref: ο realtime handler φτιάχνεται μία φορά
  // ανά παρέα και πρέπει να βλέπει πάντα τον τρέχοντα χάρτη.
  const namesRef = useRef<Record<string, string>>({});
  const listRef = useRef<FlatList<Row>>(null);

  // 1. Οι παρέες του χρήστη — μία φορά.
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

        // Διάλεξε ποια παρέα θα είναι ενεργή. Περνάμε συνάρτηση στον setter
        // για να δούμε σίγουρα την πιο πρόσφατη τιμή του activeId.
        setActiveId(function (current) {
          // α) Αν έχει ήδη επιλεγεί κάποια, κράτα την.
          if (current !== null && current !== undefined) {
            return current;
          }
          // β) Αλλιώς, αν υπάρχει τουλάχιστον μία παρέα, πάρε την πρώτη.
          if (myGroups.length > 0) {
            return myGroups[0].id;
          }
          // γ) Αλλιώς, καμία.
          return null;
        });
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
  }, [user.id]);

  // 2. Ιστορικό + realtime κανάλι της ενεργής παρέας.
  useEffect(() => {
    // Καμία ενεργή παρέα -> άδειασε την οθόνη και σταμάτα εδώ.
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

  let headerTitle = 'Chats';
  if (activeGroup !== null) {
    headerTitle = activeGroup.name;
  }

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
        <Text style={styles.emptyTitle}>No messages yet</Text>
        <Text style={styles.emptyText}>Say something to get the squad going.</Text>
      </View>
    );
  }

  // Το κυρίως σώμα έχει τρεις πιθανές καταστάσεις.
  function renderChatBody() {
    // α) Ο χρήστης δεν έχει καμία παρέα.
    if (groups.length === 0) {
      return (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>No squads yet</Text>
          <Text style={styles.emptyText}>Join a squad to start chatting.</Text>
        </View>
      );
    }

    // β) Φορτώνει η συζήτηση.
    if (loadingChat) {
      return (
        <View style={styles.empty}>
          <ActivityIndicator color={colors.primary} />
        </View>
      );
    }

    // γ) Κανονική λίστα μηνυμάτων.
    return (
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
    );
  }

  // ---- Η οθόνη ----

  if (loadingGroups) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.column}>
        <View style={styles.header}>
          {/* Το βελάκι μπαίνει μόνο αν μας δόθηκε onBack. Το `: null` = μη ζωγραφίσεις τίποτα. */}
          {onBack ? (
            <Pressable
              onPress={onBack}
              accessibilityRole="button"
              accessibilityLabel="Back"
              style={backButtonStyle}
            >
              <Ionicons name="chevron-back" size={22} color={colors.text} />
            </Pressable>
          ) : null}

          {activeGroup ? (
            <GradientAvatar
              label={activeGroup.name}
              initials={initialsFor(activeGroup.name)}
              size={38}
            />
          ) : null}

          <View style={styles.headerText}>
            <Text style={styles.title} numberOfLines={1}>
              {headerTitle}
            </Text>
            {activeGroup ? (
              <Text style={styles.subtitle}>
                {memberCount} {memberLabel}
              </Text>
            ) : null}
          </View>
        </View>

        <GroupBar groups={groups} activeId={activeId} onSelect={setActiveId} showAll={false} />
        <View style={styles.divider} />

        <KeyboardAvoidingView
          style={styles.chat}
          behavior={keyboardBehavior}
          keyboardVerticalOffset={keyboardOffset}
        >
          {error ? <Text style={styles.error}>{error}</Text> : null}

          {renderChatBody()}

          <ChatComposer onSend={handleSend} disabled={!activeId} />
        </KeyboardAvoidingView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
  screen: { flex: 1, backgroundColor: colors.bg },
  column: { flex: 1, width: '100%', maxWidth: layout.column, alignSelf: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingHorizontal: space.md,
    paddingTop: space.sm,
    paddingBottom: space.xs,
  },
  back: {
    width: 38,
    height: 38,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pressed: { opacity: 0.7 },
  headerText: { flex: 1 },
  title: { color: colors.text, fontFamily: font.bold, fontSize: 19 },
  subtitle: { marginTop: 1, color: colors.textSoft, fontFamily: font.medium, fontSize: 12 },
  divider: { height: 1, backgroundColor: colors.border },
  chat: { flex: 1 },
  list: {
    flexGrow: 1,
    paddingHorizontal: space.md,
    paddingTop: space.xs,
    paddingBottom: space.md,
  },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 4, padding: space.lg },
  emptyTitle: { color: colors.textStrong, fontFamily: font.semi, fontSize: 16 },
  emptyText: { color: colors.textFaint, fontFamily: font.medium, fontSize: 14, textAlign: 'center' },
  error: {
    paddingHorizontal: space.md,
    paddingVertical: space.xs,
    color: colors.danger,
    fontFamily: font.medium,
    fontSize: 13,
    textAlign: 'center',
  },
});
