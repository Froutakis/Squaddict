import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { FeedEvent } from '../../services/serviceFeed';
import type { RsvpStatus } from '../../services/serviceEvents';
import { dateParts, weekdayShort } from '../../lib/datetime';
import { placeLines } from '../../lib/place';
import { colors, radius, solidFor, space, textSize, tracking, typo } from '../../theme';
import { initialsFor } from '../general/GradientAvatar';
import Punch from '../general/Punch';
import Ticket from '../general/Ticket';

export const FEED_TICKET_WIDTH = 178;

type FeedTicketProps = {
  event: FeedEvent;
  saving?: boolean;
  onPress?: () => void;
  onRsvp?: (status: RsvpStatus | null) => void;
};

export default function FeedTicket({ event, saving = false, onPress, onRsvp }: FeedTicketProps) {
  const place = placeLines(event.location, event.placeLabel);
  const { day } = dateParts(event.date);
  const meta = [event.startTime, place.primary].filter(Boolean).join(' · ');
  const isIn = event.myStatus === 'in';

  const label = [
    event.title,
    `${weekdayShort(event.date)} ${day}`,
    `${event.goingCount} going`,
    event.distanceKm !== undefined ? `${event.distanceKm.toFixed(1)} kilometres away` : null,
  ]
    .filter(Boolean)
    .join(', ');

  return (
    <Ticket
      tone="light"
      notches={false}
      onPress={onPress}
      accessibilityLabel={label}
      style={styles.card}
      stub={
        <View style={styles.stub}>
          <Pressable
            onPress={function () {
              if (onRsvp) onRsvp(isIn ? null : 'in');
            }}
            disabled={saving || !onRsvp}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={isIn ? "You're in, tap to undo" : "I'm in"}
            accessibilityState={{ selected: isIn, disabled: saving }}
            style={({ pressed }) => [pressed && styles.pressed]}
          >
            <Punch state={event.myStatus === 'in' ? 'in' : event.myStatus === 'out' ? 'out' : 'open'} size={22} />
          </Pressable>

          <Text style={[styles.going, isIn && styles.goingIn]} numberOfLines={1}>
            {event.goingCount} going
          </Text>
        </View>
      }
    >
      <View style={styles.top}>
        <View style={styles.date}>
          <Text style={styles.weekday}>{weekdayShort(event.date)}</Text>
          <Text style={styles.day}>{String(day).padStart(2, '0')}</Text>
        </View>

        <View style={styles.spacer} />

        {event.distanceKm !== undefined ? (
          <Text style={styles.km}>{event.distanceKm.toFixed(1)} KM</Text>
        ) : null}
      </View>

      <Text style={styles.title} numberOfLines={2}>
        {event.title}
      </Text>

      {meta ? (
        <Text style={styles.meta} numberOfLines={1}>
          {meta}
        </Text>
      ) : null}

      <View style={styles.groupRow}>
        <View style={[styles.monogram, { backgroundColor: solidFor(event.groupName) }]}>
          <Text style={styles.monogramText}>{initialsFor(event.groupName)}</Text>
        </View>
        <Text style={styles.handle} numberOfLines={1}>
          @{event.groupHandle}
        </Text>
      </View>
    </Ticket>
  );
}

const styles = StyleSheet.create({
  card: { width: FEED_TICKET_WIDTH },
  top: { flexDirection: 'row', alignItems: 'center' },
  spacer: { flex: 1 },
  date: {
    width: 50,
    height: 48,
    borderRadius: 12,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  weekday: { color: colors.accent, ...typo.semi, fontSize: 10, letterSpacing: 0.5 },
  day: { color: colors.text, ...typo.title, fontSize: 20, letterSpacing: tracking.title },
  km: { color: colors.textFaint, ...typo.mono, fontSize: 10, letterSpacing: 0.8 },

  title: {
    marginTop: space.sm,
    color: colors.text,
    ...typo.display,
    fontSize: 16.5,
    lineHeight: 19,
    letterSpacing: -0.3,
  },
  meta: {
    marginTop: 3,
    color: colors.textSoft,
    ...typo.mono,
    fontSize: textSize.caption,
  },

  groupRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: space.sm },
  monogram: {
    width: 20,
    height: 20,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monogramText: { color: '#FFFFFF', ...typo.semi, fontSize: 8 },
  handle: { flex: 1, color: colors.textSoft, ...typo.mono, fontSize: textSize.caption },

  stub: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  going: { color: colors.textFaint, ...typo.mono, fontSize: textSize.caption },
  goingIn: { color: colors.success },
  pressed: { opacity: 0.6 },
});
