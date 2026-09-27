import { useCallback, useEffect, useMemo, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import {
  ActivityIndicator,
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
import { getGroupsForUser, searchGroups, type Group } from '../services/serviceGroup';
import { clearRsvp, setRsvp, type RsvpStatus } from '../services/serviceEvents';
import { getCurrentCoords, type Coords, type LocationState } from '../services/serviceLocation';
import { EVENT_TAGS, tagLabel, type EventTag } from '../lib/tags';
import EventCard, { type CardEvent } from '../components/events/EventCard';
import type { Person } from '../lib/people';
import { colors, typo, layout, radius, shadow, space, textSize } from '../theme';
import Chip from '../components/general/Chip';
import SectionHead from '../components/general/SectionHead';
import ListEmpty from '../components/home/ListEmpty';
import GroupCard, { type CardGroup } from '../components/group/GroupCard';
import { userPrefix } from '../components/chat/cache';
import { readJson, writeJson } from '../lib/store';
import GroupScreen from './GroupScreen';
import Glass from '../components/general/Glass';
import PopIn from '../components/general/PopIn';
import DropdownChip from '../components/general/DropdownChip';
import MapView from '../components/general/Map';
import EventSheet, { type SheetEvent } from '../components/events/EventSheet';
import MemoriesBar from '../components/home/MemoriesBar';
import { useSignedImages } from '../components/home/useSignedImages';

const RADII = [5, 10, 25, 50];

const MIN_VISIBLE = 6;

type ViewMode = 'list' | 'map';

const WHEN_OPTIONS: { key: FeedWhen; label: string }[] = [
  { key: 'today', label: 'Today' },
  { key: 'tomorrow', label: 'Tomorrow' },
  { key: 'weekend', label: 'Weekend' },
];

const NAV_CLEARANCE = 110;
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
};

export default function ExploreScreen({ userId }: ExploreScreenProps) {
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
  const [following, setFollowing] = useState<Record<string, true>>({});
  const [profileGroup, setProfileGroup] = useState<Group | null>(null);
  const [mode, setMode] = useState<ViewMode>('list');
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

  const followedIds = Object.keys(following).sort().join(',');
  const followFilter = followingOnly ? followedIds : null;
  const activeSearch = mode === 'map' ? '' : search;

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

    readJson<Record<string, true>>(userPrefix(userId) + 'following').then((stored) => {
      if (!cancelled && stored) setFollowing(stored);
    });

    getGroupsForUser(userId)
      .then((mine) => {
        if (!cancelled) setMyGroupIds(new Set(mine.map((group) => group.id)));
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [userId]);

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

  function toggleFollow(groupId: string) {
    const next = { ...following };
    if (next[groupId]) delete next[groupId];
    else next[groupId] = true;

    setFollowing(next);
    writeJson(userPrefix(userId) + 'following', next);
  }

  function openProfile(card: CardGroup) {
    setProfileGroup({
      id: card.id,
      handle: card.handle,
      name: card.name,
      bio: card.bio,
      avatarUrl: null,
      memberCount: card.memberCount,
    });
  }

  function cycleRadius() {
    const i = RADII.indexOf(radiusKm);
    setRadiusKm(RADII[(i + 1) % RADII.length]);
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
      return 'You are not following any pareas yet. Follow one from Pareas you crossed.';
    }
    if (hasFilters) return 'No public plans match those filters yet. Try clearing them.';
    return 'No public plans in range. Try a wider radius.';
  }

  const nothingOpen = (
    <ListEmpty
      title={emptyTitle()}
      body={emptyBody()}
      actionLabel={hasFilters ? 'Clear filters' : 'Search wider'}
      onAction={hasFilters ? clearFilters : cycleRadius}
    />
  );

  useEffect(() => {
    if (error || !hasMore || loading || loadingMore) return;
    if (visible.length >= MIN_VISIBLE) return;
    load(page + 1, true);
  }, [visible.length, error, hasMore, loading, loadingMore, page, load]);

  const onMap = (liveOnly ? live : events).filter((event) => event.myStatus !== 'out');

  const selected = onMap.find((event) => event.id === selectedId);

  function titleRow(floating: boolean) {
    return (
      <View style={[styles.titleRow, floating && styles.flush]}>
        <Text style={styles.screenTitle}>Explore</Text>
        <View style={styles.toggle}>
          {(['list', 'map'] as const).map((option) => (
            <Pressable
              key={option}
              onPress={() => setMode(option)}
              accessibilityRole="button"
              accessibilityLabel={option === 'list' ? 'Show as a list' : 'Show on a map'}
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
    );
  }

  function searchBar() {
    return (
      <View style={styles.search}>
        <Ionicons name="search" size={17} color={colors.textFaint} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search plans and pareas"
          placeholderTextColor={colors.textFaint}
          returnKeyType="search"
          autoCapitalize="none"
          autoCorrect={false}
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
        <Chip label={`${radiusKm} km`} icon="resize-outline" mono onPress={cycleRadius} />
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
        <Chip
          label="Following"
          icon={followingOnly ? 'heart' : 'heart-outline'}
          active={followingOnly}
          onPress={() => setFollowingOnly(!followingOnly)}
        />
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

      {search === '' && !liveOnly ? (
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
                  event={toCardData(event, friendsGoing[event.id])}
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
                  onFollow={() => toggleFollow(group.id)}
                />
              ))}
            </ScrollView>
          </View>
        ) : null
      ) : groups.length > 0 ? (
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
                onFollow={() => toggleFollow(group.id)}
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
        onBack={() => setProfileGroup(null)}
        onLeave={() => {
          setProfileGroup(null);
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
    return (
      <View style={styles.screen}>
        {onMap.length > 0 ? (
          <MapView
            pins={onMap.map((event) => ({
              id: event.id,
              lat: event.lat,
              lng: event.lng,
              label: event.title,
              color: event.myStatus === 'in' ? colors.success : colors.accent,
              selected: event.id === selectedId,
            }))}
            showsUserLocation={locationState === 'on'}
            interactive
            spanKm={2}
            onPressPin={setSelectedId}
            onPress={() => setSelectedId(null)}
            insets={{ top: islandsBottom + space.sm, bottom: NAV_CLEARANCE }}
            style={styles.mapFull}
          />
        ) : null}

        <SafeAreaView style={styles.floating} pointerEvents="box-none">
          <View
            style={[styles.column, styles.islands]}
            pointerEvents="box-none"
            onLayout={(e) => setIslandsBottom(e.nativeEvent.layout.y + e.nativeEvent.layout.height)}
          >
            <Glass style={styles.island}>
              {titleRow(true)}
              {locationInfo(true)}
            </Glass>

            <Glass radius={radius.pill} style={styles.chipIsland}>
              {chipRow(true)}
            </Glass>

            {error ? (
              <Glass radius={radius.lg} style={styles.island}>
                <Text style={[styles.error, styles.flush]}>{error}</Text>
              </Glass>
            ) : null}
          </View>

          {onMap.length === 0 ? (
            <View style={[styles.column, styles.islands]} pointerEvents="box-none">
              <Glass radius={radius.lg} style={styles.island}>
                {nothingOpen}
              </Glass>
            </View>
          ) : null}
        </SafeAreaView>

        {selected ? (
          <View style={styles.popWrap} pointerEvents="box-none">
            <PopIn key={selected.id} style={styles.popCard}>
              <EventCard
                event={toCardData(selected, friendsGoing[selected.id])}
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
        data={visible}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.content}
        ListHeaderComponent={header}
        ListEmptyComponent={
          <View style={styles.empty}>
            {events.length > 0 ? (
              <ListEmpty
                title="That is everything, for now"
                body="You have answered every open plan around here. Widen the radius or come back later."
                actionLabel="Search wider"
                onAction={cycleRadius}
              />
            ) : (
              nothingOpen
            )}
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.item}>
            <EventCard
              event={toCardData(item, friendsGoing[item.id])}
              action="rsvp"
              saving={savingId === item.id}
              onPress={() => setOpenEvent(toSheetEvent(item))}
              onRsvp={(status) => handleRsvp(item.id, status)}
            />
          </View>
        )}
        onEndReached={loadMore}
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

  header: { gap: space.sm, paddingTop: space.xs, paddingBottom: space.sm },
  column: { width: '100%', maxWidth: layout.column, alignSelf: 'center' },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.lg,
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
  islands: { gap: space.sm, paddingHorizontal: 14, paddingTop: space.sm },
  island: { paddingHorizontal: space.md, paddingVertical: space.sm, gap: space.xs },
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
