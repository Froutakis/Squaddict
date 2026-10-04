import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { User as AuthUser } from '@supabase/supabase-js';
import {
  ActivityIndicator,
  Animated,
  AppState,
  Pressable,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { Group } from '../services/serviceGroup';
import type { EventCover, MyEvent, RsvpStatus } from '../services/serviceEvents';
import { getActingGroupId, getUserById, setActingGroup } from '../services/serviceUser';
import { pickActing } from '../lib/acting';
import { isSquadPlan } from '../lib/squadVote';
import { getGroupsForUser } from '../services/serviceGroup';
import { getPareaGoing, type PareaGoing } from '../services/serviceFeed';
import { getUnreadCounts } from '../services/serviceChat';
import ShowMore, { visibleSlice } from '../components/general/ShowMore';
import {
  checkIn as saveCheckIn,
  clearRsvp,
  getCheckins,
  getEventCovers,
  getMyEvents,
  setRsvp,
} from '../services/serviceEvents';
import { colors, typo, layout, space, textSize } from '../theme';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import {
  addDays,
  countdownLabel,
  dayFilterLabel,
  inPhotoWindow,
  isHappeningNow,
  keyOf,
  liveLabel,
  parseDateKey,
} from '../lib/datetime';
import HomeHeader from '../components/home/HomeHeader';
import { getPendingVoteCounts } from '../services/serviceVotes';
import VotesScreen from './VotesScreen';
import { voteEventToSheet } from '../components/votes/VoteCard';
import CalendarScreen from './CalendarScreen';
import { useNow } from '../components/home/useNow';
import MemoriesBar from '../components/home/MemoriesBar';
import { useSignedImages } from '../components/home/useSignedImages';
import PhotoPrompt from '../components/home/PhotoPrompt';
import PhotoFeed from '../components/home/PhotoFeed';
import PlanLine from '../components/home/PlanLine';
import { TimelineRow } from '../components/home/Timeline';
import type { FeedPhoto } from '../services/servicePhotoFeed';
import GroupScreen from './GroupScreen';
import { MEMORY_LIMIT, toMemoryNights, type MemoryNight } from '../components/home/memories';
import DayPlansSheet from '../components/home/DayPlansSheet';
import StoryViewer from '../components/events/StoryViewer';
import SectionHead from '../components/general/SectionHead';
import Button from '../components/general/Button';
import EventCard, { type CardEvent } from '../components/events/EventCard';
import RsvpButtons from '../components/events/RsvpButtons';
import SquadGoStub from '../components/events/SquadGoStub';
import { useSquadPlans } from '../components/events/useSquadPlans';
import UpNext from '../components/events/UpNext';
import {
  capture,
  messageFor,
  PhotoSourceSheet,
  type PhotoSource,
} from '../components/events/EventPhotos';
import EventSheet, { type SheetEvent } from '../components/events/EventSheet';
import { useLiveLocations } from '../components/events/useLiveLocations';
import EventFormSheet from '../components/events/EventFormSheet';
import GroupFormSheet from '../components/group/GroupFormSheet';
import { features } from '../lib/features';

const RENEW_TICK_MS = 5 * 60 * 1000;
// Coming back to the app refreshes the week, at most once a minute.
const RESUME_REFRESH_MS = 60 * 1000;
// The line above NOW reaches this far ahead, with at most this many plans.
const AHEAD_DAYS = 45;
const AHEAD_PLANS = 20;
// How tall the soft top and bottom edges of the memories page are.
const EDGE = 110;
const BG_CLEAR = 'rgba(237,240,245,0)';
const BG_HALF = 'rgba(237,240,245,0.7)';

type HomeScreenProps = {
  user: AuthUser;
  createNonce?: number;
  focusEventId?: string | null;
  onFocusHandled?: () => void;
  onOpenChat?: (groupId: string) => void;
  chatClosedNonce?: number;
  onUnreadChange?: (total: number) => void;
  // Set from the side rail (or You) to open Parea on one squad.
  selectGroup?: { id: string; nonce: number } | null;
  // Bumped by a vote push: open the Votes sheet.
  openVotesNonce?: number;
  // Asks from the side rail, which lives in App: bump to open.
  calendarNonce?: number;
  newSquadNonce?: number;
  onOpenRail?: () => void;
  // Parea has two faces: the memories feed (Home) and the plans (Events).
  view?: 'memories' | 'events';
  onOpenEvents?: () => void;
  // What the side rail shows: your squads, the current one, their unread.
  onRailData?: (data: RailData) => void;
};

export type RailData = {
  squads: Group[];
  activeId: string | null;
  unread: Record<string, number>;
  // Open votes in the current squad you have not answered.
  votes: number;
  me: { name: string; avatarUrl: string | null };
};

function toCardData(event: MyEvent, coverUrl?: string | null, withName?: string): CardEvent {
  return {
    coverUrl,
    id: event.id,
    title: event.title,
    date: event.date,
    startTime: event.startTime,
    location: event.location,
    placeLabel: event.placeLabel,
    groupName: withName ? `${event.groupName} · with ${withName}` : event.groupName,
    myStatus: event.myStatus,
    going: event.going,
    goingCount: event.going.length,
  };
}

export default function HomeScreen({
  user,
  createNonce = 0,
  focusEventId = null,
  onFocusHandled,
  onOpenChat,
  chatClosedNonce = 0,
  onUnreadChange,
  selectGroup = null,
  calendarNonce = 0,
  newSquadNonce = 0,
  onOpenRail,
  view = 'memories',
  onOpenEvents,
  onRailData,
  openVotesNonce = 0,
}: HomeScreenProps) {
  const { signed, signPaths, dropSigned } = useSignedImages();
  const [displayName, setDisplayName] = useState('');
  // Your own photo, for your posts in the photo feed.
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [groups, setGroups] = useState<Group[]>([]);
  const [events, setEvents] = useState<MyEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [dayPlans, setDayPlans] = useState<string | null>(null);
  const [dayStory, setDayStory] = useState<MemoryNight[] | null>(null);
  const [groupId, setGroupId] = useState<string | null>(null);
  const [unread, setUnread] = useState<Record<string, number>>({});
  const [showAllWaiting, setShowAllWaiting] = useState(false);
  const [showAllGoing, setShowAllGoing] = useState(false);
  const [going, setGoing] = useState<PareaGoing[]>([]);
  const [goingSaving, setGoingSaving] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [showGroupForm, setShowGroupForm] = useState(false);
  const [votesOpen, setVotesOpen] = useState(false);
  const [pendingVotes, setPendingVotes] = useState<Record<string, number>>({});
  const [votesNonce, setVotesNonce] = useState(0);
  const [profileGroup, setProfileGroup] = useState<Group | null>(null);
  const [fullCalendar, setFullCalendar] = useState(false);
  // A new plan started from an old night ("Plan it again").
  const [draftEvent, setDraftEvent] = useState<MyEvent | null>(null);
  const [formDate, setFormDate] = useState<string | null>(null);
  const [openEvent, setOpenEvent] = useState<SheetEvent | null>(null);
  const [editEvent, setEditEvent] = useState<MyEvent | null>(null);
  const [rsvpError, setRsvpError] = useState<string | null>(null);
  const [checkins, setCheckins] = useState<Record<string, string[]>>({});
  const [posted, setPosted] = useState<Record<string, true>>({});
  const [coverPhotos, setCoverPhotos] = useState<Record<string, EventCover>>({});
  const [clock, setClock] = useState(0);
  const [photoNonce, setPhotoNonce] = useState(0);
  const [addingPhoto, setAddingPhoto] = useState<MyEvent | null>(null);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);

  async function pickPhoto(source: PhotoSource, inExplore: boolean) {
    const target = addingPhoto;
    if (!target || photoBusy) return;

    setPhotoBusy(true);
    setPhotoError(null);

    try {
      const result = await capture(source, { id: target.id, groupId: target.groupId }, inExplore);
      setAddingPhoto(null);
      if (result) {
        setPosted((prev) => ({ ...prev, [target.id]: true }));
        setPhotoNonce((n) => n + 1);
      }
    } catch (problem) {
      setPhotoError(messageFor(problem));
      setAddingPhoto(null);
    } finally {
      setPhotoBusy(false);
    }
  }

  async function checkIn(eventId: string) {
    const previous = checkins;
    const here = checkins[eventId] ?? [];
    if (here.includes(user.id)) return;

    setPhotoError(null);
    setCheckins({ ...checkins, [eventId]: [...here, user.id] });

    try {
      await saveCheckIn(eventId);
    } catch {
      setCheckins(previous);
      setPhotoError('Could not check you in. Try again.');
    }
  }

  function isCheckedIn(eventId: string) {
    return checkins[eventId]?.includes(user.id) ?? false;
  }

  const [refreshing, setRefreshing] = useState(false);

  // The memories page opens on NOW: the coming days above, memories below.
  const scrollRef = useRef<ScrollView>(null);
  const [viewHeight, setViewHeight] = useState(0);
  const [lineY, setLineY] = useState<number | null>(null);
  const [nowY, setNowY] = useState<number | null>(null);
  const [awayFromNow, setAwayFromNow] = useState<'up' | 'down' | null>(null);
  const anchoredFor = useRef<string | null>(null);
  const topEdge = useRef(new Animated.Value(0)).current;
  const nowAt = lineY !== null && nowY !== null ? lineY + nowY : null;

  // Once per parea (and each time you come back to the memories), open on NOW.
  useEffect(() => {
    if (view !== 'memories') {
      anchoredFor.current = null;
      setAwayFromNow(null);
      return;
    }
    if (loading || nowAt === null || viewHeight === 0) return;
    const key = groupId ?? 'all';
    if (anchoredFor.current === key) return;
    anchoredFor.current = key;
    scrollRef.current?.scrollTo({ y: Math.max(0, nowAt - viewHeight * 0.45), animated: false });
  }, [view, loading, nowAt, viewHeight, groupId]);
  const lastLoad = useRef(0);

  // `quiet` keeps what is on screen while it reloads (pull to refresh, coming back).
  const load = useCallback(
    async function load(quiet = false) {
      if (!quiet) setLoading(true);
      setError(null);
      lastLoad.current = Date.now();

      try {
        const [profile, myGroups, myEvents, friendsPlans] = await Promise.all([
          getUserById(user.id),
          getGroupsForUser(user.id),
          getMyEvents(user.id),
          getPareaGoing().catch(() => [] as PareaGoing[]),
        ]);

        setGoing(friendsPlans);
        setDisplayName(profile?.name ?? '');
        setAvatarUrl(profile?.avatarUrl ?? null);
        setGroups(myGroups);
        setEvents(myEvents);
      } catch (problem) {
        console.warn("[squaddict] home load failed:", problem);
        if (!quiet) setError("Couldn't load your week");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [user.id],
  );

  useEffect(() => {
    load();
  }, [load]);

  // Unread chat counts: on open, after leaving a chat, and on every refresh.
  useEffect(() => {
    let cancelled = false;

    getUnreadCounts()
      .then((counts) => {
        if (!cancelled) setUnread(counts);
      })
      .catch(() => {});
    getPendingVoteCounts(user.id)
      .then((counts) => {
        if (!cancelled) setPendingVotes(counts);
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [chatClosedNonce, photoNonce, votesNonce, user.id]);

  useEffect(() => {
    const mine = new Set(groups.map((g) => g.id));
    const total = Object.entries(unread).reduce(
      (sum, [id, count]) => (mine.has(id) ? sum + count : sum),
      0,
    );
    onUnreadChange?.(total);
  }, [unread, groups, onUnreadChange]);

  function refresh() {
    setRefreshing(true);
    setPhotoNonce((n) => n + 1);
    load(true);
  }

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active' || Date.now() - lastLoad.current < RESUME_REFRESH_MS) return;
      setPhotoNonce((n) => n + 1);
      load(true);
    });
    return () => sub.remove();
  }, [load]);

  // Home always looks at one squad: the acting one by default, never "all of them".
  useEffect(() => {
    if (groups.length === 0) return;
    if (groupId && groups.some((g) => g.id === groupId)) return;

    let cancelled = false;
    getActingGroupId(user.id)
      .catch(() => null)
      .then(function (actingId) {
        if (!cancelled) setGroupId(pickActing(groups, actingId)?.id ?? null);
      });
    return function cleanup() {
      cancelled = true;
    };
  }, [groups, groupId, user.id]);

  // The squad picked in the header is the one you act as, everywhere.
  function chooseSquad(id: string | null) {
    setGroupId(id);
    if (id) setActingGroup(user.id, id).catch(() => {});
  }

  function applyRsvp(list: MyEvent[], eventId: string, status: RsvpStatus | null): MyEvent[] {
    return list.map(function (event) {
      if (event.id !== eventId) {
        return event;
      }

      const others = event.going.filter((person) => person.id !== user.id);
      const going =
        status === 'in' ? [...others, { id: user.id, name: displayName }] : others;

      return { ...event, myStatus: status ?? undefined, going };
    });
  }

  async function handleRsvp(eventId: string, status: RsvpStatus | null) {
    const previous = events;

    setRsvpError(null);
    setEvents(applyRsvp(events, eventId, status));

    try {
      if (status) {
        await setRsvp(eventId, status);
      } else {
        await clearRsvp(eventId);
      }
    } catch {
      setEvents(previous);
      setRsvpError('Could not save your answer. Try again.');
    }
  }

  useEffect(() => {
    if (createNonce > 0) openNewEvent(null);
  }, [createNonce]);

  useEffect(() => {
    if (openVotesNonce > 0) openVotes();
  }, [openVotesNonce]);

  // Votes open on top of Home. A squad page shown in Home's place steps aside
  // first, and the squad deciding (one of yours) becomes the current one.
  function openVotes(id?: string) {
    setProfileGroup(null);
    if (id && id !== groupId && groups.some((group) => group.id === id)) chooseSquad(id);
    setVotesOpen(true);
  }

  useEffect(() => {
    if (selectGroup) chooseSquad(selectGroup.id);
  }, [selectGroup?.nonce]);

  useEffect(() => {
    if (calendarNonce > 0) setFullCalendar(true);
  }, [calendarNonce]);

  useEffect(() => {
    if (newSquadNonce > 0) setShowGroupForm(true);
  }, [newSquadNonce]);

  useEffect(() => {
    onRailData?.({
      squads: groups,
      activeId: groupId,
      unread,
      votes: groupId ? pendingVotes[groupId] ?? 0 : 0,
      me: { name: displayName, avatarUrl },
    });
  }, [groups, groupId, unread, pendingVotes, displayName, avatarUrl, onRailData]);

  useEffect(() => {
    if (!focusEventId) return;

    const target =
      events.find((event) => event.id === focusEventId) ??
      going.find((one) => one.event.id === focusEventId)?.event;
    if (!target) return;

    setOpenEvent(target);
    onFocusHandled?.();
  }, [focusEventId, events, going]);

  // Answering a friend's plan moves it out of this list and into your week.
  async function answerFriendsPlan(eventId: string, status: RsvpStatus | null) {
    if (!status) return;

    setGoingSaving(eventId);
    setRsvpError(null);

    try {
      await setRsvp(eventId, status);
      const [myEvents, friendsPlans] = await Promise.all([
        getMyEvents(user.id),
        getPareaGoing().catch(() => going),
      ]);
      setEvents(myEvents);
      setGoing(friendsPlans);
    } catch {
      setRsvpError('Could not save your answer. Try again.');
    } finally {
      setGoingSaving(null);
    }
  }

  function openNewEvent(date: string | null) {
    setEditEvent(null);
    setDraftEvent(null);
    setFormDate(date);
    setShowCreate(true);
  }

  const now = useNow();
  const today = keyOf(new Date());
  const visible = useMemo(
    () => (groupId ? events.filter((e) => isSquadPlan(e, groupId)) : events),
    [events, groupId],
  );

  // "with MVPS" on another squad's plan that the squad on screen is going to.
  function withNameFor(event: MyEvent): string | undefined {
    if (!groupId || event.groupId === groupId) return undefined;
    if (!(event.withGroupIds ?? []).includes(groupId)) return undefined;
    return groups.find((group) => group.id === groupId)?.name;
  }
  const upcoming = visible.filter((e) => e.date >= today);
  const upNextEvent = upcoming.find((e) => e.myStatus !== 'out');
  const liveEvent = visible.find(
    (e) => e.myStatus !== 'out' && isHappeningNow(e.date, e.startTime, e.endTime, now),
  );
  const heroEvent = liveEvent ?? upNextEvent;
  const sharingEvent = liveEvent?.myStatus === 'in' ? liveEvent : undefined;
  const livePeople = useLiveLocations(features.liveLocation ? sharingEvent?.id : undefined, {
    id: user.id,
    name: displayName,
  });
  const pool = upcoming.filter((e) => e.id !== heroEvent?.id);
  const waiting = pool.filter((e) => e.myStatus === undefined);
  // The selected parea's plans from today on, plus one from yesterday still
  // going past midnight: Home is one parea's line, above now and below it.
  const horizon = keyOf(addDays(new Date(), AHEAD_DAYS));
  const linePlans = [
    ...visible.filter((e) => e.date < today && isHappeningNow(e.date, e.startTime, e.endTime, now)),
    ...visible.filter((e) => e.date === today),
    ...visible
      .filter((e) => e.date > today && e.date <= horizon)
      .sort((a, b) => a.date.localeCompare(b.date) || (a.startTime ?? '').localeCompare(b.startTime ?? ''))
      .slice(0, AHEAD_PLANS),
  ];
  const clockNow = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  const recent = visible.filter((e) => inPhotoWindow(e.date, e.startTime, e.endTime, now));
  const recentIds = recent.map((e) => e.id).sort().join(',');
  const wantsPhoto = recent.find(
    (e) =>
      e.myStatus === 'in' &&
      !posted[e.id] &&
      (e.date < today || !e.startTime || e.startTime <= clockNow) &&
      !(e.id === liveEvent?.id && e.id === heroEvent?.id),
  );
  const friendsPlans = groupId
    ? going.filter((plan) => plan.viaGroupIds.includes(groupId))
    : going;
  const squadPlans = useSquadPlans(
    user.id,
    friendsPlans.map((plan) => ({ id: plan.event.id, groupId: plan.event.groupId })),
    openVotes,
  );
  const goingSlice = visibleSlice(friendsPlans, 2, showAllGoing);
  const waitingSlice = visibleSlice(waiting, 3, showAllWaiting);
  const nights = useMemo(
    () => toMemoryNights(visible, coverPhotos, today).slice(0, MEMORY_LIMIT),
    [visible, coverPhotos, today],
  );
  const groupSizes = useMemo(
    () => Object.fromEntries(groups.map((g) => [g.id, g.memberCount])),
    [groups],
  );

  // Past nights feed the memories; today's also lend their first photo to the
  // ticket when the plan has no cover of its own.
  const pastIds = events
    .filter((e) => e.date <= today)
    .map((e) => e.id)
    .sort()
    .join(',');

  useEffect(() => {
    if (recentIds === '') return;

    let cancelled = false;

    getCheckins(recentIds.split(','))
      .then((byEvent) => {
        if (!cancelled) setCheckins(byEvent);
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [recentIds, photoNonce]);

  useEffect(() => {
    const tick = setInterval(() => setClock((c) => c + 1), RENEW_TICK_MS);
    return () => clearInterval(tick);
  }, []);

  useEffect(() => {
    if (pastIds === '') {
      setCoverPhotos({});
      return;
    }

    let cancelled = false;

    getEventCovers(pastIds.split(','))
      .then((byEvent) => {
        if (!cancelled) setCoverPhotos(byEvent);
      })
      .catch(() => {
        if (!cancelled) setCoverPhotos({});
      });

    return () => {
      cancelled = true;
    };
  }, [pastIds, photoNonce]);

  useEffect(() => {
    signPaths(Object.values(coverPhotos).map((photo) => photo.path));
  }, [coverPhotos, signed, clock, signPaths]);

  const covers = useMemo(() => {
    const byDate: Record<string, string> = {};

    for (const event of events) {
      const photo = coverPhotos[event.id];
      const url = photo ? signed[photo.path]?.url : undefined;
      if (url && !byDate[event.date]) byDate[event.date] = url;
    }

    return byDate;
  }, [events, coverPhotos, signed]);

  const ignoreSeen = useCallback(() => {}, []);

  // The calendar is for looking back: a past day plays its memories, today and
  // later days open their plans (or a new one when the day is free).
  function openDay(key: string) {
    const plans = visible.filter((e) => e.date === key);

    if (key < today) {
      const withPhotos: MemoryNight[] = [];
      for (const event of plans) {
        const cover = coverPhotos[event.id];
        if (cover) withPhotos.push({ event, cover, latestAt: cover.latestAt });
      }

      if (withPhotos.length > 0) setDayStory(withPhotos);
      else if (plans.length === 1) setOpenEvent(plans[0]);
      else if (plans.length > 1) setDayPlans(key);
      return;
    }

    if (plans.length === 0) openNewEvent(key);
    else if (plans.length === 1) setOpenEvent(plans[0]);
    else setDayPlans(key);
  }

  // A photo from the feed opens its night in the story viewer.
  function coverFor(event: MyEvent): string | null {
    if (event.coverUrl) return event.coverUrl;
    const photo = coverPhotos[event.id];
    return photo ? signed[photo.path]?.url ?? null : null;
  }

  // Home: the memories of this squad and the squads it follows, newest first.
  function renderMemories() {
    const activeGroup = groups.find((g) => g.id === groupId);

    return (
      <>
        {features.extraMemoryViews ? (
          <MemoriesBar
            userId={user.id}
            nights={nights}
            groupSizes={groupSizes}
            signed={signed}
            signPaths={signPaths}
            onImageError={dropSigned}
            onPhotosChanged={() => setPhotoNonce((n) => n + 1)}
          />
        ) : null}

        <View onLayout={(event) => setLineY(event.nativeEvent.layout.y)}>
          <PlanLine
            plans={linePlans}
            now={now}
            userId={user.id}
            isCheckedIn={isCheckedIn}
            hereCount={(id) => checkins[id]?.length ?? 0}
            onOpen={setOpenEvent}
            onRsvp={(plan, status) => handleRsvp(plan.id, status)}
            onCheckIn={(plan) => checkIn(plan.id)}
            onAddPhoto={(plan) => {
              setPhotoError(null);
              setAddingPhoto(plan);
            }}
            onThrowPlan={() => openNewEvent(today)}
            onNowLayout={setNowY}
            error={rsvpError ?? (wantsPhoto ? null : photoError)}
          />

          {wantsPhoto ? (
            <TimelineRow solid>
              <PhotoPrompt
                title={wantsPhoto.title}
                groupName={wantsPhoto.groupName}
                live={isHappeningNow(wantsPhoto.date, wantsPhoto.startTime, wantsPhoto.endTime, now)}
                hereCount={checkins[wantsPhoto.id]?.length ?? 0}
                onAdd={() => {
                  setPhotoError(null);
                  setAddingPhoto(wantsPhoto);
                }}
              />
              {photoError ? <Text style={styles.error}>{photoError}</Text> : null}
            </TimelineRow>
          ) : null}

          {activeGroup ? (
            <PhotoFeed
              ownOnly
              group={activeGroup}
              me={{ id: user.id, name: displayName, avatarUrl }}
              signed={signed}
              signPaths={signPaths}
              onImageError={dropSigned}
              reloadKey={photoNonce}
              onOpenGroup={setProfileGroup}
              canOpenGroup={(group) => features.publicProfiles || groups.some((mine) => mine.id === group.id)}
              onPlanAgain={(item) => {
                openNewEvent(nextSameWeekday(item.event.date));
                setDraftEvent(item.event);
              }}
              empty={
                <View style={styles.state}>
                  <Text style={styles.stateTitle}>No memories yet</Text>
                  <Text style={styles.stateBody}>
                    Your first night out is one plan away. The photos from it land here.
                  </Text>
                  {onOpenEvents ? (
                    <View style={styles.stateButton}>
                      <Button title="See the plans" onPress={onOpenEvents} />
                    </View>
                  ) : null}
                </View>
              }
            />
          ) : null}
        </View>
      </>
    );
  }

  function renderBody() {
    if (loading) {
      return (
        <View style={styles.state}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      );
    }

    if (error) {
      return (
        <View style={styles.state}>
          <Text style={styles.stateTitle}>{error}</Text>
          <Text style={styles.stateBody}>The connection dropped. Your plans are still there.</Text>
          <View style={styles.stateButton}>
            <Button title="Try again" onPress={() => load()} />
          </View>
        </View>
      );
    }

    if (groups.length === 0) {
      return (
        <View style={styles.state}>
          <Text style={styles.stateTitle}>No squads yet</Text>
          <Text style={styles.stateBody}>
            Start one and send the code to your people, or paste a code somebody sent you.
          </Text>
          <View style={styles.stateButton}>
            <Button title="Start a squad" onPress={() => setShowGroupForm(true)} />
          </View>
        </View>
      );
    }

    if (view === 'memories') return renderMemories();

    if (events.length === 0) {
      return (
        <View style={styles.state}>
          <Text style={styles.stateTitle}>Nothing on. Suspicious.</Text>
          <Text style={styles.stateBody}>
            Your week is wide open. Somebody has to go first — might as well be you.
          </Text>
          <View style={styles.stateButton}>
            <Button title="Propose an outing" onPress={() => openNewEvent(null)} />
          </View>
        </View>
      );
    }

    const activeGroup = groups.find((g) => g.id === groupId);
    if (activeGroup && visible.length === 0 && friendsPlans.length === 0) {
      return (
        <View style={styles.state}>
          <Text style={styles.stateTitle}>Quiet in {activeGroup.name}</Text>
          <Text style={styles.stateBody}>
            No plans here yet. Throw one out and see who bites.
          </Text>
          <View style={styles.stateButton}>
            <Button title="Propose a plan" onPress={() => openNewEvent(null)} />
          </View>
        </View>
      );
    }

    return (
      <>
        {heroEvent ? (
          <View>
            <SectionHead
              title={liveEvent ? 'Happening now' : 'Up next'}
              live={liveEvent !== undefined}
              meta={
                liveEvent
                  ? liveLabel(liveEvent.date, liveEvent.startTime, liveEvent.endTime, now)
                  : countdownLabel(heroEvent.date)
              }
            />
            <View style={styles.body}>
            <UpNext
              event={heroEvent}
              cover={coverFor(heroEvent)}
              live={liveEvent !== undefined}
              liveText={
                liveEvent
                  ? liveLabel(liveEvent.date, liveEvent.startTime, liveEvent.endTime, now)
                  : undefined
              }
              checkedIn={isCheckedIn(heroEvent.id)}
              hereCount={checkins[heroEvent.id]?.length ?? 0}
              onCheckIn={() => checkIn(heroEvent.id)}
              onAddPhoto={isCheckedIn(heroEvent.id) ? () => setAddingPhoto(heroEvent) : undefined}
              onPress={() => setOpenEvent(heroEvent)}
              onRsvp={(status) => handleRsvp(heroEvent.id, status)}
            />
            {photoError ? <Text style={styles.error}>{photoError}</Text> : null}
            </View>
          </View>
        ) : null}

        {friendsPlans.length > 0 ? (
          <View>
            <SectionHead
              title="Your parea is going"
              meta={friendsPlans.length > 1 ? `${friendsPlans.length} plans` : undefined}
            />
            <View style={styles.body}>
              {goingSlice.shown.map((plan) => (
                <EventCard
                  key={plan.event.id}
                  event={{
                    ...toCardData(plan.event, plan.event.coverUrl),
                    goingCount: plan.goingCount,
                    friendsGoing: plan.friends,
                  }}
                  action="rsvp"
                  saving={goingSaving === plan.event.id}
                  onPress={() => setOpenEvent(plan.event)}
                  onRsvp={(status) => answerFriendsPlan(plan.event.id, status)}
                  stub={
                    <SquadGoStub
                      stance={squadPlans.stanceFor({ id: plan.event.id, groupId: plan.event.groupId })}
                      busy={squadPlans.busyId === plan.event.id}
                      onAct={async () => {
                        if (await squadPlans.act({ id: plan.event.id, groupId: plan.event.groupId })) load(true);
                      }}
                    >
                      <RsvpButtons
                        status={plan.event.myStatus}
                        saving={goingSaving === plan.event.id}
                        onChange={(status) => answerFriendsPlan(plan.event.id, status)}
                        compact
                        stretch
                      />
                    </SquadGoStub>
                  }
                />
              ))}
              <ShowMore
                hidden={goingSlice.hidden}
                expanded={showAllGoing}
                onToggle={() => setShowAllGoing(!showAllGoing)}
              />
            </View>
          </View>
        ) : null}

        {rsvpError ? (
          <View style={styles.body}>
            <Text style={styles.error}>{rsvpError}</Text>
          </View>
        ) : null}
        {squadPlans.error ? (
          <View style={styles.body}>
            <Text style={styles.error}>{squadPlans.error}</Text>
          </View>
        ) : null}

        {waiting.length > 0 ? (
          <View>
            <SectionHead title="Waiting on you" count={waiting.length} />
            <View style={styles.body}>
            {waitingSlice.shown.map((event) => (
              <EventCard
                key={event.id}
                event={toCardData(event, coverFor(event), withNameFor(event))}
                action="rsvp"
                onPress={() => setOpenEvent(event)}
                onRsvp={(status) => handleRsvp(event.id, status)}
              />
            ))}
            <ShowMore
              hidden={waitingSlice.hidden}
              expanded={showAllWaiting}
              onToggle={() => setShowAllWaiting(!showAllWaiting)}
            />
            </View>
          </View>
        ) : null}

      </>
    );
  }

  // A squad opened from the photo feed stacks on top of Home.
  if (profileGroup) {
    return (
      <GroupScreen
        group={profileGroup}
        userId={user.id}
        onOpenVotes={openVotes}
        onBack={() => setProfileGroup(null)}
        onLeave={() => {
          setProfileGroup(null);
          load(true);
        }}
        backLabel="Home"
      />
    );
  }

  function scrollToNow(animated: boolean) {
    if (nowAt === null || viewHeight === 0) return;
    scrollRef.current?.scrollTo({ y: Math.max(0, nowAt - viewHeight * 0.45), animated });
  }

  // Edges and the "Back to today" pill follow the scroll; state only changes
  // when the pill has to show, hide or flip.
  function onPageScroll(event: { nativeEvent: { contentOffset: { y: number } } }) {
    const y = event.nativeEvent.contentOffset.y;
    topEdge.setValue(Math.min(1, Math.max(0, y / 60)));
    if (nowAt === null) return;
    const away = nowAt < y ? 'up' : nowAt > y + viewHeight ? 'down' : null;
    if (away !== awayFromNow) setAwayFromNow(away);
  }

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.page}>
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={styles.content}
        onLayout={(event) => setViewHeight(event.nativeEvent.layout.height)}
        onScroll={view === 'memories' ? onPageScroll : undefined}
        scrollEventThrottle={32}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.primary} />
        }
      >
        <HomeHeader
          squad={groups.find((group) => group.id === groupId)}
          label={view === 'memories' ? 'Memories' : 'Plans'}
          onMenu={() => onOpenRail?.()}
        />
        {renderBody()}
      </ScrollView>

      {view === 'memories' ? (
        <>
          <Animated.View pointerEvents="none" style={[styles.edgeTop, { opacity: topEdge }]}>
            <BlurView intensity={10} tint="light" style={styles.edgeBlurTop} />
            <LinearGradient colors={[colors.bg, BG_HALF, BG_CLEAR]} locations={[0, 0.35, 1]} style={StyleSheet.absoluteFill} />
          </Animated.View>
          <View pointerEvents="none" style={styles.edgeBottom}>
            <BlurView intensity={10} tint="light" style={styles.edgeBlurBottom} />
            <LinearGradient colors={[BG_CLEAR, BG_HALF, colors.bg]} locations={[0, 0.65, 1]} style={StyleSheet.absoluteFill} />
          </View>
          {awayFromNow ? (
            <Pressable
              onPress={() => scrollToNow(true)}
              accessibilityRole="button"
              accessibilityLabel="Back to today"
              style={({ pressed }) => [
                styles.backToday,
                awayFromNow === 'up' ? styles.backTodayTop : styles.backTodayBottom,
                pressed && styles.backTodayPressed,
              ]}
            >
              <Text style={styles.backTodayText}>Back to today {awayFromNow === 'up' ? '↑' : '↓'}</Text>
            </Pressable>
          ) : null}
        </>
      ) : null}
      </View>

      <StoryViewer
        key={dayStory ? dayStory[0].event.id : 'day-closed'}
        visible={dayStory !== null}
        nights={dayStory ?? []}
        startIndex={0}
        groupSizes={groupSizes}
        signed={signed}
        signPaths={signPaths}
        onImageError={dropSigned}
        onSeen={ignoreSeen}
        onAddYours={(night) => {
          setDayStory(null);
          setPhotoError(null);
          setAddingPhoto(night.event);
        }}
        onClose={() => setDayStory(null)}
      />

      <DayPlansSheet
        label={dayPlans ? dayFilterLabel(dayPlans) : null}
        plans={dayPlans ? visible.filter((e) => e.date === dayPlans) : []}
        toCard={(event) => toCardData(event, coverFor(event), withNameFor(event))}
        onOpen={(event) => {
          setDayPlans(null);
          setOpenEvent(event);
        }}
        onRsvp={handleRsvp}
        onPlan={() => {
          const date = dayPlans;
          setDayPlans(null);
          openNewEvent(date);
        }}
        onClose={() => setDayPlans(null)}
      />

      <PhotoSourceSheet
        visible={addingPhoto !== null}
        shareable={addingPhoto?.isPublic === true}
        onClose={() => {
          if (!photoBusy) setAddingPhoto(null);
        }}
        onPick={pickPhoto}
      />

      <EventFormSheet
        visible={showCreate}
        groups={groups}
        defaultGroupId={groupId}
        defaultDate={formDate ?? today}
        event={editEvent}
        draft={draftEvent}
        onClose={() => {
          setShowCreate(false);
          setEditEvent(null);
          setDraftEvent(null);
        }}
        onSaved={async () => setEvents(await getMyEvents(user.id))}
      />

      <GroupFormSheet
        visible={showGroupForm}
        onClose={() => setShowGroupForm(false)}
        onDone={async () => {
          setGroups(await getGroupsForUser(user.id));
        }}
      />

      <EventSheet
        event={openEvent}
        livePeople={openEvent !== null && openEvent.id === sharingEvent?.id ? livePeople : undefined}
        currentUserId={user.id}
        onClose={() => setOpenEvent(null)}
        onOpenVotes={openVotes}
        onChanged={async () => {
          const [myEvents, friendsPlans] = await Promise.all([
            getMyEvents(user.id),
            getPareaGoing().catch(() => going),
          ]);
          setEvents(myEvents);
          setGoing(friendsPlans);
          setVotesNonce((n) => n + 1);
        }}
        onPhotosChanged={() => setPhotoNonce((n) => n + 1)}
        onEdit={(e) => {
          const mine = events.find((one) => one.id === e.id);
          if (!mine) return;

          setOpenEvent(null);
          setEditEvent(mine);
          setFormDate(mine.date);
          setShowCreate(true);
        }}
      />

      {/* The calendar is a page of its own, on top of Home, like the chat. */}
      {fullCalendar ? (
        <CalendarScreen
          squadName={groups.find((group) => group.id === groupId)?.name}
          events={visible}
          covers={covers}
          onBack={() => setFullCalendar(false)}
          onSelectDate={openDay}
        />
      ) : null}

      {/* Votes are a page of their own too, on top of Home. */}
      {votesOpen && groups.some((group) => group.id === groupId) ? (
        <VotesScreen
          group={groups.find((group) => group.id === groupId)!}
          userId={user.id}
          reloadKey={votesNonce}
          onBack={() => setVotesOpen(false)}
          onOpenSquad={setProfileGroup}
          onOpenEvent={(event) => setOpenEvent(voteEventToSheet(event))}
          onChanged={() => {
            setVotesNonce((n) => n + 1);
            load(true);
          }}
        />
      ) : null}
    </SafeAreaView>
  );
}

