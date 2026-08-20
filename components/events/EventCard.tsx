import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { MyEvent } from '../../services/serviceEvents';
import { colors, font, radius, shadow, space } from '../../theme';
import { dateParts } from '../../lib/datetime';

type EventCardProps = {
  event: MyEvent;
  onPress?: () => void;
};

export default function EventCard({ event, onPress }: EventCardProps) {
  const { month, day } = dateParts(event.date);
  const meta = [event.startTime, event.location, event.groupName].filter(Boolean).join(' · ');

  return (
    <Pressable style={styles.card} onPress={onPress} accessibilityRole="button" accessibilityLabel={event.title}>
      <View style={styles.dateBlock}>
        <Text style={styles.month}>{month}</Text>
        <Text style={styles.day}>{day}</Text>
      </View>
      <View style={styles.divider} />
      <View style={styles.body}>
        <Text style={styles.title} numberOfLines={1}>{event.title}</Text>
        <Text style={styles.meta} numberOfLines={1}>{meta}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: space.md,
    ...shadow.card,
  },
  dateBlock: { alignItems: 'center', minWidth: 42 },
  month: { color: colors.textSoft, fontFamily: font.semi, fontSize: 12, letterSpacing: 0.5 },
  day: { color: colors.text, fontFamily: font.bold, fontSize: 22 },
  divider: { width: 2, height: 36, borderRadius: radius.pill, backgroundColor: colors.primary, marginHorizontal: space.md },
  body: { flex: 1 },
  title: { color: colors.text, fontFamily: font.semi, fontSize: 16 },
  meta: { color: colors.textSoft, fontFamily: font.medium, fontSize: 13, marginTop: 2 },
});