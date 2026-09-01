import { useCallback, useEffect, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  DEFAULT_RADIUS_KM,
  getFeed,
  type Center,
  type FeedEvent,
  type FeedSquad,
} from '../services/serviceFeed';
import { clearRsvp, setRsvp, type RsvpStatus } from '../services/serviceEvents';
import { getCurrentCoords } from '../services/serviceLocation';
import { EVENT_TAGS, tagLabel, type EventTag } from '../lib/tags';
import EventCard, { type EventCardData } from '../components/events/EventCard';
import { colors, font, layout, radius, space, textSize } from '../theme';
import Chip from '../components/general/Chip';
import SectionLabel from '../components/general/SectionLabel';
import ListEmpty from '../components/home/ListEmpty';

const RADII = [5, 10, 25, 50];

type LocationState = 'asking' | 'on' | 'off';

function toCardData(event: FeedEvent): EventCardData {
  return {
    id: event.id,
    title: event.title,
    date: event.date,
    startTime: event.startTime,
    location: event.location,
    placeLabel: event.placeLabel,
    squadName: event.groupName,
    myStatus: event.myStatus,
    going: [],
    goingCount: event.goingCount,
    distanceKm: event.distanceKm,
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

export default function ExploreScreen() {
  const [center, setCenter] = useState<Center | null>(null);
  const [locationState, setLocationState] = useState<LocationState>('asking');

  const [radiusKm, setRadiusKm] = useState(DEFAULT_RADIUS_KM);
  const [tags, setTags] = useState<EventTag[]>([]);

  const [events, setEvents] = useState<FeedEvent[]>([]);
  const [squads, setSquads] = useState<FeedSquad[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [page, setPage] = useState(0);

  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);

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

  const load = useCallback(
    async function load(nextPage: number, append: boolean) {
      if (append) setLoadingMore(true);
      else setLoading(true);

      setError(null);

      try {
        const feed = await getFeed({ center, radiusKm, tags }, nextPage);

        setEvents((current) => (append ? [...current, ...feed.events] : feed.events));
        setSquads(feed.squads);
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
    [center, radiusKm, tags],
  );

  useEffect(() => {
    if (locationState === 'asking') return;
    load(0, false);
  }, [load, locationState]);

  function toggleTag(tag: EventTag) {
    setTags(function (current) {
      return current.includes(tag) ? current.filter((t) => t !== tag) : [...current, tag];
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

  const header = (
    <View style={styles.header}>
      <Text style={styles.screenTitle}>Explore</Text>

      {locationState === 'on' ? (
        <View style={styles.locationRow}>
          <Ionicons name="location" size={14} color={colors.primary} />
          <Text style={styles.locationText}>Within {radiusKm} km of you</Text>
        </View>
      ) : null}

      {locationState === 'off' ? (
        <Pressable
          onPress={askLocation}
          accessibilityRole="button"
          accessibilityLabel="Turn on location"
          style={({ pressed }) => [styles.banner, pressed && styles.pressed]}
        >
          <Ionicons name="location-outline" size={16} color={colors.textSoft} />
          <Text style={styles.bannerText}>
            Showing everything. Turn on location to see what is near you.
          </Text>
          <Text style={styles.bannerAction}>Retry</Text>
        </Pressable>
      ) : null}

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chips}
      >
        <Chip label={`${radiusKm} km`} icon="resize-outline" mono onPress={cycleRadius} />
        {EVENT_TAGS.map((tag) => (
          <Chip
            key={tag}
            label={tagLabel(tag)}
            active={tags.includes(tag)}
            onPress={() => toggleTag(tag)}
          />
        ))}
      </ScrollView>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {events.length > 0 ? (
        <View style={styles.sectionHead}>
          <SectionLabel>{center ? 'Closest to you' : 'Open to Parea'}</SectionLabel>
        </View>
      ) : null}
    </View>
  );

  if (loading && events.length === 0) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen}>
      <FlatList
        data={events}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.content}
        ListHeaderComponent={header}
        ListEmptyComponent={
          <View style={styles.empty}>
            <ListEmpty
              title="Nothing open around here"
              body={
                tags.length > 0
                  ? 'No public plans match those tags yet. Try clearing them.'
                  : 'No public plans in range. Try a wider radius.'
              }
              actionLabel={tags.length > 0 ? 'Clear filters' : 'Search wider'}
              onAction={tags.length > 0 ? () => setTags([]) : cycleRadius}
            />
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.item}>
            <EventCard
              event={toCardData(item)}
              action={item.isMember ? 'rsvp' : 'request'}
              saving={savingId === item.id}
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
            }}
            tintColor={colors.primary}
          />
        }
      />
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
  screenTitle: {
    paddingHorizontal: space.lg,
    color: colors.text,
    fontFamily: font.display,
    fontSize: textSize.hero,
    letterSpacing: -0.5,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: space.lg,
  },
  locationText: { color: colors.textSoft, fontFamily: font.medium, fontSize: textSize.body },

  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    marginHorizontal: space.lg,
    padding: space.sm,
    borderRadius: 12,
    backgroundColor: colors.surfaceAlt,
  },
  bannerText: { flex: 1, color: colors.textSoft, fontFamily: font.medium, fontSize: textSize.small },
  bannerAction: { color: colors.primary, fontFamily: font.semi, fontSize: textSize.small },
  pressed: { opacity: 0.7 },

  chips: { gap: space.xs, paddingHorizontal: space.lg, paddingVertical: 2 },

  error: {
    paddingHorizontal: space.lg,
    color: colors.danger,
    fontFamily: font.medium,
    fontSize: textSize.body,
  },

  sectionHead: { paddingHorizontal: space.lg, paddingTop: space.xs },
  item: { paddingHorizontal: space.lg, paddingBottom: space.sm },
  empty: { paddingHorizontal: space.lg, paddingTop: space.sm },

  rawSquad: {
    padding: space.sm,
    borderRadius: radius.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 2,
  },
  rawSquadName: { color: colors.text, fontFamily: font.semi, fontSize: textSize.base },
  rawMeta: { color: colors.textFaint, fontFamily: font.medium, fontSize: textSize.caption },

  footer: { gap: space.md, paddingTop: space.sm },
  squads: { gap: space.sm, paddingHorizontal: space.lg, paddingTop: space.md },
});