// The next day after today with the same weekday as this date ("next Friday").
function nextSameWeekday(dateStr: string): string {
  const from = parseDateKey(dateStr);
  const day = new Date();
  day.setDate(day.getDate() + 1);
  if (from) {
    while (day.getDay() !== from.getDay()) day.setDate(day.getDate() + 1);
  }
  return keyOf(day);
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  page: { flex: 1 },
  edgeTop: { position: 'absolute', top: 0, left: 0, right: 0, height: EDGE },
  edgeBottom: { position: 'absolute', bottom: 0, left: 0, right: 0, height: EDGE },
  edgeBlurTop: { position: 'absolute', top: 0, left: 0, right: 0, height: EDGE * 0.35 },
  edgeBlurBottom: { position: 'absolute', bottom: 0, left: 0, right: 0, height: EDGE * 0.35 },
  backToday: {
    position: 'absolute',
    alignSelf: 'center',
    minHeight: 40,
    paddingHorizontal: space.md,
    justifyContent: 'center',
    borderRadius: 999,
    backgroundColor: colors.ink,
    shadowColor: colors.ink,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 14,
    elevation: 6,
  },
  backTodayTop: { top: space.md },
  backTodayBottom: { bottom: space.lg },
  backTodayPressed: { transform: [{ scale: 0.96 }] },
  backTodayText: { color: colors.onInk, ...typo.bold, fontSize: textSize.body },
  content: {
    width: '100%',
    maxWidth: layout.column,
    alignSelf: 'center',
    paddingVertical: space.md,
    paddingBottom: 130,
    gap: space.md,
  },
  body: { paddingHorizontal: space.lg, gap: space.sm },
  line: { paddingTop: space.xs },
  error: { color: colors.danger, ...typo.medium, fontSize: 13 },
  state: { alignItems: 'center', paddingHorizontal: space.lg, paddingVertical: space.xl, gap: space.xs },
  stateTitle: {
    color: colors.text,
    ...typo.display,
    fontSize: 21,
    letterSpacing: -0.3,
    textAlign: 'center',
  },
  stateBody: {
    color: colors.textSoft,
    ...typo.medium,
    fontSize: 14.5,
    lineHeight: 21,
    textAlign: 'center',
  },
  stateButton: { alignSelf: 'stretch', marginTop: space.sm },
});
