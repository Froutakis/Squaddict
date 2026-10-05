import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import {
  ActivityIndicator,
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
  type FeedGroup,
  type FeedHighlight,
  type FeedWhen,
} from '../services/serviceFeed';
import { isHappeningNow } from '../lib/datetime';
import { useNow } from '../components/home/useNow';
import { getGroupById, getGroupsForUser, searchGroups, type Group } from '../services/serviceGroup';
import { getActingSquad, getUserById } from '../services/serviceUser';
import { getFollowing } from '../services/serviceFollow';
import { clearRsvp, getMyEvents, setRsvp, type MyEvent, type RsvpStatus } from '../services/serviceEvents';
import { getCurrentCoords, type Coords, type LocationState } from '../services/serviceLocation';
import { EVENT_TAGS, tagLabel, type EventTag } from '../lib/tags';
import EventCard, { type CardEvent } from '../components/events/EventCard';
import RsvpButtons from '../components/events/RsvpButtons';
import type { Person } from '../lib/people';
import { colors, typo, layout, radius, shadow, solidFor, space, textSize } from '../theme';
import Chip from '../components/general/Chip';
import SectionHead from '../components/general/SectionHead';
import ListEmpty from '../components/home/ListEmpty';
import GroupCard, { type CardGroup } from '../components/group/GroupCard';
import GroupScreen from './GroupScreen';
import Monogram, { initialsFor } from '../components/general/Monogram';
import { useLivePeopleAround } from '../components/events/useLivePeopleAround';
import type { MapPin } from '../components/general/mapShared';
import Glass from '../components/general/Glass';
import PopIn from '../components/general/PopIn';
import DropdownChip from '../components/general/DropdownChip';
import MapView from '../components/general/Map';
import EventSheet, { type SheetEvent } from '../components/events/EventSheet';
import MemoriesBar from '../components/home/MemoriesBar';
import { useSignedImages } from '../components/home/useSignedImages';
import { FAB_CENTER_Y, FAB_INSET } from '../components/general/MenuFab';
import { features } from '../lib/features';
import CityLine from '../components/explore/CityLine';
import { getCityNights, type FeedPhoto } from '../services/servicePhotoFeed';

const RADII = [5, 10, 25, 50, 100];
// Where the map looks before we know where you are: Thessaloniki.
const DEFAULT_MAP_CENTER = { lat: 40.6401, lng: 22.9444 };
const RADIUS_OPTIONS = RADII.map((km) => ({ key: String(km), label: `${km} km` }));

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
const TITLE_ROW = 36;
// How far the floating menu button drops on Explore to sit level with the title.
export const EXPLORE_FAB_DROP = TITLE_TOP + TITLE_ROW / 2 - FAB_CENTER_Y;
const SEARCH_DELAY_MS = 300;

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
    coverUrl: event.coverUrl,
  };
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

