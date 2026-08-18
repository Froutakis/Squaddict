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
} from 'react-native';
import GradientAvatar, { initialsFor } from '../components/general/GradientAvatar';
import ChatComposer from '../components/chat/ChatComposer';
import GroupBar from '../components/general/GroupBar';
import MessageBubble, { DateSeparator } from '../components/chat/MessageBubble';
import { buildRows, type Row } from '../components/chat/messageRows';
import { Group } from '../models/main';
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
    let cancelled = false;

    async function loadGroups() {
      try {
        const myGroups = await getGroupsForUser(user.id);
        if (cancelled) return;

        setGroups(myGroups);
        setActiveId((current) => current ?? myGroups[0]?.id ?? null);
      } catch {
        if (!cancelled) setError("Couldn't load your squads.");
      } finally {
        if (!cancelled) setLoadingGroups(false);
      }
    }

    loadGroups();
    return () => {
      cancelled = true;
    };
  }, [user.id]);

  // 2. Ιστορικό + realtime κανάλι της ενεργής παρέας.
  useEffect(() => {
    if (!activeId) {
      setMessages([]);
      setMemberCount(0);
      return;
    }

    let cancelled = false;
    let channel: RealtimeChannel | null = null;

    setLoadingChat(true);
    setMessages([]);
    setError(null);

    async function openChat(groupId: string) {
      try {
        const names = await getMemberNames(groupId);
        if (cancelled) return;

        namesRef.current = names;
        setMemberCount(Object.keys(names).length);

        const chat = await startChat(groupId, (row) => {
          const incoming = toChatMessage(row, namesRef.current[row.sender_id]);
          // Το ίδιο μήνυμα μπορεί να ξαναέρθει σε reconnect — κράτα ένα.
          setMessages((prev) =>
            prev.some((m) => m.id === incoming.id) ? prev : [...prev, incoming],
          );
        });

        if (cancelled) {
          await closeGroupChat(chat.channel);
          return;
        }

        channel = chat.channel;
        setMessages(chat.messages);
      } catch {
        if (!cancelled) setError("Couldn't load this conversation.");
      } finally {
        if (!cancelled) setLoadingChat(false);
      }
    }

    openChat(activeId);

    return () => {
      cancelled = true;
      if (channel) closeGroupChat(channel);
    };
  }, [activeId]);

  const handleSend = useCallback(
    async (text: string) => {
      if (!activeId) return false;

      try {
        await sendMessage(activeId, user.id, text);
        setError(null);
        return true;
      } catch {
        setError('Message not sent. Tap send to try again.');
        return false;
      }
    },
    [activeId, user.id],
  );

  const rows = useMemo(() => buildRows(messages), [messages]);
  const activeGroup = groups.find((group) => group.id === activeId) ?? null;

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
          {onBack ? (
            <Pressable
              onPress={onBack}
              accessibilityRole="button"
              accessibilityLabel="Back"
              style={({ pressed }) => [styles.back, pressed && styles.pressed]}
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
              {activeGroup?.name ?? 'Chats'}
            </Text>
            {activeGroup ? (
              <Text style={styles.subtitle}>
                {memberCount} {memberCount === 1 ? 'member' : 'members'}
              </Text>
            ) : null}
          </View>
        </View>

        <GroupBar groups={groups} activeId={activeId} onSelect={setActiveId} showAll={false} />
        <View style={styles.divider} />

        <KeyboardAvoidingView
          style={styles.chat}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
        >
          {error ? <Text style={styles.error}>{error}</Text> : null}

          {groups.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>No squads yet</Text>
              <Text style={styles.emptyText}>Join a squad to start chatting.</Text>
            </View>
          ) : loadingChat ? (
            <View style={styles.empty}>
              <ActivityIndicator color={colors.primary} />
            </View>
          ) : (
            <FlatList
              ref={listRef}
              data={rows}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.list}
              onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
              ListEmptyComponent={
                <View style={styles.empty}>
                  <Text style={styles.emptyTitle}>No messages yet</Text>
                  <Text style={styles.emptyText}>Say something to get the squad going.</Text>
                </View>
              }
              renderItem={({ item }) =>
                item.kind === 'date' ? (
                  <DateSeparator label={item.label} />
                ) : (
                  <MessageBubble
                    content={item.message.content}
                    senderName={item.message.senderName}
                    createdAt={item.message.createdAt}
                    mine={item.message.senderId === user.id}
                    isFirst={item.isFirst}
                    isLast={item.isLast}
                  />
                )
              }
            />
          )}

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
