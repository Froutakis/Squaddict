import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import {
  ActivityIndicator,
  Animated,
  AppState,
  FlatList,
  Pressable,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  TextInput,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  DEFAULT_RADIUS_KM,
  getFeed,
  getHighlights,
  getPareaGoing,
  type FeedEvent,
  type FeedHighlight,
  type FeedWhen,
} from '../services/serviceFeed';
import { suggestPlan } from '../services/serviceSuggestions';
import { errorText } from '../lib/postgres';
import { isHappeningNow, keyOf } from '../lib/datetime';
import { useNow } from '../components/home/useNow';
import { getGroupById, getGroupsForUser, searchGroups, type Group } from '../services/serviceGroup';
import { getActingSquad, getUserById } from '../services/serviceUser';
import { getFollowing } from '../services/serviceFollow';
import { clearRsvp, getMyEvents, setRsvp, type MyEvent, type RsvpStatus } from '../services/serviceEvents';
import { getCurrentCoords, type Coords, type LocationState } from '../services/serviceLocation';
import { tagLabel, type EventTag } from '../lib/tags';
import EventCard, { type CardEvent } from '../components/events/EventCard';
import RsvpButtons from '../components/events/RsvpButtons';
import type { Person } from '../lib/people';
import { alpha, colors, typo, layout, radius, shadow, solidFor, space, textSize } from '../theme';
import TicketBackdrop from '../components/general/TicketBackdrop';
import SectionHead from '../components/general/SectionHead';
import ListEmpty from '../components/home/ListEmpty';
import GroupCard, { type CardGroup } from '../components/group/GroupCard';
import EdgeFades, { EDGE_FADE_IN } from '../components/general/EdgeFades';
import GroupScreen from './GroupScreen';
import Monogram, { initialsFor } from '../components/general/Monogram';
import { useLivePeopleAround } from '../components/events/useLivePeopleAround';
import type { MapPin } from '../components/general/mapShared';
import Glass from '../components/general/Glass';
import PopIn from '../components/general/PopIn';
import MapView from '../components/general/Map';
import EventSheet, { type SheetEvent } from '../components/events/EventSheet';
import MemoriesBar from '../components/home/MemoriesBar';
import { useSignedImages } from '../components/home/useSignedImages';
import { FAB_CENTER_Y } from '../components/general/MenuFab';
import { features } from '../lib/features';
import CityLine from '../components/explore/CityLine';
import ExploreHero, { HERO_HEIGHT } from '../components/explore/ExploreHero';
import { ExploreApplied, ExploreTabs, ExploreTitleRow, ExploreTools, type ExploreTab } from '../components/explore/ExploreBar';
import FilterSheet from '../components/explore/FilterSheet';
import { getCrossings } from '../services/serviceCrossed';
import { getCityNights, type FeedPhoto } from '../services/servicePhotoFeed';

const RADII = [5, 10, 25, 50, 100];
// Where the map looks before we know where you are: Thessaloniki.
const DEFAULT_MAP_CENTER = { lat: 40.6401, lng: 22.9444 };

const MIN_VISIBLE = 6;

type ViewMode = 'list' | 'map';

const WHEN_OPTIONS: { key: FeedWhen; label: string }[] = [
  { key: 'today', label: 'Today' },
  { key: 'tomorrow', label: 'Tomorrow' },
  { key: 'weekend', label: 'Weekend' },
];

// Room at the bottom of the map for the event card.
const NAV_CLEARANCE = 110;
// The title row sits in the same place in list and map mode: the map's glass
// island (its margin, padding and 1px border) adds up to the list's spacing.
const GLASS_BORDER = 1;
const ISLAND_PAD = space.md;
const TITLE_TOP = space.sm + space.sm + GLASS_BORDER;
const TITLE_ROW = 40;
// How far the floating menu button drops on Explore to sit level with the title.
export const EXPLORE_FAB_DROP = TITLE_TOP + TITLE_ROW / 2 - FAB_CENTER_Y;
const SEARCH_DELAY_MS = 300;
// The folded bar shows a little before the big header has fully gone.
const FOLD_EARLY = 60;
// Room above today when the line opens on it: the folded bar (title + tabs).
const TODAY_ROOM = TITLE_TOP + TITLE_ROW + 56;

function toCardData(event: FeedEvent, friendsGoing?: Person[]): CardEvent {
  return {
    friendsGoing,
    id: event.id,
    title: event.title,
    date: event.date,
    startTime: event.startTime,
    location: event.location,
    placeLabel: event.placeLabel,
    groupName: event.groupName,
    myStatus: event.myStatus,
    going: [],
    goingCount: event.goingCount,
    distanceKm: event.distanceKm,
  };
}

// The city the plans around you are in: the most common last part of their
// place ("Μπιτ Παζάρ, Θεσσαλονίκη"), when at least two plans share it.
// Without one, where the line is.
function cityOf(events: FeedEvent[]): string | null {
  const counts = new Map<string, number>();
  for (const event of events) {
    const parts = (event.placeLabel ?? '').split(',').map((part) => part.trim()).filter(Boolean);
    if (parts.length === 0) continue;
    const town = parts[parts.length - 1].replace(/\s*\d{3}\s?\d{2}$/, '');
    // A street number or a postcode is not a city.
    if (town && !/\d/.test(town)) counts.set(town, (counts.get(town) ?? 0) + 1);
  }
  let best: string | null = null;
  let most = 0;
  for (const [town, n] of counts) {
    if (n > most) {
      best = town;
      most = n;
    }
  }
  return best && most >= 2 ? best : null;
}

