import { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { DEFAULT_RADIUS_KM, getFeed, type Center, type FeedEvent } from '../../services/serviceFeed';
import { getCurrentCoords } from '../../services/serviceLocation';
import { clearRsvp, setRsvp, type RsvpStatus } from '../../services/serviceEvents';
import { colors, font, space, textSize } from '../../theme';
import SectionLabel from '../general/SectionLabel';
import FeedTicket from '../events/FeedTicket';

const SHOWN = 8;

type LocationState = 'asking' | 'on' | 'off';

type OutThereRowProps = {
  refreshNonce?: number;
  onOpen: (event: FeedEvent) => void;
};

function applyRsvp(event: FeedEvent, status: RsvpStatus | null): FeedEvent {
  const wasIn = event.myStatus === 'in';
  const isIn = status === 'in';

  let goingCount = event.goingCount;
  if (wasIn && !isIn) goingCount -= 1;
  if (!wasIn && isIn) goingCount += 1;

  return { ...event, myStatus: status ?? undefined, goingCount: Math.max(0, goingCount) };
}

export default function OutThereRow({ refreshNonce = 0, onOpen }: OutThereRowProps) {
  const [center, setCenter] = useState<Center | null>(null);
  const [locationState, setLocationState] = useState<LocationState>('asking');
  const [events, setEvents] = useState<FeedEvent[]>([]);
  const [savingId, setSavingId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    getCurrentCoords().then(function (result) {
      if (cancelled) return;

      if (result.ok) {
        setCenter(result.coords);
        setLocationState('on');
        return;
      }

      setCenter(null);
      setLocationState('off');
    });

    return function cleanup() {
      cancelled = true;
    };
  }, []);

  const load = useCallback(
    async function load() {
      try {
        const feed = await getFeed({ center, radiusKm: DEFAULT_RADIUS_KM });
        setEvents(
          feed.events
            .filter(function (event) {
              return !event.isMember;
            })
            .slice(0, SHOWN),
        );
      } catch {
        setEvents([]);
      }
    },
    [center],
  );

  useEffect(() => {
    if (locationState === 'asking') return;
    load();
  }, [load, locationState, refreshNonce]);

  async function handleRsvp(eventId: string, status: RsvpStatus | null) {
    if (savingId) return;

    setSavingId(eventId);
    try {
      if (status) await setRsvp(eventId, status);
      else await clearRsvp(eventId);

      setEvents(function (current) {
        return current.map(function (event) {
          return event.id === eventId ? applyRsvp(event, status) : event;
        });
      });
    } catch {
      // the row keeps the answer it had
    } finally {
      setSavingId(null);
    }
  }

  if (events.length === 0) return null;

  return (
    <View>
      <View style={styles.head}>
        <SectionLabel>Out there</SectionLabel>
        <Text style={styles.sub}>
          {locationState === 'on'
            ? `Public plans within ${DEFAULT_RADIUS_KM} km`
            : 'Public plans, anywhere'}
        </Text>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
      >
        {events.map(function (event) {
          return (
            <FeedTicket
              key={event.id}
              event={event}
              saving={savingId === event.id}
              onPress={function () {
                onOpen(event);
              }}
              onRsvp={function (status) {
                handleRsvp(event.id, status);
              }}
            />
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  head: { paddingHorizontal: space.lg },
  sub: {
    marginTop: -2,
    marginBottom: space.xs,
    color: colors.textFaint,
    fontFamily: font.medium,
    fontSize: textSize.small,
  },
  row: { gap: space.sm, paddingHorizontal: space.lg, paddingVertical: space.xs },
});
