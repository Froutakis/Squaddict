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

const CATCH_UP_LIMIT = 300;

type GroupChatScreenProps = {
  user: AuthUser;
  initialGroupId?: string | null;
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
  const [activeId, setActiveId] = useState<string | null>(initialGroupId);
  const [previews, setPreviews] = useState<Record<string, GroupPreview>>({});
  const [displayName, setDisplayName] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [outbox, setOutbox] = useState<OutgoingMessage[]>([]);
  const [memberCount, setMemberCount] = useState(0);
  const [loadingGroups, setLoadingGroups] = useState(true);
  const [loadingChat, setLoadingChat] = useState(false);
  const [connection, setConnection] = useState<Connection>('connecting');
  const [hasMore, setHasMore] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const namesRef = useRef<Record<string, string>>({});
  const loadingOlderRef = useRef(false);
  const outboxRef = useRef<OutgoingMessage[]>([]);
  outboxRef.current = outbox;
  const messagesRef = useRef<ChatMessage[]>([]);
  messagesRef.current = messages;
  const connectionRef = useRef<Connection>('connecting');

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
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadProfile() {
      try {
        const profile = await getUserById(user.id);
        if (!cancelled && profile) {
          setDisplayName(profile.name);
        }
      } catch {
      }
    }

    loadProfile();

    return function cleanup() {
      cancelled = true;
    };
  }, [user.id]);

  useEffect(() => {
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
        if (!cancelled) {
          setError("Couldn't load your squads.");
        }
      } finally {
        if (!cancelled) {
          setLoadingGroups(false);
        }
      }
    }

    loadGroups();

    return function cleanup() {
      cancelled = true;
    };
  }, [user.id, loadPreviews]);

  useEffect(() => {
    if (!activeId) {
      setMessages([]);
      setOutbox([]);
      setMemberCount(0);
      setHasMore(false);
      setConnection('connecting');
      return;
    }

    const chatGroupId: string = activeId;

    let cancelled = false;
    let channel: RealtimeChannel | null = null;

    setLoadingChat(true);
    setMessages([]);
    setOutbox([]);
    setHasMore(false);
    setConnection('connecting');
    connectionRef.current = 'connecting';
    setLoadingOlder(false);
    loadingOlderRef.current = false;
    setError(null);

    function handleIncomingRow(row: any) {
      const senderName = namesRef.current[row.sender_id];
      const incoming = toChatMessage(row, senderName);

      setMessages(function (prev) {
        let alreadyExists = false;
        for (let i = 0; i < prev.length; i++) {
          if (prev[i].id === incoming.id) {
            alreadyExists = true;
            break;
          }
        }

        if (alreadyExists) {
          return prev;
        }

        return [...prev, incoming];
      });
    }

    async function catchUp(groupId: string) {
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

      try {
        const names = await getMemberNames(groupId);
        if (!cancelled) {
          namesRef.current = names;
          setMemberCount(Object.keys(names).length);
        }
      } catch {
      }

      if (!cancelled) {
        setMessages(function (prev) {
          return mergeNewMessages(prev, collected);
        });
      }
    }

    function handleStatus(status: string) {
      if (cancelled) {
        return;
      }

      const next = connectionFrom(status);
      const wasOnline = connectionRef.current === 'online';
      connectionRef.current = next;
      setConnection(next);

      if (!wasOnline && next === 'online') {
        catchUp(chatGroupId).catch(function () {
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
        const memberIds = Object.keys(names);
        setMemberCount(memberIds.length);

        const chat = await startChat(groupId, handleIncomingRow, undefined, handleStatus);

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

    openChat(activeId);

    return function cleanup() {
      cancelled = true;
      if (channel) {
        closeGroupChat(channel);
      }
    };
  }, [activeId]);

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

  const loadOlder = useCallback(
    async function older() {
      if (!activeId || loadingOlderRef.current || !hasMore) {
        return;
      }

      const oldest = messages[0];
      if (!oldest) {
        return;
      }

      loadingOlderRef.current = true;
      setLoadingOlder(true);

      try {
        const page = await getMessages(activeId, { before: oldest.createdAt });

        setMessages(function (prev) {
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
        setHasMore(true);
      } finally {
        loadingOlderRef.current = false;
        setLoadingOlder(false);
      }
    },
    [activeId, hasMore, messages],
  );

  const rows = useMemo(
    function () {
      return buildRows(messages, outbox, { id: user.id, name: displayName });
    },
    [messages, outbox, user.id, displayName],
  );

  const invertedRows = useMemo(
    function () {
      return rows.slice().reverse();
    },
    [rows],
  );

  let activeGroup: Group | null = null;
  for (let i = 0; i < groups.length; i++) {
    if (groups[i].id === activeId) {
      activeGroup = groups[i];
      break;
    }
  }

  let memberLabel = 'members';
  if (memberCount === 1) {
    memberLabel = 'member';
  }

  let keyboardBehavior: 'padding' | undefined = undefined;
  let keyboardOffset = 0;
  if (Platform.OS === 'ios') {
    keyboardBehavior = 'padding';
    keyboardOffset = 8;
  }

  function openGroup(id: string) {
    setError(null);
    setActiveId(id);
  }

  function closeGroup() {
    setActiveId(null);
    setError(null);
    loadPreviews(groups);
  }

  function backButtonStyle({ pressed }: { pressed: boolean }): StyleProp<ViewStyle> {
    if (pressed) {
      return [styles.back, styles.pressed];
    }
    return styles.back;
  }

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

  function renderRow({ item }: { item: Row }) {
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

  if (loadingGroups) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator size="large" color={paper.accent} />
      </SafeAreaView>
    );
  }

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