function applyRsvp(event: FeedEvent, status: RsvpStatus | null): FeedEvent {
  const wasIn = event.myStatus === 'in';
  const isIn = status === 'in';

  let goingCount = event.goingCount;
  if (wasIn && !isIn) goingCount -= 1;
  if (!wasIn && isIn) goingCount += 1;

  return { ...event, myStatus: status ?? undefined, goingCount: Math.max(0, goingCount) };
}

function toSheetEvent(event: FeedEvent): SheetEvent {
  return {
    id: event.id,
    groupName: event.groupName,
    title: event.title,
    date: event.date,
    startTime: event.startTime,
    location: event.location,
    placeLabel: event.placeLabel,
    lat: event.lat,
    lng: event.lng,
    isMember: event.isMember,
    groupId: event.groupId,
    isPublic: true,
  };
}

type ExploreScreenProps = {
  userId: string;
  // Following a parea and going to its plans are votes, and votes start on
  // the Votes page: this takes the member there.
  onOpenVotes: (groupId?: string) => void;
};

export default function ExploreScreen({ userId, onOpenVotes }: ExploreScreenProps) {
  const [center, setCenter] = useState<Coords | null>(null);
  const [locationState, setLocationState] = useState<LocationState>('asking');

  const [radiusKm, setRadiusKm] = useState(DEFAULT_RADIUS_KM);
  const [tags, setTags] = useState<EventTag[]>([]);
  const [when, setWhen] = useState<FeedWhen | null>(null);
  const [followingOnly, setFollowingOnly] = useState(false);
  const [liveOnly, setLiveOnly] = useState(false);
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState('');
  const [foundGroups, setFoundGroups] = useState<Group[]>([]);
  const [myGroupIds, setMyGroupIds] = useState<Set<string>>(new Set());

  const [events, setEvents] = useState<FeedEvent[]>([]);
  // Follows belong to the acting squad, not to the person.
  const [acting, setActing] = useState<Group | null>(null);
  const [following, setFollowing] = useState<Record<string, true>>({});
  const [followsNonce, setFollowsNonce] = useState(0);
  const [profileGroup, setProfileGroup] = useState<Group | null>(null);
  // The city's line is the front page of Explore; the map is one tap away.
  const [mode, setMode] = useState<ViewMode>('list');

  // The line opens on NOW, like Home: the plans ahead above, the city's
  // nights below. Measured against the list's header, which holds the line.
  const listRef = useRef<FlatList<FeedEvent>>(null);
  const lineRef = useRef<View>(null);
  const nowRef = useRef<View>(null);
  const [nowAt, setNowAt] = useState<number | null>(null);
  const [listHeight, setListHeight] = useState(0);
  const anchored = useRef(false);
  // Where today starts on the line: the list always opens there.
  const todayRef = useRef<View>(null);
  const [todayAt, setTodayAt] = useState<number | null>(null);
  const topEdge = useRef(new Animated.Value(0)).current;
  // Plans, or only the city's nights; People is the map's other layer.
  const [tab, setTab] = useState<'plans' | 'nights'>('plans');
  const [filtersOpen, setFiltersOpen] = useState(false);
  // The big header folds into a glass bar once it has scrolled away.
  const [folded, setFolded] = useState(false);
  // The full-screen spinner is for the first load only: later loads keep the
  // page (and the search field, and the filters sheet) where they are.
  const loadedOnce = useRef(false);
  // The city keeps its last good name, so a search that finds nothing does
  // not turn the title into "Everywhere".
  const lastCity = useRef<string | null>(null);
  // The parea yours crossed most lately, between the plans.
  const [crossing, setCrossing] = useState<{ id: string; name: string; avatarUrl: string | null; times: number } | null>(null);
  // What the map shows: open plans, or the people and pareas out right now.
  const [chosenLayer, setLayer] = useState<'plans' | 'people'>('plans');
  const layer = features.liveLocation ? chosenLayer : 'plans';
  const [myEvents, setMyEvents] = useState<MyEvent[]>([]);
  const [myName, setMyName] = useState('');
  const [mapSearching, setMapSearching] = useState(false);
  const [openEvent, setOpenEvent] = useState<SheetEvent | null>(null);
  const [islandsBottom, setIslandsBottom] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [page, setPage] = useState(0);

  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [highlights, setHighlights] = useState<FeedHighlight[]>([]);
  const [friendsGoing, setFriendsGoing] = useState<Record<string, Person[]>>({});
  const { signed, signPaths, dropSigned } = useSignedImages();
  // Another parea's public plan: anyone answers it for themselves.
  function cardProps(event: FeedEvent) {
    return {
      event: toCardData(event, friendsGoing[event.id]),
      stub: event.isMember ? undefined : (
        <RsvpButtons
          status={event.myStatus}
          saving={savingId === event.id}
          onChange={(status) => handleRsvp(event.id, status)}
          compact
          stretch
        />
      ),
    };
  }
  // The city's public nights, below now on the line.
  const [cityNights, setCityNights] = useState<FeedPhoto[]>([]);
  const [cityLoading, setCityLoading] = useState(true);

  const followedIds = Object.keys(following).sort().join(',');
  const followFilter = followingOnly ? followedIds : null;
  const activeSearch = search;

  const askLocation = useCallback(async function ask() {
    setLocationState('asking');

    const result = await getCurrentCoords();
    if (result.ok) {
      setCenter(result.coords);
      setLocationState('on');
      return;
    }

    setCenter(null);
    setLocationState('off');
  }, []);

  useEffect(() => {
    askLocation();
  }, [askLocation]);

  // Your own plans and name, for the People layer.
  useEffect(() => {
    let cancelled = false;
    getMyEvents(userId)
      .then((mine) => {
        if (!cancelled) setMyEvents(mine);
      })
      .catch(() => {});
    getUserById(userId)
      .then((me) => {
        if (!cancelled) setMyName(me?.name ?? '');
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [userId]);

  useEffect(() => {
    const settle = setTimeout(() => setSearch(query.trim()), SEARCH_DELAY_MS);
    return () => clearTimeout(settle);
  }, [query]);

  useEffect(() => {
    if (search === '') {
      setFoundGroups([]);
      return;
    }

    let cancelled = false;

    searchGroups(search, 10)
      .then((found) => {
        if (!cancelled) setFoundGroups(found);
      })
      .catch(() => {
        if (!cancelled) setFoundGroups([]);
      });

    return () => {
      cancelled = true;
    };
  }, [search]);

  useEffect(() => {
    let cancelled = false;

    async function loadFollows() {
      const mine = await getActingSquad(userId);
      if (cancelled || !mine) return;
      setActing(mine);

      const followed = await getFollowing(mine.id);
      if (!cancelled) {
        setFollowing(Object.fromEntries(followed.map((group) => [group.id, true as const])));
      }
    }

    loadFollows().catch(() => {});

    getGroupsForUser(userId)
      .then((mine) => {
        if (!cancelled) setMyGroupIds(new Set(mine.map((group) => group.id)));
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [userId, followsNonce]);

  useEffect(() => {
    if (!acting) return;
    let cancelled = false;
    getCrossings(acting.id)
      .then((all) => {
        if (cancelled) return;
        const best = [...all].sort((a, b) => b.times - a.times)[0];
        setCrossing(best ? { id: best.otherGroupId, name: best.otherName, avatarUrl: best.otherAvatarUrl, times: best.times } : null);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [acting]);

  const loadFriendsGoing = useCallback(function loadFriendsGoing() {
    getPareaGoing()
      .then((plans) =>
        setFriendsGoing(Object.fromEntries(plans.map((plan) => [plan.event.id, plan.friends]))),
      )
      .catch(() => {});
  }, []);

  useEffect(() => {
    loadFriendsGoing();
  }, [loadFriendsGoing]);

  const load = useCallback(
    async function load(nextPage: number, append: boolean) {
      if (append) setLoadingMore(true);
      else setLoading(true);

      setError(null);

      try {
        const feed = await getFeed(
          {
            center,
            radiusKm,
            tags,
            when: liveOnly ? 'today' : when,
            search: activeSearch || undefined,
            groupIds: followFilter === null ? undefined : followFilter.split(',').filter(Boolean),
          },
          nextPage,
        );

        setEvents((current) => (append ? [...current, ...feed.events] : feed.events));
        setHasMore(feed.hasMore);
        setPage(nextPage);
      } catch {
        setError('Could not load what is happening nearby.');
      } finally {
        loadedOnce.current = true;
        setLoading(false);
        setLoadingMore(false);
        setRefreshing(false);
      }
    },
    [center, radiusKm, tags, when, liveOnly, followFilter, activeSearch],
  );

  useEffect(() => {
    if (locationState === 'asking') return;
    load(0, false);
  }, [load, locationState]);

  const lastResume = useRef(Date.now());

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active' || Date.now() - lastResume.current < 60 * 1000) return;
      lastResume.current = Date.now();
      load(0, false);
      loadFriendsGoing();
    });
    return () => sub.remove();
  }, [load, loadFriendsGoing]);

  useEffect(() => {
    if (locationState === 'asking') return;

    let cancelled = false;

    getHighlights(center, radiusKm)
      .then((found) => {
        if (cancelled) return;
        setHighlights(found);
        signPaths(found.map((night) => night.cover.path));
      })
      .catch(() => {
        if (!cancelled) setHighlights([]);
      });

    setCityLoading(true);
    getCityNights(center, radiusKm)
      .then((found) => {
        if (!cancelled) setCityNights(found);
      })
      .catch(() => {
        if (!cancelled) setCityNights([]);
      })
      .finally(() => {
        if (!cancelled) setCityLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [center, radiusKm, locationState, signPaths]);

  const highlightSizes = useMemo(
    () => Object.fromEntries(highlights.map((night) => [night.group.id, night.group.memberCount])),
    [highlights],
  );

  function toggleTag(tag: EventTag) {
    setTags(function (current) {
      return current.includes(tag) ? current.filter((t) => t !== tag) : [...current, tag];
    });
  }

  // Following is the acting squad's vote, started on its Votes page.
  function toggleFollow(groupId: string) {
    if (!acting || acting.id === groupId) return;
    onOpenVotes(acting.id);
  }

  function openProfile(card: CardGroup) {
    setProfileGroup({
      id: card.id,
      handle: card.handle,
      name: card.name,
      bio: card.bio,
      avatarUrl: card.avatarUrl ?? null,
      bannerUrl: card.bannerUrl ?? null,
      wallpaperUrl: null,
      memoriesPublic: false,
      memberCount: card.memberCount,
      createdAt: '',
      followerCount: card.followerCount,
    });
  }

  function followHandler(groupId: string) {
    if (!acting || acting.id === groupId) return undefined;
    return () => toggleFollow(groupId);
  }

  // "Search wider": the next radius up, staying at the widest.
  function widenRadius() {
    setRadiusKm(RADII.find((km) => km > radiusKm) ?? RADII[RADII.length - 1]);
  }

  // Suggesting a public plan to the parea you act as: it lands in its chat.
  const [suggestingId, setSuggestingId] = useState<string | null>(null);
  const [suggestNote, setSuggestNote] = useState<string | null>(null);

  function canSuggest(plan: FeedEvent): boolean {
    return acting !== null && plan.groupId !== acting.id && plan.date >= keyOf(new Date());
  }

  async function handleSuggest(plan: FeedEvent) {
    if (!acting || suggestingId) return;
    const to = acting;
    setSuggestingId(plan.id);
    setSuggestNote(null);
    setError(null);
    try {
      const posted = await suggestPlan(to.id, plan.id);
      setSuggestNote(posted ? `Suggested in ${to.name}'s chat.` : `Already suggested in ${to.name}.`);
    } catch (problem) {
      setError(errorText(problem, 'Could not suggest it. Try again.'));
    } finally {
      setSuggestingId(null);
    }
  }

  useEffect(() => {
    if (!suggestNote) return;
    const timer = setTimeout(() => setSuggestNote(null), 2600);
    return () => clearTimeout(timer);
  }, [suggestNote]);

  async function handleRsvp(eventId: string, status: RsvpStatus | null) {
    setSavingId(eventId);
    setError(null);

    try {
      if (status) await setRsvp(eventId, status);
      else await clearRsvp(eventId);

      setEvents((current) =>
        current.map((event) => (event.id === eventId ? applyRsvp(event, status) : event)),
      );
    } catch {
      setError('Could not save your answer. Try again.');
    } finally {
      setSavingId(null);
    }
  }

  function loadMore() {
    if (!hasMore || loading || loadingMore) return;
    load(page + 1, true);
  }

  const now = useNow();
  const live = events.filter(
    (event) => event.myStatus !== 'out' && isHappeningNow(event.date, event.startTime, event.endTime, now),
  );
  const liveIds = new Set(live.map((event) => event.id));
  const visible = liveOnly
    ? live
    : events.filter((event) => event.myStatus === undefined && !liveIds.has(event.id));
  // The city's line keeps the plans you said yes to, so Join can be taken back.
  const linePlans = liveOnly ? live : events.filter((event) => event.myStatus !== 'out');
  const hasFilters =
    tags.length > 0 || when !== null || followingOnly || liveOnly || activeSearch !== '';

  function clearFilters() {
    setTags([]);
    setWhen(null);
    setFollowingOnly(false);
    setLiveOnly(false);
    setQuery('');
    setSearch('');
  }

  function emptyTitle() {
    if (activeSearch !== '') return `No plans match “${activeSearch}”`;
    if (liveOnly) return 'Nothing live right now';
    return 'Nothing open around here';
  }

  function emptyBody() {
    if (activeSearch !== '') return 'Try another word, or clear your filters.';
    if (liveOnly) return 'No public plans are happening near you at the moment.';
    if (followingOnly && followedIds === '') {
      return `${acting?.name ?? 'Your parea'} follows nobody yet. Find one you like and follow it from its page.`;
    }
    if (hasFilters) return 'No public plans match those filters yet. Try clearing them.';
    return 'No public plans in range. Try a wider radius.';
  }

  const nothingOpen = (
    <ListEmpty
      title={emptyTitle()}
      body={emptyBody()}
      actionLabel={hasFilters ? 'Clear filters' : 'Search wider'}
      onAction={hasFilters ? clearFilters : widenRadius}
    />
  );

  useEffect(() => {
    if (error || !hasMore || loading || loadingMore) return;
    if (visible.length >= MIN_VISIBLE) return;
    load(page + 1, true);
  }, [visible.length, error, hasMore, loading, loadingMore, page, load]);

  const onMap = (liveOnly ? live : events).filter((event) => event.myStatus !== 'out');

  // People: whoever is sharing their spot on a plan of yours that is on now.
  const sharingIds = myEvents
    .filter((event) => event.myStatus === 'in' && isHappeningNow(event.date, event.startTime, event.endTime, now))
    .map((event) => event.id);
  const livePeople = useLivePeopleAround(features.liveLocation ? sharingIds : [], { id: userId, name: myName });

  // Pareas: yours and the ones you follow, at the place of their current or next plan.
  const pareaPins = useMemo(() => {
    const today = new Date();
    const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    const candidates = [
      ...myEvents.map((event) => ({ ...event, place: event.placeLabel ?? event.location ?? '' })),
      ...events.filter((event) => following[event.groupId]).map((event) => ({ ...event, place: event.placeLabel })),
    ]
      .filter((event) => event.lat !== undefined && event.lng !== undefined && event.date >= todayKey)
      .sort((a, b) => `${a.date} ${a.startTime ?? ''}`.localeCompare(`${b.date} ${b.startTime ?? ''}`));

    const byGroup = new Map<string, MapPin>();
    for (const event of candidates) {
      if (byGroup.has(event.groupId)) continue;
      byGroup.set(event.groupId, {
        id: `parea-${event.groupId}`,
        lat: event.lat as number,
        lng: event.lng as number,
        label: event.place ? `${event.groupName} · ${event.place}` : event.groupName,
        color: solidFor(event.groupName),
        badge: initialsFor(event.groupName),
      });
    }
    return [...byGroup.values()];
  }, [myEvents, events, following]);

  const peoplePins: MapPin[] = [
    ...(features.publicProfiles ? pareaPins : []),
    ...livePeople.map((person) => ({
      id: `person-${person.id}`,
      lat: person.lat,
      lng: person.lng,
      label: person.name,
      color: solidFor(person.name),
      badge: person.name.trim().charAt(0).toUpperCase() || '?',
    })),
  ];

  function pressPeoplePin(id: string) {
    if (!id.startsWith('parea-')) return;
    getGroupById(id.slice('parea-'.length))
      .then((group) => {
        if (group) setProfileGroup(group);
      })
      .catch(() => {});
  }

  const selected = onMap.find((event) => event.id === selectedId);

  function closeMapSearch() {
    setMapSearching(false);
    setQuery('');
  }

  function searchBar(floating = false) {
    return (
      <View style={[styles.search, floating && styles.searchFloating]}>
        <Ionicons name="search" size={17} color={colors.textFaint} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search plans and pareas"
          placeholderTextColor={colors.textFaint}
          returnKeyType="search"
          autoCapitalize="none"
          autoCorrect={false}
          autoFocus={floating}
          accessibilityLabel="Search plans and pareas"
          style={styles.searchInput}
        />
        {query.length > 0 ? (
          <Pressable
            onPress={() => setQuery('')}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Clear search"
          >
            <Ionicons name="close-circle" size={18} color={colors.textFaint} />
          </Pressable>
        ) : null}
      </View>
    );
  }

  const today = new Date();
  const kicker = `EXPLORE · ${today
    .toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
    .replace(',', '')
    .toUpperCase()}`;
  const foundCity = search === '' ? cityOf(events) : null;
  if (foundCity) lastCity.current = foundCity;
  const city = lastCity.current ?? (locationState === 'on' ? 'Around you' : 'Everywhere');
  const timeOfDay = today.getHours() >= 17 ? 'tonight' : 'today';
  const filtersOn =
    (locationState === 'on' && radiusKm !== DEFAULT_RADIUS_KM ? 1 : 0) +
    (when ? 1 : 0) +
    tags.length +
    (liveOnly ? 1 : 0) +
    (followingOnly ? 1 : 0);
  const appliedText = [
    locationState === 'on' ? `Within ${radiusKm} km` : 'Everywhere (location is off)',
    liveOnly ? 'live now' : when ? WHEN_OPTIONS.find((option) => option.key === when)?.label.toLowerCase() : 'any day',
    tags.length === 1 ? tagLabel(tags[0]).toLowerCase() : tags.length > 1 ? `${tags.length} kinds` : null,
    followingOnly ? 'following' : null,
  ]
    .filter(Boolean)
    .join(' · ');
  const upcoming = linePlans.filter((plan) => plan.date >= keyOf(now)).length;
  const tabCounts = { plans: upcoming, people: livePeople.length, nights: cityNights.length };

  function chooseTab(next: ExploreTab) {
    if (next === 'people') {
      setLayer('people');
      setSelectedId(null);
      setMode('map');
      return;
    }
    if (mode === 'map' && next === 'plans' && layer !== 'plans') {
      setLayer('plans');
      setSelectedId(null);
      return;
    }
    setTab(next);
    setLayer('plans');
    setMode('list');
  }

  function toggleMode() {
    if (mode === 'list') {
      setLayer('plans');
      setMode('map');
      // A search typed in the list stays visible on the map.
      setMapSearching(query !== '');
    } else {
      setMode('list');
    }
  }

  const controls = (
    <>
      <ExploreHero
        kicker={kicker}
        city={city}
        when={timeOfDay}
        liveCount={live.length}
        rowCenter={FAB_CENTER_Y + EXPLORE_FAB_DROP}
        onPressLive={() => setLiveOnly(!liveOnly)}
      />
      <ExploreTools
        query={query}
        onQuery={setQuery}
        filtersOn={filtersOn}
        onFilters={() => setFiltersOpen(true)}
        mode="list"
        onMode={toggleMode}
      />
      <ExploreApplied text={appliedText} onChange={() => setFiltersOpen(true)} />
      {search === '' ? <ExploreTabs tab={tab} counts={tabCounts} onTab={chooseTab} tabs={features.liveLocation ? ['plans', 'people', 'nights'] : ['plans', 'nights']} /> : null}
    </>
  );

  const header = (
    <View style={styles.header}>
      {controls}

      {features.extraMemoryViews && search === '' && !liveOnly ? (
        <MemoriesBar
          userId={userId}
          scope="explore"
          title="Last nights out"
          meta="Shared by pareas nearby"
          nights={highlights}
          groupSizes={highlightSizes}
          signed={signed}
          signPaths={signPaths}
          onImageError={dropSigned}
          onOpenGroup={(night) => {
            const found = highlights.find((one) => one.event.id === night.event.id);
            if (found) openProfile(found.group);
          }}
        />
      ) : null}

      {search !== '' ? (
        foundGroups.length > 0 ? (
          <View>
            <SectionHead title="Pareas" count={foundGroups.length} />
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={styles.groupRow}
            >
              {foundGroups.map((group) => (
                <GroupCard
                  key={group.id}
                  group={group}
                  following={following[group.id] === true}
                  member={myGroupIds.has(group.id)}
                  onPress={() => openProfile(group)}
                  onFollow={features.squadFollows ? followHandler(group.id) : undefined}
                />
              ))}
            </ScrollView>
          </View>
        ) : null
      ) : null}

      {search !== '' && visible.length > 0 ? (
        <SectionHead
          title={liveOnly ? 'Happening now' : search !== '' ? 'Plans' : center ? 'Closest to you' : 'Open to Parea'}
          live={liveOnly}
        />
      ) : null}
    </View>
  );

  function measureNow() {
    const node = nowRef.current;
    const line = lineRef.current;
    if (!node || !line) return;
    node.measureLayout(line, (_x, y) => setNowAt((was) => (was === y ? was : y)), () => {});
    const mark = todayRef.current;
    if (mark) mark.measureLayout(line, (_x, y) => setTodayAt((was) => (was === y ? was : y)), () => {});
  }

  // Each time the line shows (opening Explore, coming back from the map), it
  // starts on NOW.
  const onLine = mode === 'list' && search === '';
  useEffect(() => {
    anchored.current = false;
  }, [tab]);
  useEffect(() => {
    if (!onLine) {
      anchored.current = false;
      return;
    }
    // The plans above NOW have to be in first, or NOW would move after.
    if (anchored.current || loading || todayAt === null || listHeight === 0) return;
    anchored.current = true;
    listRef.current?.scrollToOffset({ offset: Math.max(0, todayAt - TODAY_ROOM), animated: false });
  }, [onLine, loading, todayAt, listHeight]);

  // A list that mounts again starts at its top: unfold, and find NOW again.
  function listMounted() {
    setFolded(false);
    topEdge.setValue(0);
    anchored.current = false;
  }

  function onListScroll(event: { nativeEvent: { contentOffset: { y: number } } }) {
    const y = event.nativeEvent.contentOffset.y;
    topEdge.setValue(Math.min(1, Math.max(0, y / EDGE_FADE_IN)));
    const fold = y > HERO_HEIGHT - FOLD_EARLY;
    if (fold !== folded) setFolded(fold);
  }

  const filterSheet = (
    <FilterSheet
      visible={filtersOpen}
      radii={RADII}
      radiusKm={radiusKm}
      onRadius={setRadiusKm}
      locationOn={locationState === 'on'}
      onTurnOnLocation={askLocation}
      when={when}
      onWhen={setWhen}
      tags={tags}
      onToggleTag={toggleTag}
      liveOnly={liveOnly}
      onLiveOnly={setLiveOnly}
      followingOnly={features.squadFollows ? followingOnly : undefined}
      onFollowingOnly={features.squadFollows ? setFollowingOnly : undefined}
      followingNote={acting ? `Pareas ${acting.name} follows` : undefined}
      count={mode === 'map' ? onMap.length : upcoming}
      loading={loading}
      onReset={() => {
        clearFilters();
        setRadiusKm(DEFAULT_RADIUS_KM);
      }}
      onClose={() => setFiltersOpen(false)}
    />
  );

  if (profileGroup) {
    return (
      <GroupScreen
        group={profileGroup}
        userId={userId}
        backLabel="Explore"
        onOpenVotes={onOpenVotes}
        onBack={() => {
          // The profile can follow or unfollow; pick that up on the cards.
          setProfileGroup(null);
          listMounted();
          setFollowsNonce((n) => n + 1);
        }}
        onLeave={() => {
          setProfileGroup(null);
          listMounted();
          setFollowsNonce((n) => n + 1);
          load(0, false);
        }}
      />
    );
  }

  if (loading && !loadedOnce.current) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </SafeAreaView>
    );
  }

  const sheet = (
    <EventSheet
      event={openEvent}
      currentUserId={userId}
      onClose={() => setOpenEvent(null)}
      onChanged={() => load(0, false)}
    />
  );

  if (mode === 'map') {
    const nothingFound = layer === 'plans' && !loading && !error && onMap.length === 0;
    const nobodyOut = layer === 'people' && livePeople.length === 0;

    return (
      <View style={styles.screen}>
        {/* Always up: a filter that finds nothing just leaves the map without pins. */}
        <MapView
          pins={
            layer === 'people'
              ? peoplePins
              : onMap.map((event) => ({
                  id: event.id,
                  lat: event.lat,
                  lng: event.lng,
                  label: event.title,
                  color: event.myStatus === 'in' ? colors.success : colors.accent,
                  selected: event.id === selectedId,
                }))
          }
          showsUserLocation={locationState === 'on'}
          interactive
          spanKm={2}
          onPressPin={layer === 'people' ? pressPeoplePin : setSelectedId}
          onPress={() => setSelectedId(null)}
          insets={{ top: islandsBottom + space.sm, bottom: NAV_CLEARANCE }}
          fallbackCenter={center ?? DEFAULT_MAP_CENTER}
          style={styles.mapFull}
        />

        <SafeAreaView style={styles.floating} pointerEvents="box-none">
          <View
            style={[styles.column, styles.islands]}
            pointerEvents="box-none"
            onLayout={(e) => setIslandsBottom(e.nativeEvent.layout.y + e.nativeEvent.layout.height)}
          >
            <Glass style={styles.island}>
              {mapSearching ? (
                <View style={styles.mapSearchRow}>
                  <View style={styles.mapSearchField}>{searchBar(true)}</View>
                  <Pressable
                    onPress={closeMapSearch}
                    accessibilityRole="button"
                    accessibilityLabel="Close search"
                    hitSlop={6}
                    style={({ pressed }) => pressed && styles.pressed}
                  >
                    <Text style={styles.cancelText}>Cancel</Text>
                  </Pressable>
                </View>
              ) : (
                <>
                  <ExploreTitleRow
                    kicker={layer === 'people' ? 'EXPLORE · RIGHT NOW' : `EXPLORE · ${timeOfDay.toUpperCase()}`}
                    title={layer === 'people' ? "Who's out" : city}
                    onSearch={layer === 'plans' ? () => setMapSearching(true) : undefined}
                    filtersOn={filtersOn}
                    onFilters={layer === 'plans' ? () => setFiltersOpen(true) : undefined}
                    mode="map"
                    onMode={toggleMode}
                  />
                  <ExploreTabs
                    tab={layer === 'people' ? 'people' : 'plans'}
                    counts={tabCounts}
                    onTab={chooseTab}
                    tabs={features.liveLocation ? ['plans', 'people', 'nights'] : ['plans', 'nights']}
                    compact
                  />
                </>
              )}
              {nothingFound ? (
                <Text style={styles.nothingFound} accessibilityLiveRegion="polite">
                  Nothing found
                </Text>
              ) : null}
              {nobodyOut ? (
                <Text style={styles.nothingFound} accessibilityLiveRegion="polite">
                  Nobody's sharing right now. Spots show up while a plan is on.
                </Text>
              ) : null}
            </Glass>

            {mapSearching && foundGroups.length > 0 && features.publicProfiles ? (
              <Glass radius={radius.lg} style={styles.chipIsland}>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  keyboardShouldPersistTaps="handled"
                  contentContainerStyle={styles.chipsFloating}
                >
                  {foundGroups.map((group) => (
                    <Pressable
                      key={group.id}
                      onPress={() => openProfile(group)}
                      accessibilityRole="button"
                      accessibilityLabel={`Open ${group.name}`}
                      style={({ pressed }) => [styles.foundSquad, pressed && styles.pressed]}
                    >
                      <Monogram name={group.name} uri={group.avatarUrl} size={26} />
                      <Text style={styles.foundName} numberOfLines={1}>
                        {group.name}
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </Glass>
            ) : null}


            {error ? (
              <Glass radius={radius.lg} style={styles.island}>
                <Text style={[styles.error, styles.flush]}>{error}</Text>
              </Glass>
            ) : null}
            {suggestNote ? (
              <Glass radius={radius.lg} style={styles.island}>
                <Text style={[styles.suggested, styles.flush]} accessibilityLiveRegion="polite">
                  {suggestNote}
                </Text>
              </Glass>
            ) : null}
          </View>
        </SafeAreaView>

        {selected ? (
          <View style={styles.popWrap} pointerEvents="box-none">
            <PopIn key={selected.id} style={styles.popCard}>
              <EventCard
                {...cardProps(selected)}
                action="rsvp"
                saving={savingId === selected.id}
                onPress={() => setOpenEvent(toSheetEvent(selected))}
                onRsvp={(status) => handleRsvp(selected.id, status)}
              />
              {acting && canSuggest(selected) ? (
                <Pressable
                  onPress={() => handleSuggest(selected)}
                  disabled={suggestingId === selected.id}
                  accessibilityRole="button"
                  accessibilityLabel={`Suggest ${selected.title} to ${acting.name}`}
                  style={({ pressed }) => [styles.suggestPill, pressed && styles.pressed]}
                >
                  <Ionicons name="paper-plane-outline" size={15} color={colors.primary} />
                  <Text style={styles.suggestPillText} numberOfLines={1}>
                    {suggestingId === selected.id ? 'Suggesting…' : `Suggest to ${acting.name}`}
                  </Text>
                </Pressable>
              ) : null}
            </PopIn>
          </View>
        ) : null}

        {sheet}
        {filterSheet}
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.screen}>
      <TicketBackdrop />
      <View style={styles.listPage} onLayout={(event) => setListHeight(event.nativeEvent.layout.height)}>
        <FlatList
          ref={listRef}
          onScroll={onListScroll}
          scrollEventThrottle={32}
          onContentSizeChange={onLine ? measureNow : undefined}
          keyboardShouldPersistTaps="handled"
          data={search === '' ? [] : visible}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.content}
          ListHeaderComponent={
            search === '' ? (
              <View ref={lineRef} collapsable={false}>
                {header}
                <CityLine
                  plans={linePlans}
                  nights={cityNights}
                  nightsLoading={cityLoading}
                  now={now}
                  center={center}
                  me={{ id: userId, name: myName, avatarUrl: null }}
                  acting={acting}
                  savingId={savingId}
                  signed={signed}
                  signPaths={signPaths}
                  onImageError={dropSigned}
                  onOpenPlan={(plan) => setOpenEvent(toSheetEvent(plan))}
                  onRsvp={(plan, status) => handleRsvp(plan.id, status)}
                  onOpenGroup={(id) => {
                    getGroupById(id)
                      .then((group) => {
                        if (group) setProfileGroup(group);
                      })
                      .catch(() => {});
                  }}
                  onShowMap={() => setMode('map')}
                  onClearFilters={hasFilters ? clearFilters : undefined}
                  suggestTo={acting?.name ?? null}
                  canSuggest={canSuggest}
                  onSuggest={handleSuggest}
                  suggestingId={suggestingId}
                  nowRef={nowRef}
                  onNowLayout={measureNow}
                  todayRef={todayRef}
                  onTodayLayout={measureNow}
                  show={tab === 'nights' ? 'nights' : 'all'}
                  crossing={
                    crossing
                      ? {
                          name: crossing.name,
                          avatarUrl: crossing.avatarUrl,
                          times: crossing.times,
                          onPress: () => {
                            getGroupById(crossing.id)
                              .then((group) => {
                                if (group) setProfileGroup(group);
                              })
                              .catch(() => {});
                          },
                        }
                      : null
                  }
                />
              </View>
            ) : (
              header
            )
          }
          ListEmptyComponent={
            search === '' ? null : 
            <View style={styles.empty}>
              {events.length > 0 ? (
                <ListEmpty
                  title="That is everything, for now"
                  body="You have answered every open plan around here. Widen the radius or come back later."
                  actionLabel="Search wider"
                  onAction={widenRadius}
                />
              ) : (
                nothingOpen
              )}
            </View>
          }
          renderItem={({ item }) => (
            <View style={styles.item}>
              <EventCard
                {...cardProps(item)}
                action="rsvp"
                saving={savingId === item.id}
                onPress={() => setOpenEvent(toSheetEvent(item))}
                onRsvp={(status) => handleRsvp(item.id, status)}
              />
            </View>
          )}
          onEndReached={search === '' ? undefined : loadMore}
          onEndReachedThreshold={0.5}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                load(0, false);
                loadFriendsGoing();
              }}
              tintColor={colors.primary}
            />
          }
        />
        {onLine ? <EdgeFades top={topEdge} /> : null}

        {/* What Suggest did, or what went wrong, over the line where you are. */}
        {error || suggestNote ? (
          <View style={styles.toastWrap} pointerEvents="none">
            <Text
              style={[styles.toast, error ? styles.toastError : null]}
              accessibilityLiveRegion="polite"
            >
              {error ?? suggestNote}
            </Text>
          </View>
        ) : null}

        {/* The header, folded into a glass bar once it has scrolled away. */}
        {folded ? (
          <Glass radius={0} sheen={alpha(colors.bg, 0.86)} style={styles.folded}>
            <ExploreTitleRow
              kicker={`EXPLORE · ${timeOfDay.toUpperCase()}`}
              title={city}
              onSearch={() => listRef.current?.scrollToOffset({ offset: 0, animated: true })}
              filtersOn={filtersOn}
              onFilters={() => setFiltersOpen(true)}
              mode="list"
              onMode={toggleMode}
            />
            {search === '' ? (
              <ExploreTabs
                tab={tab}
                counts={tabCounts}
                onTab={chooseTab}
                tabs={features.liveLocation ? ['plans', 'people', 'nights'] : ['plans', 'nights']}
                compact
              />
            ) : null}
          </Glass>
        ) : null}
      </View>

      {sheet}
      {filterSheet}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  listPage: { flex: 1 },
  toastWrap: { position: 'absolute', left: space.md, right: space.md, bottom: space.xl, alignItems: 'center' },
  toast: {
    overflow: 'hidden',
    paddingVertical: space.sm,
    paddingHorizontal: space.md,
    borderRadius: radius.lg,
    backgroundColor: colors.ink,
    color: colors.onInk,
    ...typo.semi,
    fontSize: textSize.body,
    textAlign: 'center',
  },
  toastError: { backgroundColor: colors.danger },
  center: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
  content: {
    width: '100%',
    maxWidth: layout.column,
    alignSelf: 'center',
    paddingBottom: 110,
  },

  header: { gap: space.sm, paddingBottom: space.sm },
  folded: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingTop: TITLE_TOP,
    paddingHorizontal: space.md,
    borderWidth: 0,
    borderBottomWidth: 1,
    borderBottomColor: alpha(colors.borderStrong, 0.7),
  },
  column: { width: '100%', maxWidth: layout.column, alignSelf: 'center' },
  mapSearchRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  mapSearchField: { flex: 1 },
  searchFloating: { marginHorizontal: 0 },
  cancelText: { color: colors.primary, ...typo.semi, fontSize: textSize.base },
  nothingFound: { color: colors.textSoft, ...typo.medium, fontSize: textSize.body },
  foundSquad: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    maxWidth: 200,
    height: 36,
    paddingLeft: 5,
    paddingRight: space.sm,
    marginRight: space.xs,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
  },
  foundName: { flexShrink: 1, color: colors.text, ...typo.semi, fontSize: textSize.body },
  mapFull: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    height: undefined,
    borderRadius: 0,
  },
  floating: { position: 'absolute', top: 0, right: 0, left: 0 },
  popWrap: {
    position: 'absolute',
    right: 0,
    bottom: NAV_CLEARANCE - space.xs,
    left: 0,
    alignItems: 'center',
    paddingHorizontal: 14,
  },
  popCard: { width: '100%', maxWidth: layout.column, borderRadius: radius.lg, ...shadow.hero },
  islands: {
    gap: space.sm,
    paddingHorizontal: space.lg - ISLAND_PAD - GLASS_BORDER,
    paddingTop: space.sm,
  },
  island: { paddingHorizontal: ISLAND_PAD, paddingVertical: space.sm, gap: space.xs },
  chipIsland: { paddingVertical: space.xs },
  chipsFloating: { paddingHorizontal: space.sm },
  flush: { paddingHorizontal: 0 },

  pressed: { opacity: 0.7 },

  search: {
    height: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    marginHorizontal: space.lg,
    paddingHorizontal: space.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
  },
  searchInput: { flex: 1, height: 44, color: colors.text, ...typo.medium, fontSize: 15 },
  groupRow: { gap: space.sm, paddingHorizontal: space.lg },

  suggestPill: {
    alignSelf: 'center',
    marginTop: space.xs + 2,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 40,
    paddingHorizontal: 16,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    ...shadow.card,
  },
  suggestPillText: { color: colors.primary, ...typo.bold, fontSize: textSize.body },
  suggested: {
    paddingHorizontal: space.lg,
    color: colors.success,
    ...typo.semi,
    fontSize: textSize.body,
  },
  error: {
    paddingHorizontal: space.lg,
    color: colors.danger,
    ...typo.medium,
    fontSize: textSize.body,
  },
  item: { paddingHorizontal: space.lg, paddingBottom: space.sm },
  empty: { paddingHorizontal: space.lg, paddingTop: space.sm },
});