function mergeGroups(current: FeedGroup[], more: FeedGroup[]): FeedGroup[] {
  const byId = new Map(current.map((group) => [group.id, group]));

  for (const group of more) {
    const seen = byId.get(group.id);
    byId.set(group.id, seen ? { ...seen, openEvents: seen.openEvents + group.openEvents } : group);
  }

  return [...byId.values()];
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
  const [groups, setGroups] = useState<FeedGroup[]>([]);
  // Follows belong to the acting squad, not to the person.
  const [acting, setActing] = useState<Group | null>(null);
  const [following, setFollowing] = useState<Record<string, true>>({});
  const [followsNonce, setFollowsNonce] = useState(0);
  const [profileGroup, setProfileGroup] = useState<Group | null>(null);
  // The map is the front page of Explore; the list is one tap away.
  const [mode, setMode] = useState<ViewMode>('map');
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
        setGroups((current) => (append ? mergeGroups(current, feed.groups) : feed.groups));
        setHasMore(feed.hasMore);
        setPage(nextPage);
      } catch {
        setError('Could not load what is happening nearby.');
      } finally {
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
      return `${acting?.name ?? 'Your squad'} does not follow any pareas yet. Follow one from Pareas you crossed.`;
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

  function layerSwitch() {
    return (
      <View style={styles.layers} accessibilityRole="tablist">
        {(['plans', 'people'] as const).map((option) => {
          const on = layer === option;
          return (
            <Pressable
              key={option}
              onPress={() => {
                setLayer(option);
                setSelectedId(null);
              }}
              accessibilityRole="tab"
              accessibilityState={{ selected: on }}
              accessibilityLabel={option === 'plans' ? 'Show plans' : `Show people and pareas${livePeople.length ? `, ${livePeople.length} sharing now` : ''}`}
              style={[styles.layer, on && styles.layerOn]}
            >
              <Ionicons
                name={option === 'plans' ? 'ticket-outline' : 'people-outline'}
                size={15}
                color={on ? colors.text : colors.textSoft}
              />
              <Text style={[styles.layerText, on && styles.layerTextOn]}>{option === 'plans' ? 'Plans' : 'People'}</Text>
              {option === 'people' && livePeople.length > 0 ? (
                <View style={styles.layerDot} />
              ) : null}
            </Pressable>
          );
        })}
      </View>
    );
  }

  const selected = onMap.find((event) => event.id === selectedId);

  function titleRow(floating: boolean) {
    return (
      <View style={[styles.titleRow, floating && styles.flush]}>
        <Text style={styles.screenTitle}>Explore</Text>
        <View style={styles.titleActions}>
        {floating ? (
          <Pressable
            onPress={() => setMapSearching(true)}
            accessibilityRole="button"
            accessibilityLabel="Search the map"
            hitSlop={6}
            style={({ pressed }) => [styles.searchButton, pressed && styles.pressed]}
          >
            <Ionicons name="search" size={17} color={colors.text} />
          </Pressable>
        ) : null}
        <View style={styles.toggle}>
          {(['map', 'list'] as const).map((option) => (
            <Pressable
              key={option}
              onPress={() => {
                setMode(option);
                // A search typed in the list stays visible on the map.
                if (option === 'map') setMapSearching(query !== '');
              }}
              accessibilityRole="button"
              accessibilityLabel={option === 'list' ? 'Show as a line' : 'Show on a map'}
              accessibilityState={{ selected: mode === option }}
              style={[styles.toggleItem, mode === option && styles.toggleItemActive]}
            >
              <Ionicons
                name={option === 'list' ? 'list' : 'map-outline'}
                size={17}
                color={mode === option ? colors.textOnBrand : colors.textSoft}
              />
            </Pressable>
          ))}
        </View>
        </View>
      </View>
    );
  }

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

  function locationInfo(floating: boolean) {
    if (locationState === 'on') {
      return (
        <View style={[styles.locationRow, floating && styles.flush]}>
          <Ionicons name="location" size={14} color={colors.primary} />
          <Text style={styles.locationText}>Within {radiusKm} km of you</Text>
        </View>
      );
    }

    if (locationState === 'off') {
      return (
        <Pressable
          onPress={askLocation}
          accessibilityRole="button"
          accessibilityLabel="Turn on location"
          style={({ pressed }) => [
            styles.banner,
            floating && styles.bannerFloating,
            pressed && styles.pressed,
          ]}
        >
          <Ionicons name="location-outline" size={16} color={colors.textSoft} />
          <Text style={styles.bannerText}>
            Showing everything. Turn on location to see what is near you.
          </Text>
          <Text style={styles.bannerAction}>Retry</Text>
        </Pressable>
      );
    }

    return null;
  }

  function chipRow(floating: boolean) {
    return (
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={[styles.chips, floating && styles.chipsFloating]}
      >
        <DropdownChip
          value={String(radiusKm)}
          options={RADIUS_OPTIONS}
          placeholder={`${radiusKm} km`}
          icon="resize-outline"
          clearable={false}
          onChange={(km) => {
            if (km) setRadiusKm(Number(km));
          }}
        />
        <Chip
          label="Live"
          icon={liveOnly ? 'radio' : 'radio-outline'}
          active={liveOnly}
          onPress={() => setLiveOnly(!liveOnly)}
        />
        {liveOnly ? null : (
          <DropdownChip
            value={when}
            options={WHEN_OPTIONS}
            placeholder="Any day"
            icon="calendar-outline"
            onChange={setWhen}
          />
        )}
        {features.squadFollows ? (
          <Chip
            label="Following"
            icon={followingOnly ? 'heart' : 'heart-outline'}
            active={followingOnly}
            onPress={() => setFollowingOnly(!followingOnly)}
          />
        ) : null}
        {EVENT_TAGS.map((tag) => (
          <Chip
            key={tag}
            label={tagLabel(tag)}
            active={tags.includes(tag)}
            onPress={() => toggleTag(tag)}
          />
        ))}
      </ScrollView>
    );
  }

  const controls = (
    <>
      {titleRow(false)}
      {searchBar()}
      {locationInfo(false)}
      {chipRow(false)}
      {error ? <Text style={styles.error}>{error}</Text> : null}
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

      {live.length > 0 && !liveOnly ? (
        <View>
          <SectionHead title="Happening now" live count={live.length} />
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.groupRow}
          >
            {live.map((event) => (
              <View key={event.id} style={styles.liveCard}>
                <EventCard
                  {...cardProps(event)}
                  action="rsvp"
                  saving={savingId === event.id}
                  onPress={() => setOpenEvent(toSheetEvent(event))}
                  onRsvp={(status) => handleRsvp(event.id, status)}
                />
              </View>
            ))}
          </ScrollView>
        </View>
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
      ) : groups.length > 0 && features.publicProfiles ? (
        <View>
          <SectionHead title="Pareas you crossed" meta="Where you met" />
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.groupRow}
          >
            {groups.map((group) => (
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
      ) : null}

      {visible.length > 0 ? (
        <SectionHead
          title={liveOnly ? 'Happening now' : search !== '' ? 'Plans' : center ? 'Closest to you' : 'Open to Parea'}
          live={liveOnly}
        />
      ) : null}
    </View>
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
          setFollowsNonce((n) => n + 1);
        }}
        onLeave={() => {
          setProfileGroup(null);
          setFollowsNonce((n) => n + 1);
          load(0, false);
        }}
      />
    );
  }

  if (loading && events.length === 0) {
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
                  {titleRow(true)}
                  {features.liveLocation ? layerSwitch() : null}
                  {layer === 'plans' ? locationInfo(true) : null}
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

            {layer === 'plans' ? (
              <Glass radius={radius.pill} style={styles.chipIsland}>
                {chipRow(true)}
              </Glass>
            ) : null}

            {error ? (
              <Glass radius={radius.lg} style={styles.island}>
                <Text style={[styles.error, styles.flush]}>{error}</Text>
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
            </PopIn>
          </View>
        ) : null}

        {sheet}
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.screen}>
      <FlatList
        keyboardShouldPersistTaps="handled"
        data={search === '' ? [] : visible}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.content}
        ListHeaderComponent={
          search === '' ? (
            <>
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
              />
            </>
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

      {sheet}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
  content: {
    width: '100%',
    maxWidth: layout.column,
    alignSelf: 'center',
    paddingBottom: 110,
  },

  header: { gap: space.sm, paddingTop: TITLE_TOP, paddingBottom: space.sm },
  column: { width: '100%', maxWidth: layout.column, alignSelf: 'center' },
  // Starts right of the floating menu button.
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingLeft: FAB_INSET,
    paddingRight: space.lg,
  },
  toggle: {
    flexDirection: 'row',
    padding: 3,
    gap: 2,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceAlt,
  },
  toggleItem: {
    width: 38,
    height: 30,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toggleItemActive: { backgroundColor: colors.primary },
  titleActions: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  searchButton: {
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceAlt,
  },
  mapSearchRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  mapSearchField: { flex: 1 },
  searchFloating: { marginHorizontal: 0 },
  cancelText: { color: colors.primary, ...typo.semi, fontSize: textSize.base },
  nothingFound: { color: colors.textSoft, ...typo.medium, fontSize: textSize.body },
  layers: { flexDirection: 'row', padding: 3, gap: 2, borderRadius: radius.pill, backgroundColor: colors.surfaceAlt },
  layer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 34,
    borderRadius: radius.pill,
  },
  layerOn: { backgroundColor: colors.surface, ...shadow.bubble },
  layerText: { color: colors.textSoft, ...typo.semi, fontSize: textSize.body },
  layerTextOn: { color: colors.text, ...typo.bold },
  layerDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.success },
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
  bannerFloating: { marginHorizontal: 0, padding: 0, backgroundColor: 'transparent' },
  screenTitle: {
    color: colors.text,
    ...typo.display,
    fontSize: textSize.hero,
    letterSpacing: -0.5,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: space.lg,
  },
  locationText: { color: colors.textSoft, ...typo.medium, fontSize: textSize.body },

  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    marginHorizontal: space.lg,
    padding: space.sm,
    borderRadius: 12,
    backgroundColor: colors.surfaceAlt,
  },
  bannerText: { flex: 1, color: colors.textSoft, ...typo.medium, fontSize: textSize.small },
  bannerAction: { color: colors.primary, ...typo.semi, fontSize: textSize.small },
  pressed: { opacity: 0.7 },

  chips: { gap: space.xs, paddingHorizontal: space.lg, paddingVertical: 2 },
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
  liveCard: { width: 300 },

  error: {
    paddingHorizontal: space.lg,
    color: colors.danger,
    ...typo.medium,
    fontSize: textSize.body,
  },
  item: { paddingHorizontal: space.lg, paddingBottom: space.sm },
  empty: { paddingHorizontal: space.lg, paddingTop: space.sm },
});
