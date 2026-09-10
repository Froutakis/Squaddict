import type { Person } from '../../lib/people';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { RsvpStatus } from '../../services/serviceEvents';
import { colors, font, radius, solidFor, space, textSize } from '../../theme';
import { countdownLabel, dateParts, daysUntil } from '../../lib/datetime';
import { placeLines } from '../../lib/place';
import Ticket from '../general/Ticket';
import Punch, { type PunchState } from '../general/Punch';
import AttendeeStack from './Attendee';
import RsvpButtons from './RsvpButtons';

export type CardEvent = {
  id: string;
  title: string;
  date: string;
  startTime?: string;
  location?: string;
  placeLabel?: string;
  groupName: string;
  myStatus?: RsvpStatus;
  going: Person[];
  goingCount: number;
  distanceKm?: number;
};

export type EventCardAction = 'none' | 'rsvp' | 'request';

type EventCardProps = {
  event: CardEvent;
  action?: EventCardAction;
  saving?: boolean;
  requested?: boolean;
  onPress?: () => void;
  onRsvp?: (status: RsvpStatus | null) => void;
  onRequest?: () => void;
};

function statusOf(myStatus?: RsvpStatus): { state: PunchState; label: string } {
  if (myStatus === 'in') return { state: 'in', label: "You're in" };
  if (myStatus === 'out') return { state: 'out', label: "You're out" };
  return { state: 'open', label: 'Not answered' };
}

export default function EventCard({
  event,
  action = 'none',
  saving = false,
  requested = false,
  onPress,
  onRsvp,
  onRequest,
}: EventCardProps) {
  const { month, day } = dateParts(event.date);
  const groupColor = solidFor(event.groupName);
  const status = statusOf(event.myStatus);
  const place = placeLines(event.location, event.placeLabel);

  const hasFaces = event.going.length > 0;

  const meta = [
    event.startTime,
    place.primary,
    !hasFaces && event.goingCount > 0 ? `${event.goingCount} in` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  const corner =
    event.distanceKm !== undefined
      ? `${event.distanceKm.toFixed(1)} KM`
      : daysUntil(event.date) >= 0
        ? countdownLabel(event.date)
        : null;

  return (
    <Ticket onPress={onPress} accessibilityLabel={event.title} stub={renderStub()}>
      <View style={styles.main}>
        <View style={styles.date}>
          <Text style={styles.month}>{month}</Text>
          <Text style={styles.day}>{String(day).padStart(2, '0')}</Text>
        </View>

        <View style={styles.body}>
          <View style={styles.groupRow}>
            <View style={[styles.groupDot, { backgroundColor: groupColor }]} />
            <Text style={[styles.groupName, { color: groupColor }]} numberOfLines={1}>
              {event.groupName}
            </Text>
            <View style={styles.spacer} />
            {corner ? <Text style={styles.corner}>{corner}</Text> : null}
          </View>

          <Text style={styles.title} numberOfLines={1}>
            {event.title}
          </Text>

          {meta ? (
            <Text style={styles.meta} numberOfLines={1}>
              {meta}
            </Text>
          ) : null}
        </View>
      </View>
    </Ticket>
  );

  function renderStub() {
    if (action === 'rsvp' && onRsvp) {
      return (
        <RsvpButtons
          status={event.myStatus}
          saving={saving}
          onChange={onRsvp}
          compact
          stretch
        />
      );
    }

    return (
      <View style={styles.stub}>
        <Punch state={status.state} size={22} />
        <Text style={styles.status}>{action === 'request' ? 'Members only' : status.label}</Text>
        <View style={styles.spacer} />

        {action === 'request' ? (
          <Pressable
            onPress={onRequest}
            disabled={saving || requested || !onRequest}
            accessibilityRole="button"
            accessibilityLabel="Ask to come"
            accessibilityState={{ disabled: saving || requested || !onRequest }}
            style={({ pressed }) => [
              styles.request,
              (requested || !onRequest) && styles.requestDone,
              pressed && styles.pressed,
            ]}
          >
            <Text style={[styles.requestText, (requested || !onRequest) && styles.requestTextDone]}>
              {requested ? 'Asked' : 'Ask to come'}
            </Text>
          </Pressable>
        ) : hasFaces ? (
          <AttendeeStack people={event.going} size={22} max={3} />
        ) : event.goingCount > 0 ? (
          <Text style={styles.status}>{event.goingCount} in</Text>
        ) : null}
      </View>
    );
  }
}

const styles = StyleSheet.create({
  main: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  spacer: { flex: 1 },

  date: {
    width: 46,
    height: 48,
    borderRadius: radius.sm,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  month: {
    color: colors.textFaint,
    fontFamily: font.mono,
    fontSize: 9,
    letterSpacing: 1.2,
  },
  day: { color: colors.text, fontFamily: font.mono, fontSize: 17, letterSpacing: 0.5 },

  body: { flex: 1, minWidth: 0, gap: 2 },
  groupRow: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  groupDot: { width: 6, height: 6, borderRadius: radius.pill },
  groupName: { flexShrink: 1, fontFamily: font.semi, fontSize: textSize.caption },
  corner: {
    color: colors.textFaint,
    fontFamily: font.mono,
    fontSize: 9.5,
    letterSpacing: 1,
  },

  title: {
    color: colors.text,
    fontFamily: font.title,
    fontSize: textSize.lead,
    letterSpacing: -0.2,
  },
  meta: { color: colors.textSoft, fontFamily: font.mono, fontSize: textSize.small },

  stub: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  status: { color: colors.textSoft, fontFamily: font.semi, fontSize: textSize.small },

  request: {
    height: 32,
    paddingHorizontal: 14,
    borderRadius: radius.sm,
    borderWidth: 1.5,
    borderColor: colors.text,
    backgroundColor: colors.text,
    alignItems: 'center',
    justifyContent: 'center',
  },
  requestDone: { backgroundColor: 'transparent', borderColor: colors.border },
  requestText: { color: colors.textOnBrand, fontFamily: font.semi, fontSize: textSize.body },
  requestTextDone: { color: colors.textFaint },
  pressed: { opacity: 0.7 },
});
