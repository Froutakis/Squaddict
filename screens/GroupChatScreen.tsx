import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { RealtimeChannel, User as AuthUser } from '@supabase/supabase-js';
import {
  ActivityIndicator,
  BackHandler,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import ChatComposer from '../components/chat/ChatComposer';
import ChatTray, { trayHeight } from '../components/chat/ChatTray';
import ChatHeader from '../components/chat/ChatHeader';
import TicketBackdrop from '../components/general/TicketBackdrop';
import ChatVotesBar, { type ChatFilter } from '../components/chat/ChatVotesBar';
import VoteCard from '../components/votes/VoteCard';
import { voteQuestion } from '../lib/squadVote';
import MessageBubble, { DateSeparator } from '../components/chat/MessageBubble';
import MessageMenu from '../components/chat/MessageMenu';
import {
  actionFor,
  chatReactions,
  dropReaction,
  mergeReactions,
  myReaction,
  putReaction,
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
import { directoryOf, mentionIds, toMembers } from '../components/chat/mentions';
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
import { getGroupsForUser, getMemberProfiles } from '../services/serviceGroup';
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
  takePhoto,
  uploadImage,
  type PickedImage,
} from '../services/serviceMedia';
import { closeGroupChat, sendCardsChanged, sendTyping, startChat } from '../services/serviceRealtime';
import { getUserById } from '../services/serviceUser';
import { colors, layout, paper, scrim, typo, space, textSize } from '../theme';
import GroupScreen from './GroupScreen';
import PlanCard from '../components/chat/PlanCard';
import ChatEvent from '../components/chat/ChatEvent';
import { pickChatEvents } from '../components/chat/chatEvents';
import { useChatEvents } from '../components/chat/useChatEvents';
import EventSheet, { type SheetEvent } from '../components/events/EventSheet';
import {
  clearRsvp,
  getMyAnswers,
  getMyEvents,
  setRsvp,
  type MyEvent,
  type RsvpStatus,
} from '../services/serviceEvents';
import { getSuggestions, type PlanSuggestion } from '../services/serviceSuggestions';
import EventFormSheet from '../components/events/EventFormSheet';
import NewVoteSheet, { type Step as VoteStep, type VoteStart } from '../components/votes/NewVoteSheet';
import { eventWindow, isHappeningNow, keyOf, parseLocal } from '../lib/datetime';
import ChatVoteCard from '../components/chat/ChatVoteCard';
import { castOption, castVote, getChatVotes, getVoteMessageId, type SquadVote } from '../services/serviceVotes';
import { errorText } from '../lib/postgres';
import { voteEventToSheet } from '../components/votes/VoteCard';
import { features } from '../lib/features';
import OnMyWayCard from '../components/chat/OnMyWayCard';
import ChatEmpty from '../components/chat/ChatEmpty';
import OnMyWaySheet from '../components/chat/OnMyWaySheet';
import {
  getOnMyWay,
  openLiveMap,
  stopOnMyWay,
  type LivePerson,
  type OnMyWay,
} from '../services/serviceLiveLocation';
import { useLiveLocations } from '../components/events/useLiveLocations';

import {
  clearPhotoReaction,
  getPhotoReactions,
  setPhotoReaction,
  type FeedPhoto,
} from '../services/servicePhotoFeed';
import { applyReaction, type PhotoReaction } from '../lib/photoFeed';
import PostViewer from '../components/home/PostViewer';
import { useSignedImages } from '../components/home/useSignedImages';

// What a vote asks, in a line: the plan's title, or its question.
function voteTitle(vote: SquadVote | undefined): string | null {
  if (!vote) return null;
  if (vote.target.type === 'plan') return vote.target.event.title;
  return voteQuestion(vote.kind, vote.targetName);
}

// Long enough for one sheet to slide away before the next one opens.
const SHEET_SWAP_MS = 350;

// The text of the messages that carry a card (chat_cards.sql), so the chat
// knows which ones to read the card for.
const VOTE_PREFIXES = ['Put to the parea: ', 'Asks the parea: ', 'Puts to a vote: '];
const ON_MY_WAY_PREFIX = 'On my way to ';

function carriesVote(content: string): boolean {
  return VOTE_PREFIXES.some((prefix) => content.startsWith(prefix));
}

const CATCH_UP_LIMIT = 300;

type GroupChatScreenProps = {
  user: AuthUser;
  initialGroupId?: string | null;
  onBack?: () => void;
  onThreadChange?: (open: boolean) => void;
  // When set, leaving the thread goes back to where it was opened from,
  // instead of to the list of squads.
  onExit?: () => void;
  // Votes live in the chat: 'votes' opens it narrowed to them.
  initialFilter?: ChatFilter;
  // A vote another screen asked for (Invite, Follow): its sheet opens at once.
  initialVoteStart?: VoteStart;
  // Opens New plan for this squad. Without it the empty chat offers no plan.
  onNewPlan?: (groupId: string) => void;
};

export default function GroupChatScreen({
  user,
  initialGroupId = null,
  onBack,
  onThreadChange,
  onExit,
  initialFilter = 'all',
  initialVoteStart,
  onNewPlan,
}: GroupChatScreenProps) {
  const [groups, setGroups] = useState<Group[]>([]);
  const [activeId, setActiveId] = useState<string | null>(initialGroupId);
  const [filterId, setFilterId] = useState<string | null>(null);
  const [previews, setPreviews] = useState<Record<string, GroupPreview>>({});
  const [unread, setUnread] = useState<Record<string, number>>({});
  const [mentionCounts, setMentionCounts] = useState<Record<string, number>>({});
  const [displayName, setDisplayName] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [outbox, setOutbox] = useState<OutgoingMessage[]>([]);
  const [memberCount, setMemberCount] = useState(0);
  const [members, setMembers] = useState<Person[]>([]);
  const avatarById = useMemo(
    () => Object.fromEntries(members.map((member) => [member.id, member.avatarUrl ?? null])),
    [members],
  );
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
  // Plans suggested in this chat, by the message that carries each card.
  const [planCards, setPlanCards] = useState<Record<string, PlanSuggestion>>({});
  const [planSaving, setPlanSaving] = useState<string | null>(null);
  const [planError, setPlanError] = useState<string | null>(null);
  const [openPlan, setOpenPlan] = useState<SheetEvent | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [groupScreen, setGroupScreen] = useState(false);
  // All of the chat, or only its votes (what the Votes page was).
  const [filter, setFilter] = useState<ChatFilter>(initialFilter);
  // A pinned vote whose card is not loaded in the chat yet, answered in a sheet.
  const [pinnedVote, setPinnedVote] = useState<SquadVote | null>(null);
  const [pinnedBusy, setPinnedBusy] = useState(false);
  const [pinnedError, setPinnedError] = useState<string | null>(null);
  // The parea a follow / unfollow vote is about, opened from its card.
  const [aboutGroup, setAboutGroup] = useState<Group | null>(null);
  const listRef = useRef<FlatList<Row>>(null);
  // The talk under a vote: the messages that reply to its card.
  const [repliesFor, setRepliesFor] = useState<ChatMessage | null>(null);
  // The + tray, in the keyboard's place, and what it opens.
  const [trayOpen, setTrayOpen] = useState(false);
  const [planFormOpen, setPlanFormOpen] = useState(false);
  // The new-vote sheet, open at this step (the + and the empty chat start votes).
  const [voteStep, setVoteStep] = useState<VoteStep | null>(initialVoteStart?.step ?? null);
  // The parea a follow / unfollow vote is about, when it came picked already.
  const [votePick, setVotePick] = useState<{ id: string; name: string } | null>(initialVoteStart?.pick ?? null);
  // Votes posted in this chat, by the message that carries each card, and
  // your answer on the plans the passed ones made.
  const [chatVotes, setChatVotes] = useState<Record<string, SquadVote>>({});
  const [answers, setAnswers] = useState<Record<string, RsvpStatus>>({});
  const [cardSaving, setCardSaving] = useState<string | null>(null);
  const [justPassed, setJustPassed] = useState<Record<string, boolean>>({});
  // This parea's plans (for tonight's On my way, and the empty chat), and
  // the "on my way" cards by their message.
  const [groupPlans, setGroupPlans] = useState<MyEvent[]>([]);
  const [onMyWay, setOnMyWay] = useState<Record<string, OnMyWay>>({});
  const [wayFor, setWayFor] = useState<MyEvent | null>(null);
  const [watchEventId, setWatchEventId] = useState<string | null>(null);
  const [watchedPeople, setWatchedPeople] = useState<LivePerson[]>([]);
  // Text put in the message field for you ("Who's in tonight?"); a new nonce
  // starts the field again with it.
  const [prefill, setPrefill] = useState({ text: '', nonce: 0 });
  const { height: windowHeight } = useWindowDimensions();
  // The parea's plans, votes and memories, shown in the chat as tickets.
  const chatEvents = useChatEvents(activeId, user.id);
  const [eventSaving, setEventSaving] = useState<string | null>(null);
  const [openMemory, setOpenMemory] = useState<FeedPhoto | null>(null);
  const [memoryReactions, setMemoryReactions] = useState<Record<string, PhotoReaction[]>>({});
  const photos = useSignedImages();
  const namesById = useMemo(
    () => Object.fromEntries(members.map((member) => [member.id, member.name])),
    [members],
  );

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
  const activeIdRef = useRef<string | null>(activeId);
  activeIdRef.current = activeId;
  const reloadCardsRef = useRef<(messageIds: string[]) => void>(function () {
  });
  const typingSentRef = useRef(0);

  // Text put in the field for you is for this chat and this message only.
  function dropPrefill() {
    setPrefill(function (prev) {
      return prev.text === '' ? prev : { text: '', nonce: prev.nonce };
    });
  }

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
          setAvatarUrl(profile.avatarUrl ?? null);
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
      setTrayOpen(false);
      setChatVotes({});
      setAnswers({});
      setJustPassed({});
      setGroupPlans([]);
      setOnMyWay({});
      dropPrefill();
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
    setChatVotes({});
    setAnswers({});
    setJustPassed({});
    setGroupPlans([]);
    setOnMyWay({});
    dropPrefill();
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
        const { names, avatars } = directoryOf(await getMemberProfiles(groupId));
        if (!cancelled) {
          namesRef.current = names;
          membersRef.current = toMembers(names, avatars);
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
        const { names, avatars } = directoryOf(await getMemberProfiles(groupId));
        if (cancelled) {
          return;
        }

        namesRef.current = names;
        membersRef.current = toMembers(names, avatars);
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
          onCards: function (ids) {
            reloadCardsRef.current(ids);
          },
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

  // Android's back closes the tray before it leaves the chat.
  useEffect(() => {
    if (!trayOpen) {
      return;
    }
    const sub = BackHandler.addEventListener('hardwareBackPress', function () {
      setTrayOpen(false);
      return true;
    });
    return function cleanup() {
      sub.remove();
    };
  }, [trayOpen]);

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

  // Library or camera: either way the photo waits in the composer to be sent
  // like any other photo message.
  const choosePhoto = useCallback(async function choose(from: 'library' | 'camera' = 'library') {
    setTrayOpen(false);
    try {
      const picked: PickedImage | null = from === 'camera' ? await takePhoto() : await pickImage();
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
      dropPrefill();
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

  // Tickets only in a chat that has started, and only as far back as the
  // messages loaded so far.
  const oldestLoaded = messages.length > 0 ? messages[0].createdAt : null;
  const eventItems = useMemo(
    function () {
      if (!activeId || oldestLoaded === null) {
        return [];
      }
      const now = new Date();
      // A vote with its own card in the chat (and the plan it made) shows
      // there, not twice.
      const carded = Object.values(chatVotes);
      const cardedVotes = new Set(carded.map((vote) => vote.id));
      const cardedPlans = new Set(carded.map((vote) => vote.payload.event_id).filter(Boolean));
      return pickChatEvents({
        groupId: activeId,
        plans: chatEvents.plans.filter((plan) => !cardedPlans.has(plan.id)),
        openVotes: chatEvents.openVotes.filter((vote) => !cardedVotes.has(vote.id)),
        decidedVotes: chatEvents.decidedVotes.filter((vote) => !cardedVotes.has(vote.id)),
        memories: chatEvents.memories,
        since: hasMore ? oldestLoaded : null,
        now,
        today: keyOf(now),
      });
    },
    [
      activeId,
      oldestLoaded,
      hasMore,
      chatEvents.plans,
      chatEvents.openVotes,
      chatEvents.decidedVotes,
      chatEvents.memories,
      chatVotes,
    ],
  );

  const rows = useMemo(
    function () {
      return buildRows(messages, outbox, { id: user.id, name: displayName }, eventItems);
    },
    [messages, outbox, user.id, displayName, eventItems],
  );

  // The memories' first photos, for their tickets.
  const memoryPaths = eventItems
    .flatMap((item) => (item.kind === 'memory' ? [item.memory.photo, ...item.memory.more].slice(0, 2) : []))
    .map((photo) => photo.path)
    .join('|');
  const signPhotos = photos.signPaths;
  useEffect(() => {
    if (memoryPaths !== '') signPhotos(memoryPaths.split('|'));
  }, [memoryPaths, signPhotos]);

  // The Votes tab: the vote cards and vote tickets only, each day's date kept
  // above the first one left.
  const shownRows = useMemo(
    function () {
      if (filter === 'all') return rows;
      const kept: Row[] = [];
      let day: Row | null = null;
      for (const row of rows) {
        if (row.kind === 'date') {
          day = row;
          continue;
        }
        const isVote =
          (row.kind === 'message' && chatVotes[row.message.id] !== undefined) ||
          (row.kind === 'event' && row.event.kind === 'vote');
        if (!isVote) continue;
        if (day) {
          kept.push(day);
          day = null;
        }
        kept.push(row);
      }
      return kept;
    },
    [rows, filter, chatVotes],
  );

  const invertedRows = useMemo(
    function () {
      return shownRows.slice().reverse();
    },
    [shownRows],
  );

  // How many messages answer each one, for "2 replies" under a vote.
  const repliesTo = useMemo(
    function () {
      const byMessage: Record<string, ChatMessage[]> = {};
      for (const message of messages) {
        if (!message.replyTo || message.deletedAt) continue;
        (byMessage[message.replyTo] ??= []).push(message);
      }
      return byMessage;
    },
    [messages],
  );

  // The parea's open votes, pinned above the chat, newest first.
  const openVotes = useMemo(
    function () {
      return chatEvents.openVotes
        .filter((vote) => vote.groupId === activeId && vote.status === 'open')
        .sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0));
    },
    [chatEvents.openVotes, activeId],
  );

  const filterFor = useRef(activeId);
  useEffect(() => {
    if (filterFor.current === activeId) return;
    filterFor.current = activeId;
    setFilter('all');
  }, [activeId]);

  function showVotes() {
    setGroupScreen(false);
    setFilter('votes');
  }

  // What a vote is about: the parea to follow, or the plan it made.
  function voteOpener(vote: SquadVote): (() => void) | undefined {
    const target = vote.target;
    if (target.type === 'squad') {
      return function () {
        setAboutGroup(target.group);
      };
    }
    if (target.type === 'plan' && target.created) {
      return function () {
        setOpenPlan(voteEventToSheet(target.event));
      };
    }
    return undefined;
  }

  // A pinned vote: to its card when it is loaded, else into a sheet.
  function jumpToVote(vote: SquadVote) {
    const index = invertedRows.findIndex(
      (row) =>
        (row.kind === 'message' && chatVotes[row.message.id]?.id === vote.id) ||
        (row.kind === 'event' && row.event.kind === 'vote' && row.event.vote.id === vote.id),
    );
    if (index === -1) {
      setPinnedError(null);
      setPinnedVote(vote);
      return;
    }
    listRef.current?.scrollToIndex({ index, viewPosition: 0.5, animated: true });
  }

  async function answerPinned(choice: { approve: boolean } | { optionId: string }) {
    if (!pinnedVote || pinnedBusy) return;
    setPinnedBusy(true);
    setPinnedError(null);
    const voteId = pinnedVote.id;
    try {
      if ('approve' in choice) await castVote(voteId, choice.approve);
      else await castOption(voteId, choice.optionId);
      setPinnedVote(null);
      chatEvents.reload();
      // Its card, wherever it is loaded, reads the new count.
      const messageId = await getVoteMessageId(voteId);
      if (messageId) {
        loadChatVotes([messageId]);
        cardsChanged([messageId]);
      }
    } catch (problem) {
      setPinnedError(errorText(problem, 'Could not save your vote. Try again.'));
    } finally {
      setPinnedBusy(false);
    }
  }

  // A suggested plan's message reads "Suggests: …" (suggest_plan): when one
  // comes in, the cards are read again. Without plans_by_vote.sql there are
  // none and those messages stay plain text.
  const suggestionKey = messages
    .filter((message) => message.content.startsWith('Suggests: '))
    .map((message) => message.id)
    .join(',');

  const loadPlanCards = useCallback(
    async function loadPlanCards() {
      if (!activeId) {
        setPlanCards({});
        return;
      }
      const forGroup = activeId;
      const list = await getSuggestions(forGroup);
      const byMessage: Record<string, PlanSuggestion> = {};
      for (const one of list) {
        if (one.messageId) byMessage[one.messageId] = one;
      }
      setPlanCards(byMessage);
    },
    [activeId],
  );

  useEffect(() => {
    if (suggestionKey === '') {
      setPlanCards({});
      return;
    }
    loadPlanCards();
  }, [suggestionKey, loadPlanCards]);

  // Votes put to the parea from the chat: their messages read "Put to the
  // parea: …" or "Asks the parea: …". Without chat_cards.sql there are no
  // cards and those messages stay plain text.
  const voteKey = messages
    .filter((message) => message.deletedAt === null && carriesVote(message.content))
    .map((message) => message.id)
    .join(',');

  const loadChatVotes = useCallback(
    async function loadChatVotes(messageIds: string[]) {
      const forGroup = activeIdRef.current;
      if (!forGroup || messageIds.length === 0) {
        return;
      }
      const found = await getChatVotes(forGroup, user.id, messageIds);
      if (activeIdRef.current !== forGroup) {
        return;
      }
      setChatVotes(function (prev) {
        const next = { ...prev };
        for (const id of messageIds) {
          if (found[id]) next[id] = found[id];
        }
        return next;
      });

      const made = Object.values(found)
        .map((vote) => (vote.target.type === 'plan' && vote.status === 'passed' ? vote.target.event.id : ''))
        .filter((id) => id !== '');
      if (made.length === 0) {
        return;
      }
      try {
        const mine = await getMyAnswers(made);
        if (activeIdRef.current !== forGroup) {
          return;
        }
        setAnswers(function (prev) {
          const next = { ...prev };
          for (const id of made) {
            if (mine[id]) next[id] = mine[id];
            else delete next[id];
          }
          return next;
        });
      } catch {
      }
    },
    [user.id],
  );

  reloadCardsRef.current = function (ids: string[]) {
    loadChatVotes(ids.filter((id) => voteKey.includes(id)));
    loadOnMyWay(ids.filter((id) => wayKey.includes(id)));
  };

  useEffect(() => {
    if (voteKey === '') {
      return;
    }
    loadChatVotes(voteKey.split(','));
  }, [voteKey, loadChatVotes]);

  // The parea's plans you can see: tonight's (On my way) and the next one.
  const loadGroupPlans = useCallback(
    async function loadGroupPlans() {
      const forGroup = activeIdRef.current;
      if (!forGroup) {
        return;
      }
      try {
        const mine = await getMyEvents(user.id);
        if (activeIdRef.current === forGroup) {
          setGroupPlans(mine.filter((event) => event.groupId === forGroup));
        }
      } catch {
      }
    },
    [user.id],
  );

  useEffect(() => {
    if (activeId) {
      loadGroupPlans();
    }
  }, [activeId, loadGroupPlans]);

  const wayKey = features.liveLocation
    ? messages
        .filter((message) => message.deletedAt === null && message.content.startsWith(ON_MY_WAY_PREFIX))
        .map((message) => message.id)
        .join(',')
    : '';

  const loadOnMyWay = useCallback(async function loadOnMyWay(messageIds: string[]) {
    const forGroup = activeIdRef.current;
    if (!forGroup || messageIds.length === 0) {
      return;
    }
    const found = await getOnMyWay(forGroup, messageIds);
    if (activeIdRef.current !== forGroup) {
      return;
    }
    setOnMyWay(function (prev) {
      const next = { ...prev };
      for (const id of messageIds) {
        if (found[id]) next[id] = found[id];
      }
      return next;
    });
  }, []);

  useEffect(() => {
    if (wayKey === '') {
      return;
    }
    loadOnMyWay(wayKey.split(','));
  }, [wayKey, loadOnMyWay]);

  const today = keyOf(new Date());

  // Still sharing: not stopped, and the plan's night is not over.
  function wayIsLive(way: OnMyWay): boolean {
    if (way.stoppedAt) return false;
    return way.event.date === today || isHappeningNow(way.event.date, way.event.startTime, way.event.endTime);
  }

  // Your own live "on my way": your spot goes to the plan's map while the
  // chat is open (Home shares it too once the plan is on).
  const myWay = Object.values(onMyWay).find((way) => way.userId === user.id && wayIsLive(way)) ?? null;
  const sharingEventId = features.liveLocation && myWay ? myWay.event.id : undefined;
  const livePeople = useLiveLocations(sharingEventId, { id: user.id, name: displayName });

  // "See on the map" on someone else's card: watch the plan's map without
  // sharing your own spot.
  useEffect(() => {
    setWatchedPeople([]);
    if (!features.liveLocation || !watchEventId || watchEventId === sharingEventId || !displayName) {
      return;
    }
    const live = openLiveMap(watchEventId, { id: user.id, name: displayName }, setWatchedPeople);
    return function cleanup() {
      live.close();
    };
  }, [watchEventId, sharingEventId, user.id, displayName]);

  // Tonight's plan of this parea that you are in on, until it is over.
  const tonightPlan =
    groupPlans.find(
      (event) =>
        event.date === today &&
        event.myStatus === 'in' &&
        eventWindow(event.date, event.startTime, event.endTime).endsAt > new Date(),
    ) ?? null;
  const tonightWay = tonightPlan && myWay && myWay.event.id === tonightPlan.id ? myWay : null;

  // The parea's next plan for the empty chat: tonight's you are in on first,
  // else the next one still ahead.
  const nextPlan =
    tonightPlan ??
    groupPlans.find(
      (event) => event.date >= today && eventWindow(event.date, event.startTime, event.endTime).endsAt > new Date(),
    ) ??
    null;

  // "Who's in tonight?" goes into the field, mentioning whoever has not
  // answered the plan yet (everyone, without a plan).
  function askWhosIn() {
    const answered = new Set((nextPlan?.going ?? []).map((person) => person.id));
    const ask = nextPlan
      ? members.filter((member) => member.id !== user.id && !answered.has(member.id))
      : members.filter((member) => member.id !== user.id);
    const mentions = ask
      .slice(0, 6)
      .map((member) => '@' + member.name)
      .join(' ');
    const question = !nextPlan
      ? "who's free this week?"
      : nextPlan.date === today
        ? `who's in for ${nextPlan.title} tonight?`
        : `who's in for ${nextPlan.title} on ${parseLocal(nextPlan.date).toLocaleDateString('en-US', { weekday: 'long' })}?`;
    const text = mentions ? `${mentions} ${question}` : question.charAt(0).toUpperCase() + question.slice(1);
    setEditing(null);
    setTrayOpen(false);
    setPrefill(function (prev) {
      return { text, nonce: prev.nonce + 1 };
    });
  }

  // Messages the database posted for you (a vote, a suggestion, on my way)
  // come in through realtime too; this reads them now, so the card is there
  // even when the connection is slow.
  const pullNew = useCallback(
    async function pullNew() {
      const forGroup = activeIdRef.current;
      if (!forGroup) {
        return;
      }
      const latest = messagesRef.current[messagesRef.current.length - 1];
      try {
        const page = latest
          ? await getMessagesAfter(forGroup, latest.createdAt)
          : await getMessages(forGroup);
        if (activeIdRef.current !== forGroup) {
          return;
        }
        setMessages(function (prev) {
          return resolveQuotes(mergeNewMessages(prev, page.messages));
        });
      } catch {
      }
    },
    [],
  );

  // Tells the others' chats to read a card again.
  function cardsChanged(messageIds: string[]) {
    const channel = channelRef.current;
    if (channel) {
      sendCardsChanged(channel, messageIds);
    }
  }

  async function answerVote(messageId: string, vote: SquadVote, choice: { approve: boolean } | { optionId: string }) {
    if (cardSaving) return;
    setCardSaving(messageId);
    setPlanError(null);
    try {
      const status =
        'approve' in choice ? await castVote(vote.id, choice.approve) : await castOption(vote.id, choice.optionId);
      if (status === 'passed' && vote.status === 'open') {
        setJustPassed(function (prev) {
          return { ...prev, [messageId]: true };
        });
        // A plan was made: it may be the parea's next one now.
        loadGroupPlans();
      }
      await loadChatVotes([messageId]);
      cardsChanged([messageId]);
    } catch (problem) {
      setPlanError(errorText(problem, 'Could not save your vote. Try again.'));
      loadChatVotes([messageId]);
    } finally {
      setCardSaving(null);
    }
  }

  // I'm in / Pass on the plan a vote made. Personal, not a vote.
  async function answerMadePlan(messageId: string, eventId: string, status: RsvpStatus | null) {
    if (cardSaving) return;
    setCardSaving(messageId);
    setPlanError(null);
    const before = answers[eventId];
    setAnswers(function (prev) {
      const next = { ...prev };
      if (status) next[eventId] = status;
      else delete next[eventId];
      return next;
    });
    try {
      if (status) await setRsvp(eventId, status);
      else await clearRsvp(eventId);
      loadGroupPlans();
    } catch {
      setAnswers(function (prev) {
        const next = { ...prev };
        if (before) next[eventId] = before;
        else delete next[eventId];
        return next;
      });
      setPlanError('Could not save your answer. Try again.');
    } finally {
      setCardSaving(null);
    }
  }

  let activeGroup: Group | null = null;
  let activeGroupName = '';
  for (let i = 0; i < groups.length; i++) {
    if (groups[i].id === activeId) {
      activeGroup = groups[i];
      activeGroupName = groups[i].name;
      break;
    }
  }

  const typing = typingLabel(
    activeTypists(typists, Date.now()).map(function (entry) {
      return entry.name;
    }),
  );

  // Back, Android's back button and Esc on the web: a reply or an edit is
  // let go first, then the tray, then the Votes tab, then the chat closes.
  const backRef = useRef<() => boolean>(() => false);
  backRef.current = function back() {
    if (aboutGroup) {
      setAboutGroup(null);
      return true;
    }
    if (groupScreen) {
      setGroupScreen(false);
      return true;
    }
    if (editing || replyingTo) {
      setEditing(null);
      setReplyingTo(null);
      return true;
    }
    if (trayOpen) {
      setTrayOpen(false);
      return true;
    }
    if (filter === 'votes') {
      setFilter('all');
      return true;
    }
    if (activeId !== null || onExit) {
      closeGroup();
      return true;
    }
    return false;
  };
  // Esc that a sheet or the photo viewer is open for is theirs, not ours.
  const overlayOpenRef = useRef(false);
  overlayOpenRef.current =
    menuFor !== null ||
    viewing !== null ||
    searchOpen ||
    openPlan !== null ||
    openMemory !== null ||
    repliesFor !== null ||
    pinnedVote !== null ||
    voteStep !== null ||
    planFormOpen ||
    wayFor !== null;

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', function () {
      return backRef.current();
    });
    return function cleanup() {
      sub.remove();
    };
  }, []);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') {
      return;
    }
    function onKey(event: KeyboardEvent) {
      // The composer handles its own Esc first (it closes the mention list).
      if (event.key !== 'Escape' || event.defaultPrevented || overlayOpenRef.current) {
        return;
      }
      if (backRef.current()) {
        event.preventDefault();
      }
    }
    window.addEventListener('keydown', onKey);
    return function cleanup() {
      window.removeEventListener('keydown', onKey);
    };
  }, []);

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
    if (onExit) {
      onExit();
      return;
    }
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

  // Answering a suggested plan right in the chat. Personal, not a vote.
  async function answerPlan(plan: PlanSuggestion, status: RsvpStatus | null) {
    if (planSaving) return;
    setPlanSaving(plan.event.id);
    setPlanError(null);
    try {
      if (status) await setRsvp(plan.event.id, status);
      else await clearRsvp(plan.event.id);
      await loadPlanCards();
      loadGroupPlans();
    } catch {
      setPlanError('Could not save your answer. Try again.');
    } finally {
      setPlanSaving(null);
    }
  }

  // I'm in / Pass on the next plan, from the empty chat.
  async function answerNextPlan(plan: MyEvent, status: RsvpStatus | null) {
    setPlanError(null);
    setGroupPlans(function (prev) {
      return prev.map((event) => (event.id === plan.id ? { ...event, myStatus: status ?? undefined } : event));
    });
    try {
      if (status) await setRsvp(plan.id, status);
      else await clearRsvp(plan.id);
    } catch {
      setPlanError('Could not save your answer. Try again.');
    }
    loadGroupPlans();
  }

  async function stopSharing(messageId: string) {
    if (cardSaving) return;
    setCardSaving(messageId);
    setPlanError(null);
    try {
      await stopOnMyWay(messageId);
      await loadOnMyWay([messageId]);
      cardsChanged([messageId]);
    } catch (problem) {
      setPlanError(errorText(problem, 'Could not stop sharing. Try again.'));
    } finally {
      setCardSaving(null);
    }
  }

  // I'm in / Pass on a plan's ticket: shown at once, put back if it fails.
  async function answerEvent(plan: MyEvent, status: RsvpStatus | null) {
    if (eventSaving) return;
    const before = chatEvents.plans;
    setEventSaving(plan.id);
    setPlanError(null);
    chatEvents.setPlans(function (list) {
      return list.map(function (one) {
        if (one.id !== plan.id) return one;
        const others = one.going.filter((person) => person.id !== user.id);
        return {
          ...one,
          myStatus: status ?? undefined,
          going: status === 'in' ? [...others, { id: user.id, name: displayName, avatarUrl }] : others,
        };
      });
    });
    try {
      if (status) await setRsvp(plan.id, status);
      else await clearRsvp(plan.id);
    } catch {
      chatEvents.setPlans(() => before);
      setPlanError('Could not save your answer. Try again.');
    } finally {
      setEventSaving(null);
    }
  }

  function openMemoryPost(memory: FeedPhoto) {
    setOpenMemory(memory);
    const photoId = memory.photo.id;
    getPhotoReactions([photoId])
      .then(function (byPhoto) {
        setMemoryReactions(function (prev) {
          return { ...prev, [photoId]: byPhoto[photoId] ?? [] };
        });
      })
      .catch(function () {
      });
  }

  async function reactToMemory(memory: FeedPhoto, emoji: string) {
    const photoId = memory.photo.id;
    const before = memoryReactions[photoId] ?? [];
    const after = applyReaction(
      before,
      photoId,
      { userId: user.id, name: displayName, avatarUrl, groupId: memory.group.id, groupName: memory.group.name },
      emoji,
    );
    setMemoryReactions(function (prev) {
      return { ...prev, [photoId]: after };
    });
    try {
      if (after.length < before.length) await clearPhotoReaction(photoId);
      else await setPhotoReaction(photoId, memory.group.id, emoji);
    } catch {
      setMemoryReactions(function (prev) {
        return { ...prev, [photoId]: before };
      });
      setError('Could not save your reaction. Try again.');
    }
  }

  function renderRow({ item }: { item: Row }) {
    if (item.kind === 'date') {
      return <DateSeparator label={item.label} day={item.day} today={item.today} />;
    }

    if (item.kind === 'event') {
      const event = item.event;
      const thumbs =
        event.kind === 'memory'
          ? [event.memory.photo, ...event.memory.more].slice(0, 2).map((photo) => photos.signed[photo.path]?.url)
          : undefined;
      return (
        <ChatEvent
          item={event}
          userId={user.id}
          names={namesById}
          members={memberCount}
          thumbs={thumbs}
          onAnswer={answerEvent}
          onOpenPlan={function (plan) {
            setOpenPlan(plan);
          }}
          onOpenVotes={showVotes}
          onOpenMemory={openMemoryPost}
        />
      );
    }

    const message = item.message;
    const isMine = message.senderId === user.id;
    const photoUri =
      item.image?.uri ??
      (message.attachment ? signed[message.attachment.path]?.url ?? null : null);
    const plan = planCards[message.id];
    const vote = chatVotes[message.id];
    const way = features.liveLocation ? onMyWay[message.id] : undefined;
    const cardMenu = item.status
      ? undefined
      : function () {
          setMenuFor(message);
        };

    const bubble = (
      <MessageBubble
        content={message.content}
        senderName={message.senderName}
        senderAvatar={avatarById[message.senderId] ?? null}
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
        card={
          way ? (
            <OnMyWayCard
              card={way}
              mine={way.userId === user.id}
              senderName={message.senderName}
              live={wayIsLive(way)}
              busy={cardSaving === message.id}
              onStop={function () {
                stopSharing(message.id);
              }}
              onOpenMap={function () {
                setWatchEventId(way.event.id);
                setOpenPlan({
                  ...way.event,
                  groupId: way.groupId,
                  groupName: activeGroupName,
                  isMember: true,
                });
              }}
            />
          ) : vote ? (
            <ChatVoteCard
              vote={vote}
              members={memberCount}
              people={members}
              userId={user.id}
              busy={cardSaving === message.id}
              going={vote.target.type === 'plan' && vote.target.event.id ? answers[vote.target.event.id] : undefined}
              justPassed={justPassed[message.id] === true}
              onVote={function (approve) {
                answerVote(message.id, vote, { approve });
              }}
              onPick={function (optionId) {
                answerVote(message.id, vote, { optionId });
              }}
              onGoing={function (status) {
                if (vote.target.type === 'plan' && vote.target.event.id) {
                  answerMadePlan(message.id, vote.target.event.id, status);
                }
              }}
              onLongPress={cardMenu}
              onOpen={voteOpener(vote)}
              onStale={function () {
                loadChatVotes([message.id]);
              }}
              onOpenPlan={
                vote.target.type === 'plan' && vote.target.event.id
                  ? function () {
                      if (vote.target.type === 'plan') setOpenPlan(voteEventToSheet(vote.target.event));
                    }
                  : undefined
              }
            />
          ) : plan ? (
            <PlanCard
              plan={plan}
              saving={planSaving === plan.event.id}
              onAnswer={(status) => answerPlan(plan, status)}
              onOpen={() => setOpenPlan(plan.event)}
              onLongPress={cardMenu}
            />
          ) : undefined
        }
        reactions={chatReactions(reactions[message.id], user.id)}
        highlighted={replyingTo !== null && replyingTo.id === message.id}
        onToggleReaction={
          item.status
            ? undefined
            : function (emoji) {
                toggleReaction(message.id, emoji);
              }
        }
      />
    );
    if (!vote || item.status) return bubble;

    // Under a vote: its talk, a tap away.
    const replies = repliesTo[message.id] ?? [];
    return (
      <View>
        {bubble}
        <Pressable
          onPress={function () {
            setRepliesFor(message);
          }}
          accessibilityRole="button"
          accessibilityLabel={replies.length > 0 ? `${replies.length} ${replies.length === 1 ? 'reply' : 'replies'} to this vote` : 'Reply to this vote'}
          hitSlop={6}
          style={({ pressed }) => [styles.voteTalk, isMine && styles.voteTalkMine, pressed && styles.voteTalkPressed]}
        >
          <Text style={styles.voteTalkText}>
            {replies.length > 0 ? `${replies.length} ${replies.length === 1 ? 'reply' : 'replies'} ›` : 'Reply ›'}
          </Text>
        </Pressable>
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
          avatarUrl={avatarUrl}
          onSelect={openGroup}
          onBack={onExit ?? onBack}
        />

      </SafeAreaView>
    );
  }
  if (aboutGroup) {
    return (
      <GroupScreen
        group={aboutGroup}
        userId={user.id}
        backLabel="Chat"
        onOpenVotes={showVotes}
        onBack={function () {
          setAboutGroup(null);
        }}
        onLeave={function () {
          setAboutGroup(null);
        }}
      />
    );
  }
  if (groupScreen) {
    return (
      <GroupScreen
        group={activeGroup}
        userId={user.id}
        backLabel="Chat"
        onOpenVotes={showVotes}
        onBack={function () {
          setGroupScreen(false);
        }}
        onLeave={function () {
          setGroupScreen(false);
          closeGroup();
        }}
        onChange={function (fresh) {
          setGroups(function (prev) {
            return prev.map((g) => (g.id === fresh.id ? fresh : g));
          });
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
          typing={typing}
          connection={connectionLabel(connection)}
          backLabel={onExit ? `Close chat, back to ${activeGroup.name}` : 'Back to squads'}
          onBack={closeGroup}
          onSearch={function () {
            setSearchOpen(true);
          }}
          onOpenGroup={function () {
            setGroupScreen(true);
          }}
        />

        {rows.length > 0 || openVotes.length > 0 ? (
          <ChatVotesBar
            filter={filter}
            onFilter={setFilter}
            open={openVotes}
            members={memberCount}
            onJump={jumpToVote}
          />
        ) : null}

        <KeyboardAvoidingView
          style={styles.chat}
          behavior={keyboardBehavior}
          keyboardVerticalOffset={keyboardOffset}
        >
          {/* Faint ticket stubs behind the messages. */}
          <TicketBackdrop />
          {error ? (
            <Text style={styles.error} accessibilityLiveRegion="polite">
              {error}
            </Text>
          ) : null}
          {planError ? (
            <Text style={styles.error} accessibilityLiveRegion="polite">
              {planError}
            </Text>
          ) : null}

          {loadingChat ? (
            <View style={styles.empty}>
              <ActivityIndicator color={paper.accent} />
            </View>
          ) : rows.length === 0 ? (
            error ? (
              <View style={styles.empty} />
            ) : (
              <ChatEmpty
                plan={nextPlan}
                meId={user.id}
                compact={windowHeight < 720}
                onOnMyWay={
                  features.liveLocation && tonightPlan
                    ? function () {
                        setWayFor(tonightPlan);
                      }
                    : undefined
                }
                onOpenPlan={function (plan) {
                  setOpenPlan(plan);
                }}
                onAnswer={answerNextPlan}
                onAsk={askWhosIn}
                onProposePlan={function () {
                  setTrayOpen(false);
                  setPlanFormOpen(true);
                }}
                onAskParea={function () {
                  setTrayOpen(false);
                  setVoteStep('poll');
                }}
                onSharePhoto={function () {
                  setTrayOpen(true);
                }}
              />
            )
          ) : filter === 'votes' && invertedRows.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.votesEmptyTitle}>No votes here yet.</Text>
              <Text style={styles.votesEmptyText}>Start one from the + below. More than half decides.</Text>
            </View>
          ) : (
            <FlatList
              ref={listRef}
              inverted
              onScrollToIndexFailed={function (info) {
                listRef.current?.scrollToOffset({ offset: info.averageItemLength * info.index, animated: true });
              }}
              keyboardShouldPersistTaps="handled"
              onScrollBeginDrag={function () {
                setTrayOpen(false);
              }}
              data={invertedRows}
              keyExtractor={function (item) {
                return item.id;
              }}
              contentContainerStyle={styles.list}
              onEndReached={loadOlder}
              onEndReachedThreshold={0.5}
              ListFooterComponent={renderOlderSpinner()}
              renderItem={renderRow}
            />
          )}

          <ChatComposer
            placeholder={`Message ${activeGroup.name}`}
            key={editing ? 'edit-' + editing.id : 'new-' + prefill.nonce}
            initialText={editing ? editing.content : prefill.text}
            autoFocus={!editing && prefill.text !== ''}
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
            onClearImage={function () {
              if (pendingImage) {
                discardImage(pendingImage.uri);
              }
              setPendingImage(null);
            }}
            trayOpen={trayOpen}
            onToggleTray={function () {
              setTrayOpen(function (open) {
                return !open;
              });
            }}
            onFocusInput={function () {
              setTrayOpen(false);
            }}
            disabled={!activeId}
          />

          {trayOpen ? (
            <ChatTray
              height={trayHeight(windowHeight)}
              compact={windowHeight < 720}
              tonight={
                tonightPlan
                  ? {
                      title: tonightPlan.title,
                      kicker: tonightPlan.startTime ? `Tonight · ${tonightPlan.startTime}` : 'Tonight',
                    }
                  : null
              }
              sharing={tonightWay !== null}
              onOnMyWay={
                features.liveLocation && tonightPlan
                  ? function () {
                      setTrayOpen(false);
                      if (tonightWay?.messageId) {
                        stopSharing(tonightWay.messageId);
                      } else {
                        setWayFor(tonightPlan);
                      }
                    }
                  : undefined
              }
              onOpenTonight={
                tonightPlan
                  ? function () {
                      setTrayOpen(false);
                      setOpenPlan(tonightPlan);
                    }
                  : undefined
              }
              onCamera={function () {
                choosePhoto('camera');
              }}
              onLibrary={function () {
                choosePhoto('library');
              }}
              onProposePlan={function () {
                setTrayOpen(false);
                setPlanFormOpen(true);
              }}
              onAskParea={function () {
                setTrayOpen(false);
                setVoteStep('poll');
              }}
              onStartVote={function (step) {
                setTrayOpen(false);
                setVoteStep(step);
              }}
              canFollow={features.squadFollows}
            />
          ) : null}

          <MessageMenu
            message={menuFor}
            myEmoji={menuFor ? myReaction(reactions[menuFor.id], user.id) : null}
            canEdit={
              menuFor
                ? menuFor.senderId === user.id &&
                  !chatVotes[menuFor.id] &&
                  !planCards[menuFor.id] &&
                  !onMyWay[menuFor.id]
                : false
            }
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
              dropPrefill();
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

          <EventSheet
            event={openPlan}
            currentUserId={user.id}
            livePeople={
              openPlan && openPlan.id === sharingEventId
                ? livePeople
                : openPlan && openPlan.id === watchEventId
                  ? watchedPeople
                  : undefined
            }
            onClose={function () {
              setOpenPlan(null);
              setWatchEventId(null);
            }}
            onChanged={function () {
              loadPlanCards();
              loadGroupPlans();
              chatEvents.reload();
            }}
          />

          <EventFormSheet
            visible={planFormOpen}
            groups={groups}
            defaultGroupId={activeGroup.id}
            defaultDate={keyOf(new Date())}
            onClose={function () {
              setPlanFormOpen(false);
            }}
            onSaved={function () {
              // The vote's card in the chat is the confirmation.
              setPlanFormOpen(false);
              pullNew();
            }}
            onOpenVotes={showVotes}
          />

          {features.liveLocation ? (
            <OnMyWaySheet
              plan={wayFor}
              onClose={function () {
                setWayFor(null);
              }}
              onShared={function () {
                setWayFor(null);
                pullNew();
              }}
            />
          ) : null}

          {/* The talk under a vote. */}
          <Modal
            visible={repliesFor !== null}
            transparent
            animationType="slide"
            onRequestClose={function () {
              setRepliesFor(null);
            }}
          >
            <Pressable
              style={styles.pinnedBackdrop}
              onPress={function () {
                setRepliesFor(null);
              }}
              accessibilityRole="button"
              accessibilityLabel="Close"
            >
              <Pressable style={styles.pinnedSheet} onPress={function () {}}>
                <View style={styles.pinnedGrabber} />
                <Text style={styles.talkTitle}>About this vote</Text>
                {repliesFor ? (
                  <View style={styles.talkQuote}>
                    <Text style={styles.talkQuoteText} numberOfLines={2}>
                      {voteTitle(chatVotes[repliesFor.id]) ?? repliesFor.content}
                    </Text>
                  </View>
                ) : null}
                <ScrollView style={styles.talkList} contentContainerStyle={styles.talkListInner}>
                  {repliesFor && (repliesTo[repliesFor.id] ?? []).length > 0 ? (
                    (repliesTo[repliesFor.id] ?? []).map(function (reply) {
                      return (
                        <View key={reply.id} style={styles.talkRow}>
                          <Text style={styles.talkWho}>{reply.senderId === user.id ? 'You' : reply.senderName || 'Someone'}</Text>
                          <Text style={styles.talkText}>{reply.content}</Text>
                        </View>
                      );
                    })
                  ) : (
                    <Text style={styles.votesEmptyText}>Nothing said about it yet. Start the talk.</Text>
                  )}
                </ScrollView>
                <Pressable
                  onPress={function () {
                    const target = repliesFor;
                    setRepliesFor(null);
                    if (target) {
                      setEditing(null);
                      setTrayOpen(false);
                      setReplyingTo(target);
                    }
                  }}
                  accessibilityRole="button"
                  accessibilityLabel="Reply to this vote"
                  style={({ pressed }) => [styles.talkReply, pressed && styles.voteTalkPressed]}
                >
                  <Text style={styles.talkReplyText}>Reply</Text>
                </Pressable>
              </Pressable>
            </Pressable>
          </Modal>

          {/* A pinned vote further up than the chat has loaded. */}
          <Modal
            visible={pinnedVote !== null}
            transparent
            animationType="slide"
            onRequestClose={function () {
              setPinnedVote(null);
            }}
          >
            <Pressable
              style={styles.pinnedBackdrop}
              onPress={function () {
                setPinnedVote(null);
              }}
              accessibilityRole="button"
              accessibilityLabel="Close"
            >
              <Pressable style={styles.pinnedSheet} onPress={function () {}}>
                <View style={styles.pinnedGrabber} />
                {pinnedVote ? (
                  <VoteCard
                    vote={pinnedVote}
                    members={memberCount}
                    userId={user.id}
                    busy={pinnedBusy}
                    onYes={function () {
                      answerPinned({ approve: true });
                    }}
                    onNo={function () {
                      answerPinned({ approve: false });
                    }}
                    onPick={function (optionId) {
                      answerPinned({ optionId });
                    }}
                    onStale={chatEvents.reload}
                    onOpen={(function () {
                      const open = voteOpener(pinnedVote);
                      return open
                        ? function () {
                            setPinnedVote(null);
                            setTimeout(open, SHEET_SWAP_MS);
                          }
                        : undefined;
                    })()}
                  />
                ) : null}
                {pinnedError ? (
                  <Text style={styles.error} accessibilityLiveRegion="polite">
                    {pinnedError}
                  </Text>
                ) : null}
              </Pressable>
            </Pressable>
          </Modal>

          <NewVoteSheet
            visible={voteStep !== null}
            group={activeGroup}
            userId={user.id}
            initialStep={voteStep ?? 'menu'}
            initialPick={votePick}
            onClose={function () {
              setVoteStep(null);
              setVotePick(null);
            }}
            onStarted={function () {
              setVoteStep(null);
              setVotePick(null);
              pullNew();
            }}
            onNewPlan={function () {
              setVoteStep(null);
              setVotePick(null);
              // iOS can't open a sheet while another one is still closing.
              setTimeout(function () {
                setPlanFormOpen(true);
              }, SHEET_SWAP_MS);
            }}
          />

          <PostViewer
            item={openMemory}
            reactions={openMemory ? memoryReactions[openMemory.photo.id] ?? [] : []}
            userId={user.id}
            signed={photos.signed}
            signPaths={photos.signPaths}
            onImageError={photos.dropSigned}
            onReact={function (emoji) {
              if (openMemory) reactToMemory(openMemory, emoji);
            }}
            onClose={function () {
              setOpenMemory(null);
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

  chat: { flex: 1 },
  // Inverted: the bottom padding is the top of the chat, under the header's fade.
  list: {
    flexGrow: 1,
    paddingHorizontal: space.md - 2,
    paddingTop: space.md,
    paddingBottom: space.lg,
  },

  olderSpinner: { paddingVertical: space.md, alignItems: 'center' },

  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 4, padding: space.lg },
  votesEmptyTitle: { color: paper.ink, ...typo.display, fontSize: 20, letterSpacing: -0.4, textAlign: 'center' },
  votesEmptyText: { color: paper.inkSoft, ...typo.regular, fontSize: textSize.base, textAlign: 'center' },
  pinnedBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: scrim.sheet },
  pinnedSheet: {
    gap: space.sm,
    paddingHorizontal: space.md,
    paddingTop: space.sm,
    paddingBottom: space.xl,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    backgroundColor: paper.bg,
  },
  voteTalk: { alignSelf: 'flex-start', marginLeft: 36, marginTop: 2, paddingVertical: 4, paddingHorizontal: 2 },
  voteTalkMine: { alignSelf: 'flex-end', marginLeft: 0, marginRight: 2 },
  voteTalkPressed: { opacity: 0.6 },
  voteTalkText: { color: paper.accent, ...typo.bold, fontSize: textSize.small },
  talkTitle: { color: paper.ink, ...typo.display, fontSize: 18, letterSpacing: -0.3 },
  talkQuote: {
    paddingVertical: space.xs + 2,
    paddingHorizontal: space.sm + 1,
    borderLeftWidth: 3,
    borderLeftColor: paper.accent,
    borderRadius: 10,
    backgroundColor: paper.surface,
  },
  talkQuoteText: { color: paper.ink, ...typo.semi, fontSize: textSize.base },
  talkList: { maxHeight: 320 },
  talkListInner: { gap: space.sm, paddingVertical: space.xs },
  talkRow: { gap: 2 },
  talkWho: { color: paper.inkSoft, ...typo.bold, fontSize: textSize.small },
  talkText: { color: paper.ink, ...typo.regular, fontSize: textSize.base, lineHeight: 20 },
  talkReply: {
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: paper.ink,
  },
  talkReplyText: { color: paper.onMine, ...typo.bold, fontSize: textSize.base },
  pinnedGrabber: { alignSelf: 'center', width: 40, height: 5, borderRadius: 3, backgroundColor: colors.borderStrong },
  error: {
    paddingHorizontal: space.md,
    paddingVertical: space.xs,
    color: paper.accent,
    ...typo.medium,
    fontSize: 13,
    textAlign: 'center',
  },
});
