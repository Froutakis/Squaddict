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
import { getSuggestions, type PlanSuggestion } from '../services/serviceSuggestions';
import { getUnreadCounts } from '../services/serviceChat';
import {
  checkIn as saveCheckIn,
  clearRsvp,
  getCheckins,
  getEventCovers,
  getMyEvents,
  setRsvp,
} from '../services/serviceEvents';
import { colors, typo, layout, space, textSize } from '../theme';
import TicketBackdrop from '../components/general/TicketBackdrop';
import EdgeFades, { EDGE_FADE_IN } from '../components/general/EdgeFades';
import {
  addDays,
  dayFilterLabel,
  inPhotoWindow,
  isHappeningNow,
  keyOf,
  parseDateKey,
} from '../lib/datetime';
import HomeHeader from '../components/home/HomeHeader';
import { getPendingVoteCounts } from '../services/serviceVotes';
import CalendarScreen, { type CalendarNight } from './CalendarScreen';
import { useNow } from '../components/home/useNow';
import MemoriesBar from '../components/home/MemoriesBar';
import { useSignedImages } from '../components/home/useSignedImages';
import PhotoPrompt from '../components/home/PhotoPrompt';
import PhotoFeed from '../components/home/PhotoFeed';
import PlanLine, { type OtherPlan } from '../components/home/PlanLine';
import { TimelineRow } from '../components/home/Timeline';
import GroupScreen from './GroupScreen';
import { MEMORY_LIMIT, toMemoryNights, type MemoryNight } from '../components/home/memories';
import DayPlansSheet from '../components/home/DayPlansSheet';
import StoryViewer from '../components/events/StoryViewer';
import Button from '../components/general/Button';
import { friendsLine, type CardEvent } from '../components/events/EventCard';
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
import type { VoteStart } from '../components/votes/NewVoteSheet';

const RENEW_TICK_MS = 5 * 60 * 1000;
// Coming back to the app refreshes the week, at most once a minute.
const RESUME_REFRESH_MS = 60 * 1000;
// The line above NOW reaches this far ahead, with at most this many plans.
const AHEAD_DAYS = 45;
const AHEAD_PLANS = 20;
// Home opens with today at the top, this much room above it.
const TODAY_ROOM = 60;

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
  // Votes live in the parea's chat: opens it on its Votes tab.
  onOpenVotes?: (groupId?: string, start?: VoteStart) => void;
  // Asks from the side rail, which lives in App: bump to open.
  calendarNonce?: number;
  newSquadNonce?: number;
  // Bumped when the rail asks for Parea itself (Home, the calendar): a page
  // on top of it, like Votes, steps aside.
  railHomeNonce?: number;
  onOpenRail?: () => void;
  // What the side rail shows: your squads, the current one, their unread.
  onRailData?: (data: RailData) => void;
  // Tells App which page sits on top of Parea, if any.
  onOverlayChange?: (overlay: HomeOverlay) => void;
};

export type HomeOverlay = 'calendar' | 'squad' | null;

export type RailData = {
  squads: Group[];
  activeId: string | null;
  unread: Record<string, number>;
  // Open votes in the current squad you have not answered.
  votes: number;
  me: { name: string; avatarUrl: string | null };
};

