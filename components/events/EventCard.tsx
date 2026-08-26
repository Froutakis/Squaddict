import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { MyEvent } from '../../services/serviceEvents';
import { colors, font, gradientFor, radius, shadow, solidFor, space, tint } from '../../theme';
import { countdownLabel, dateParts, daysUntil } from '../../lib/datetime';
import AttendeeStack from './Attendee';

type EventCardProps = {
  event: MyEvent;
  onPress?: () => void;
};

function statusPill(myStatus: MyEvent['myStatus']) {
  if (myStatus === 'in') {
    return { label: "You're in", box: styles.pillIn, text: styles.pillTextIn };
  }
  if (myStatus === 'out') {
    return { label: "You're out", box: styles.pillOut, text: styles.pillTextOut };
  }
  return { label: 'Answer', box: styles.pillOpen, text: styles.pillTextOpen };
}

export default function EventCard({ event, onPress }: EventCardProps) {
  const { month, day } = dateParts(event.date);
  const squadColor = solidFor(event.groupName);
  const pill = statusPill(event.myStatus);

  const days = daysUntil(event.date);
  const relative = days >= 0 ? countdownLabel(event.date).toLowerCase() : null;
  const meta = [relative, event.startTime, event.location].filter(Boolean).join(' · ');

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={event.title}
      style={({ pressed }) => [styles.card, { borderLeftColor: squadColor }, pressed && styles.pressed]}
    >
      <LinearGradient
        colors={gradientFor(event.groupName)}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.dateBlock}
      >
        <Text style={styles.month}>{month}</Text>
        <Text style={styles.day}>{day}</Text>
      </LinearGradient>

      <View style={styles.body}>
        <View style={styles.squadRow}>
          <View style={[styles.squadDot, { backgroundColor: squadColor }]} />
          <Text style={[styles.squadName, { color: squadColor }]} numberOfLines={1}>
            {event.groupName}
          </Text>
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

      <View style={styles.side}>
        <AttendeeStack people={event.going} size={22} max={3} />
        <View style={[styles.pill, pill.box]}>
          <Text style={[styles.pillText, pill.text]}>{pill.label}</Text>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    borderLeftWidth: 3,
    paddingVertical: 13,
    paddingHorizontal: 14,
    ...shadow.card,
  },
  pressed: { opacity: 0.75 },
  dateBlock: {
    width: 50,
    height: 50,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.card,
  },
  month: {
    color: colors.textOnBrand,
    fontFamily: font.bold,
    fontSize: 9.5,
    letterSpacing: 1,
    opacity: 0.92,
  },
  day: { color: colors.textOnBrand, fontFamily: font.display, fontSize: 19 },
  body: { flex: 1, minWidth: 0 },
  squadRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  squadDot: { width: 6, height: 6, borderRadius: radius.pill },
  squadName: { fontFamily: font.bold, fontSize: 11, flexShrink: 1 },
  title: { marginTop: 2, color: colors.text, fontFamily: font.bold, fontSize: 15.5, letterSpacing: -0.2 },
  meta: { marginTop: 2, color: colors.textSoft, fontFamily: font.medium, fontSize: 12.5 },
  side: { alignItems: 'flex-end', gap: space.xs },
  pill: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: radius.pill },
  pillText: { fontFamily: font.bold, fontSize: 10.5 },
  pillIn: { backgroundColor: tint.success },
  pillTextIn: { color: colors.success },
  pillOut: { backgroundColor: tint.danger },
  pillTextOut: { color: colors.danger },
  pillOpen: { backgroundColor: tint.neutral },
  pillTextOpen: { color: colors.primary },
});
