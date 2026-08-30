import { StyleSheet, Text, View } from 'react-native';
import type { MyEvent } from '../../services/serviceEvents';
import { colors, font, radius, solidFor, space, textSize } from '../../theme';
import { countdownLabel, dateParts, daysUntil } from '../../lib/datetime';
import { placeLines } from '../../lib/place';
import Ticket from '../general/Ticket';
import Punch, { type PunchState } from '../general/Punch';
import AttendeeStack from './Attendee';

type EventCardProps = {
  event: MyEvent;
  onPress?: () => void;
};

function statusOf(myStatus: MyEvent['myStatus']): { state: PunchState; label: string } {
  if (myStatus === 'in') return { state: 'in', label: "You're in" };
  if (myStatus === 'out') return { state: 'out', label: "You're out" };
  return { state: 'open', label: 'Not answered' };
}

export default function EventCard({ event, onPress }: EventCardProps) {
  const { month, day } = dateParts(event.date);
  const squadColor = solidFor(event.groupName);
  const status = statusOf(event.myStatus);

  const place = placeLines(event.location, event.placeLabel);
  const meta = [event.startTime, place.primary].filter(Boolean).join(' · ');
  const countdown = daysUntil(event.date) >= 0 ? countdownLabel(event.date) : null;

  return (
    <Ticket
      onPress={onPress}
      accessibilityLabel={event.title}
      stub={
        <View style={styles.stub}>
          <Punch state={status.state} size={22} />
          <Text style={styles.status}>{status.label}</Text>
          <View style={styles.spacer} />
          <AttendeeStack people={event.going} size={22} max={3} />
        </View>
      }
    >
      <View style={styles.main}>
        <View style={styles.date}>
          <Text style={styles.month}>{month}</Text>
          <Text style={styles.day}>{String(day).padStart(2, '0')}</Text>
        </View>

        <View style={styles.body}>
          <View style={styles.squadRow}>
            <View style={[styles.squadDot, { backgroundColor: squadColor }]} />
            <Text style={[styles.squadName, { color: squadColor }]} numberOfLines={1}>
              {event.groupName}
            </Text>
            <View style={styles.spacer} />
            {countdown ? <Text style={styles.countdown}>{countdown}</Text> : null}
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
  squadRow: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  squadDot: { width: 6, height: 6, borderRadius: radius.pill },
  squadName: { flexShrink: 1, fontFamily: font.semi, fontSize: textSize.caption },
  countdown: {
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
});
