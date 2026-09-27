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
import GroupPicker from '../components/chat/GroupPicker';
import { mentionIds, toMembers } from '../components/chat/mentions';
import type { Person } from '../lib/people';
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
  readGroups as readCachedGroups,
  writeMessages as writeCachedMessages,
  writeOutbox as writeCachedOutbox,
  writeGroups as writeCachedGroups,
} from '../services/serviceCache';
import type { Group } from '../services/serviceGroup';
import { getGroupsForUser, getMemberNames } from '../services/serviceGroup';
import {
  clearReaction,
  deleteMessage,
  editMessage,
  getGroupPreviews,
  getMentionCounts,
  getMessages,
  getMessagesAfter,
  getReactions,
  getUnreadCounts,
  markGroupRead,
  sendMessage,
  setMentions,
  setReaction,
  toChatMessage,
  toReaction,
  type ChatMessage,
  type GroupPreview,
} from '../services/serviceChat';
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
import { layout, paper, typo, space } from '../theme';
import GroupScreen from './GroupScreen';

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
  const [filterId, setFilterId] = useState<string | null>(null);
  const [previews, setPreviews] = useState<Record<string, GroupPreview>>({});
  const [unread, setUnread] = useState<Record<string, number>>({});
  const [mentionCounts, setMentionCounts] = useState<Record<string, number>>({});
  const [displayName, setDisplayName] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [outbox, setOutbox] = useState<OutgoingMessage[]>([]);
  const [memberCount, setMemberCount] = useState(0);
  const [members, setMembers] = useState<Person[]>([]);
  const [messagesFor, setMessagesFor] = useState<string | null>(null);
  const [pendingImage, setPendingImage] = useState<LocalImage | null>(null);
  const [signed, setSigned] = useState<SignedMap>({});
  const [viewing, setViewing] = useState<string | null>(null);
  const [loadingGroups, setLoadingGroups] = useState(true);
  const [loadingChat, setLoadingChat] = useState(false);
  const [connection, setConnection] = useState<Connection>('connecting');
  const [hasMore, setHasMore] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [menuFor, setMenuFor] = useState<ChatMessage | null>(null);
  const [editing, setEditing] = useState<ChatMessage | null>(null);
  const [replyingTo, setReplyingTo] = useState<ChatMessage | null>(null);
  const [typists, setTypists] = useState<Typist[]>([]);
  const [online, setOnline] = useState(0);
  const [reactions, setReactions] = useState<ReactionMap>({});
  const [searchOpen, setSearchOpen] = useState(false);
  const [groupScreen, setGroupScreen] = useState(false);

  const namesRef = useRef<Record<string, string>>({});
  const membersRef = useRef<Person[]>([]);
  const loadingOlderRef = useRef(false);
  const outboxRef = useRef<OutgoingMessage[]>([]);
  outboxRef.current = outbox;
  const messagesRef = useRef<ChatMessage[]>([]);
  const groupsRef = useRef<Group[]>([]);
  groupsRef.current = groups;
  messagesRef.current = messages;
  const connectionRef = useRef<Connection>('connecting');
  const markingRef = useRef<Promise<unknown>>(Promise.resolve());
  const meRef = useRef({ id: user.id, name: '' });
  meRef.current = { id: user.id, name: displayName };
  const channelRef = useRef<RealtimeChannel | null>(null);
  const typingSentRef = useRef(0);

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

  const loadUnread = useCallback(async function load() {
    try {
      await markingRef.current;
      const [counts, mine] = await Promise.all([getUnreadCounts(), getMentionCounts()]);
      setUnread(counts);
      setMentionCounts(mine);
    } catch {
    }
  }, []);

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
    }
  }, []);

  const markRead = useCallback(
    function mark(groupId: string) {
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
      });
    },
    [],
  );

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

    async function loadCached() {
      const cached = await readCachedGroups(user.id);
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
        if (!cancelled && groupsRef.current.length === 0) {
          setError("Couldn't load your squads.");
        }
      } finally {
        if (!cancelled) {
          setLoadingGroups(false);
        }
      }
    }

    loadCached();
    loadGroups();
    referencedImages(user.id).then(sweepOutboxImages);

    return function cleanup() {
      cancelled = true;
    };
  }, [user.id, loadPreviews, loadUnread]);

  useEffect(() => {
    if (groups.length === 0) {
      return;
    }
    writeCachedGroups(user.id, { groups, previews });
  }, [user.id, groups, previews]);

  useEffect(() => {
    if (messagesFor === null || messagesFor !== activeId || messages.length === 0) {
      return;
    }
    writeCachedMessages(user.id, messagesFor, messages);
  }, [user.id, activeId, messagesFor, messages]);

  useEffect(() => {
    if (messagesFor === null || messagesFor !== activeId) {
      return;
    }
    writeCachedOutbox(user.id, messagesFor, outbox);
  }, [user.id, activeId, messagesFor, outbox]);

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

  useEffect(() => {
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
      setGroupScreen(false);
      return;
    }

    const chatGroupId: string = activeId;

    markRead(chatGroupId);

    let cancelled = false;
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

    function handleIncomingRow(row: any) {
      const senderName = namesRef.current[row.sender_id];
      const incoming = resolveQuote(toChatMessage(row, senderName), messagesRef.current);

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

    function handleReaction(row: any) {
      setReactions(function (prev) {
        return putReaction(prev, toReaction(row));
      });
    }

    function handleReactionGone(row: any) {
      setReactions(function (prev) {
        return dropReaction(prev, row.message_id, row.user_id);
      });
    }

    function handleTyping(who: { id: string; name: string }) {
      const name = who.name || namesRef.current[who.id] || '';
      setTypists(function (prev) {
        return noteTyping(prev, { id: who.id, name, at: Date.now() });
      });
    }

    function handleUpdatedRow(row: any) {
      const senderName = namesRef.current[row.sender_id];
      const updated = toChatMessage(row, senderName);

      setMessages(function (prev) {
        return refreshQuotes(applyMessageUpdate(prev, updated), updated);
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
          setMessages(resolveQuotes(fresh.messages));
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
          membersRef.current = toMembers(names);
          setMembers(membersRef.current);
          setMemberCount(Object.keys(names).length);
        }
      } catch {
      }

      if (!cancelled) {
        setMessages(function (prev) {
          return resolveQuotes(mergeNewMessages(prev, collected));
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
        if (!cancelled && messagesRef.current.length === 0) {
          setError("Couldn't load this conversation.");
        }
      } finally {
        if (!cancelled) {
          setLoadingChat(false);
        }
      }
    }

    showCached(activeId);
    openChat(activeId);

    return function cleanup() {
      cancelled = true;
      markRead(chatGroupId);
      channelRef.current = null;
      if (channel) {
        closeGroupChat(channel);
      }
    };
  }, [activeId, markRead, loadReactionsFor]);

  useEffect(() => {
    if (typists.length === 0) {
      return;
    }

    const timer = setInterval(function prune() {
      setTypists(function (prev) {
        const alive = activeTypists(prev, Date.now());
        return alive.length === prev.length ? prev : alive;
      });
    }, 1000);

    return function cleanup() {
      clearInterval(timer);
    };
  }, [typists.length]);

  const deliver = useCallback(
    async function deliver(
      groupId: string,
      id: string,
      text: string,
      replyTo?: string | null,
      image?: LocalImage | null,
    ) {
      try {
        const attachment = image ? await uploadImage(attachmentPath(groupId, id), image) : null;
        const saved = await sendMessage(groupId, user.id, text, id, replyTo, attachment);
        setMentions(saved.id, mentionIds(text, membersRef.current));

        setMessages(function (prev) {
          if (prev.some((m) => m.id === saved.id)) return prev;
          return [...prev, resolveQuote(saved, prev)];
        });
        setOutbox(function (prev) {
          return prev.filter((item) => item.id !== id);
        });
        if (image) {
          discardImage(image.uri);
        }
      } catch (problem) {
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
      setReplyingTo(null);
      setPendingImage(null);

      deliver(activeId, id, text, answering ? answering.id : null, image);
    },
    [activeId, deliver, replyingTo, pendingImage],
  );

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

  const choosePhoto = useCallback(async function choose() {
    try {
      const picked = await pickImage();
      if (!picked) {
        return;
      }
      const ready = await prepareImage(picked);
      setError(null);
      setPendingImage(persistImage(ready, newId()));
    } catch (problem) {
      console.error('[squaddict] η επιλογή φωτογραφίας απέτυχε:', problem);
      setError(problem instanceof Error ? problem.message : "Couldn't use that photo.");
    }
  }, []);

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

        loadReactionsFor(page.messages.map(function (m) { return m.id; }));

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
          return resolveQuotes([...fresh, ...prev]);
        });

        setHasMore(page.hasMore);
      } catch {
        setHasMore(true);
      } finally {
        loadingOlderRef.current = false;
        setLoadingOlder(false);
      }
    },
    [activeId, hasMore, messages, loadReactionsFor],
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


  const typing = typingLabel(
    activeTypists(typists, Date.now()).map(function (entry) {
      return entry.name;
    }),
  );

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
    loadUnread();
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
        onLongPress={
          item.status
            ? undefined
            : function () {
                setMenuFor(message);
              }
        }
        reply={message.reply}
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
        <GroupPicker
          groups={groups}
          groupId={filterId}
          onGroupSelect={setFilterId}
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
  if (groupScreen) {
    return (
      <GroupScreen
        group={activeGroup}
        userId={user.id}
        onBack={function () {
          setGroupScreen(false);
        }}
        onLeave={function () {
          setGroupScreen(false);
          closeGroup();
        }}
      />
    );
  }
  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.column}>
        <ChatHeader
          name={activeGroup.name}
          avatarUrl={activeGroup.avatarUrl}
          memberCount={memberCount}
          online={online}
          onBack={closeGroup}
          onSearch={function () {
            setSearchOpen(true);
          }}
          onOpenGroup={function () {
            setGroupScreen(true);
}}
        />

        <KeyboardAvoidingView
          style={styles.chat}
          behavior={keyboardBehavior}
          keyboardVerticalOffset={keyboardOffset}
        >
          {error ? <Text style={styles.error}>{error}</Text> : null}

          {}
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

          {}
          {typing ? <Text style={styles.typing}>{typing}</Text> : null}

          {}
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
            {}
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
  typing: {
    paddingHorizontal: space.md,
    paddingBottom: space.xxs,
    color: paper.inkFaint,
    ...typo.regular,
    fontSize: 12,
    fontStyle: 'italic',
  },

  chat: { flex: 1 },
  list: {
    flexGrow: 1,
    paddingHorizontal: space.md,
    paddingTop: space.md,
    paddingBottom: space.sm,
  },

  olderSpinner: { paddingVertical: space.md, alignItems: 'center' },

  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 4, padding: space.lg },
  emptyTitle: { color: paper.ink, ...typo.display, fontSize: 21 },
  emptyText: {
    color: paper.inkSoft,
    ...typo.regular,
    fontSize: 14,
    textAlign: 'center',
  },
  error: {
    paddingHorizontal: space.md,
    paddingVertical: space.xs,
    color: paper.accent,
    ...typo.medium,
    fontSize: 13,
    textAlign: 'center',
  },

  connection: {
    paddingHorizontal: space.md,
    paddingVertical: space.xs,
    backgroundColor: paper.surfaceAlt,
    color: paper.inkSoft,
    ...typo.medium,
    fontSize: 12,
    textAlign: 'center',
  },
});