function toCardData(event: MyEvent, coverUrl?: string | null): CardEvent {
  return {
    coverUrl,
    id: event.id,
    title: event.title,
    date: event.date,
    startTime: event.startTime,
    location: event.location,
    placeLabel: event.placeLabel,
    groupName: event.groupName,
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
  railHomeNonce = 0,
  onOpenRail,
  onRailData,
  onOverlayChange,
  onOpenVotes,
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
  const [going, setGoing] = useState<PareaGoing[]>([]);
  const [goingSaving, setGoingSaving] = useState<string | null>(null);
  // Other pareas' plans a member suggested to the parea on screen.
  const [suggested, setSuggested] = useState<PlanSuggestion[]>([]);
  const [suggestedNonce, setSuggestedNonce] = useState(0);
  const [showCreate, setShowCreate] = useState(false);
  const [showGroupForm, setShowGroupForm] = useState(false);
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
  // Where NOW sits in the page, measured against the page itself: an onLayout y
  // is only relative to its parent and, on the web, is not sent again when rows
  // above it change height.
  const contentRef = useRef<View>(null);
  const nowRef = useRef<View>(null);
  const [nowAt, setNowAt] = useState<number | null>(null);
  // Where today starts: Home always opens there.
  const todayRef = useRef<View>(null);
  const [todayAt, setTodayAt] = useState<number | null>(null);
  const [awayFromNow, setAwayFromNow] = useState<'up' | 'down' | null>(null);
  const anchoredFor = useRef<string | null>(null);
  const topEdge = useRef(new Animated.Value(0)).current;

  // Once per parea (and each time Home mounts), open on NOW.
  useEffect(() => {
    if (loading || todayAt === null || viewHeight === 0) return;
    const key = groupId ?? 'all';
    if (anchoredFor.current === key) return;
    anchoredFor.current = key;
    scrollRef.current?.scrollTo({ y: Math.max(0, todayAt - TODAY_ROOM), animated: false });
  }, [loading, todayAt, viewHeight, groupId]);
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
    setSuggestedNonce((n) => n + 1);
    load(true);
  }

  // The suggestions belong to the parea on screen.
  useEffect(() => {
    if (!groupId) {
      setSuggested([]);
      return;
    }

    let cancelled = false;
    getSuggestions(groupId).then((list) => {
      if (!cancelled) setSuggested(list);
    });
    return () => {
      cancelled = true;
    };
  }, [groupId, suggestedNonce, chatClosedNonce]);

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

  // Votes live in the chat of the parea deciding (this one, unless told).
  function openVotes(id?: string, start?: VoteStart) {
    setProfileGroup(null);
    onOpenVotes?.(id ?? groupId ?? undefined, start);
  }

  useEffect(() => {
    if (selectGroup) chooseSquad(selectGroup.id);
  }, [selectGroup?.nonce]);

  // Only a bump while Parea is up counts, not the value it mounts with. The
  // calendar and a squad page step aside, so Home means Home, and the page goes
  // back to NOW.
  const railHomeSeen = useRef(railHomeNonce);
  useEffect(() => {
    if (railHomeNonce === railHomeSeen.current) return;
    railHomeSeen.current = railHomeNonce;
    setFullCalendar(false);
    setProfileGroup(null);
    scrollToNow(false);
  }, [railHomeNonce]);

  // After the step-aside above: the rail's Calendar bumps both at once.
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

  // The page on top of Parea, for the rail's "you are here".
  const overlay: HomeOverlay = fullCalendar ? 'calendar' : profileGroup ? 'squad' : null;
  useEffect(() => {
    onOverlayChange?.(overlay);
  }, [overlay, onOverlayChange]);
  useEffect(() => () => onOverlayChange?.(null), [onOverlayChange]);

  useEffect(() => {
    if (!focusEventId) return;

    const target =
      events.find((event) => event.id === focusEventId) ??
      going.find((one) => one.event.id === focusEventId)?.event ??
      suggested.find((one) => one.event.id === focusEventId)?.event;
    if (!target) return;

    setOpenEvent(target);
    onFocusHandled?.();
  }, [focusEventId, events, going, suggested]);

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
      setSuggestedNonce((n) => n + 1);
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

  const liveEvent = visible.find(
    (e) => e.myStatus !== 'out' && isHappeningNow(e.date, e.startTime, e.endTime, now),
  );
  const sharingEvent = liveEvent?.myStatus === 'in' ? liveEvent : undefined;
  const livePeople = useLiveLocations(features.liveLocation ? sharingEvent?.id : undefined, {
    id: user.id,
    name: displayName,
  });
  // The selected parea's plans from today on, plus one from yesterday still
  // going past midnight: Home is one parea's line, above now and below it.
  // Past the horizon only the plans still waiting on your answer come along,
  // so every one of those can be reached from here.
  const horizon = keyOf(addDays(new Date(), AHEAD_DAYS));
  const linePlans = [
    ...visible.filter((e) => e.date < today && isHappeningNow(e.date, e.startTime, e.endTime, now)),
    ...visible.filter((e) => e.date === today),
    ...visible
      .filter((e) => e.date > today)
      .sort((a, b) => a.date.localeCompare(b.date) || (a.startTime ?? '').localeCompare(b.startTime ?? ''))
      .filter((e, i) => (i < AHEAD_PLANS && e.date <= horizon) || e.myStatus === undefined),
  ];
  const clockNow = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  const recent = visible.filter((e) => inPhotoWindow(e.date, e.startTime, e.endTime, now));
  const recentIds = recent.map((e) => e.id).sort().join(',');
  const wantsPhoto = recent.find(
    (e) =>
      e.myStatus === 'in' &&
      !posted[e.id] &&
      (e.date < today || !e.startTime || e.startTime <= clockNow) &&
      e.id !== liveEvent?.id,
  );
  // Other pareas' plans on the line, each once. "Nikos suggests": plans you
  // have not answered yet; answered, they move into your plans like any of
  // yours. Then members of your parea who said I'm in to another parea's
  // public plan; one already suggested here shows as the suggestion. One that
  // is already on the line, or that you answered, is left out.
  const skipIds = new Set([
    ...visible.map((e) => e.id),
    ...events.filter((e) => e.myStatus !== undefined).map((e) => e.id),
  ]);
  const suggestions = suggested.filter((one) => one.event.myStatus === undefined && !skipIds.has(one.event.id));
  const suggestedIds = new Set(suggestions.map((one) => one.event.id));
  const friendsPlans = (groupId ? going.filter((plan) => plan.viaGroupIds.includes(groupId)) : going).filter(
    (plan) => !suggestedIds.has(plan.event.id) && !skipIds.has(plan.event.id),
  );
  const otherPlans: OtherPlan[] = [
    ...suggestions.map((one) => ({
      event: one.event,
      note: `${one.suggesterName.split(' ')[0] || one.suggesterName} suggests`,
      saving: goingSaving === one.event.id,
    })),
    ...friendsPlans.map((plan) => ({
      event: plan.event,
      note: plan.friends.length > 0 ? friendsLine(plan.friends) : `${plan.goingCount} going`,
      saving: goingSaving === plan.event.id,
    })),
  ];
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
    const byDate: Record<string, CalendarNight> = {};

    for (const event of visible) {
      const photo = coverPhotos[event.id];
      const url = photo ? signed[photo.path]?.url : undefined;
      if (photo && url && !byDate[event.date]) {
        byDate[event.date] = { url, event, count: photo.count, photoIds: photo.photoIds };
      }
    }

    return byDate;
  }, [visible, coverPhotos, signed]);

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
    const photo = coverPhotos[event.id];
    return photo ? signed[photo.path]?.url ?? null : null;
  }

  // Home: the parea's plans above NOW, its memories below, newest first.
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

        <View>
          <PlanLine
            plans={linePlans}
            others={otherPlans}
            onAnswerOther={(plan, status) => answerFriendsPlan(plan.id, status)}
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
            nowRef={nowRef}
            onNowLayout={measureNow}
            todayRef={todayRef}
            onTodayLayout={measureNow}
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

    return renderMemories();
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

  function measureNow() {
    const node = nowRef.current;
    const page = contentRef.current;
    if (!node || !page) return;
    node.measureLayout(page, (_x, y) => setNowAt((was) => (was === y ? was : y)), () => {});
    const mark = todayRef.current;
    if (mark) mark.measureLayout(page, (_x, y) => setTodayAt((was) => (was === y ? was : y)), () => {});
  }

  // Today at the top of the page, a little room above it.
  function scrollToNow(animated: boolean) {
    if (todayAt === null || viewHeight === 0) return;
    scrollRef.current?.scrollTo({ y: Math.max(0, todayAt - TODAY_ROOM), animated });
  }

  // Edges and the "Back to today" pill follow the scroll; state only changes
  // when the pill has to show, hide or flip.
  function onPageScroll(event: { nativeEvent: { contentOffset: { y: number } } }) {
    const y = event.nativeEvent.contentOffset.y;
    topEdge.setValue(Math.min(1, Math.max(0, y / EDGE_FADE_IN)));
    if (nowAt === null) return;
    const away = nowAt < y ? 'up' : nowAt > y + viewHeight ? 'down' : null;
    if (away !== awayFromNow) setAwayFromNow(away);
  }

  return (
    <SafeAreaView style={styles.screen}>
      <TicketBackdrop />
      <View style={styles.page}>
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={styles.content}
        onLayout={(event) => setViewHeight(event.nativeEvent.layout.height)}
        onScroll={onPageScroll}
        onContentSizeChange={measureNow}
        scrollEventThrottle={32}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.primary} />
        }
      >
        <View ref={contentRef} collapsable={false} style={styles.contentInner}>
          <HomeHeader
            squad={groups.find((group) => group.id === groupId)}
            label="Home"
            onMenu={() => onOpenRail?.()}
          />
          {renderBody()}
        </View>
      </ScrollView>

      <EdgeFades top={topEdge} />
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
        toCard={(event) => toCardData(event, coverFor(event))}
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
        onSaved={async () => {
          setEvents(await getMyEvents(user.id));
          setVotesNonce((n) => n + 1);
        }}
        onOpenVotes={openVotes}
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
        onChanged={async () => {
          const [myEvents, friendsPlans] = await Promise.all([
            getMyEvents(user.id),
            getPareaGoing().catch(() => going),
          ]);
          setEvents(myEvents);
          setGoing(friendsPlans);
          setSuggestedNonce((n) => n + 1);
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
          now={now}
          onBack={() => setFullCalendar(false)}
          onSelectDate={openDay}
          onOpenPlan={setOpenEvent}
          onThrowPlan={openNewEvent}
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
  },
  contentInner: { gap: space.md },
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
