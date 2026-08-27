import { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { MyEvent } from '../../services/serviceEvents';
import { colors, font, radius, shadow, solidFor, space } from '../../theme';
import { addDays, keyOf, startOfWeek } from '../../lib/datetime';

type CalendarCardProps = {
  events: MyEvent[];
  daysShown: number;
  selectedDate: string | null;
  onSelectDate: (date: string) => void;
  onAddEvent?: () => void;
};

const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const MAX_DOTS = 3;

function shortMonth(d: Date) {
  return d.toLocaleDateString('en-US', { month: 'short' }).toUpperCase();
}

export default function CalendarCard({ events, daysShown, selectedDate, onSelectDate, onAddEvent }: CalendarCardProps) {
  const [firstDay, setFirstDay] = useState(() => startOfWeek(new Date()));

  const days = Array.from({ length: daysShown }, (_, i) => addDays(firstDay, i));
  const lastDay = days[daysShown - 1];

  const colorsByDay = new Map<string, string[]>();
  for (const event of events) {
    const seen = colorsByDay.get(event.date) ?? [];
    const color = solidFor(event.groupName);
    if (!seen.includes(color)) seen.push(color);
    colorsByDay.set(event.date, seen);
  }

  const todayKey = keyOf(new Date());

  const label =
    firstDay.getMonth() === lastDay.getMonth()
      ? `${shortMonth(firstDay)} ${firstDay.getFullYear()}`
      : `${shortMonth(firstDay)} – ${shortMonth(lastDay)}`;

  function shift(deltaDays: number) {
    setFirstDay((current) => addDays(current, deltaDays));
  }

  function backToToday() {
    setFirstDay(startOfWeek(new Date()));
  }

  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <Pressable onPress={backToToday} accessibilityRole="button" accessibilityLabel="Back to this week">
          <Text style={styles.month}>{label}</Text>
        </Pressable>
      </View>

      <View style={styles.strip}>
        <Pressable
          style={({ pressed }) => [styles.navBtn, pressed && styles.pressed]}
          onPress={() => shift(-daysShown)}
          accessibilityRole="button"
          accessibilityLabel="Previous days"
        >
          <Ionicons name="chevron-back" size={18} color={colors.textSoft} />
        </Pressable>

        <View style={styles.days}>
          {days.map((day, i) => {
            const key = keyOf(day);
            const isToday = key === todayKey;
            const isSelected = key === selectedDate;
            const dots = (colorsByDay.get(key) ?? []).slice(0, MAX_DOTS);

            return (
              <Pressable
                key={key}
                style={styles.cell}
                onPress={() => onSelectDate(key)}
                accessibilityRole="button"
                accessibilityState={{ selected: isSelected }}
                accessibilityLabel={key}
              >
                <Text style={styles.weekday}>{WEEKDAYS[i % 7]}</Text>
                <View style={[styles.circle, isToday && styles.today, isSelected && !isToday && styles.selected]}>
                  <Text style={[styles.dayText, isToday && styles.dayTextToday]}>{day.getDate()}</Text>
                </View>
                <View style={styles.dotSlot}>
                  {dots.map((color) => (
                    <View key={color} style={[styles.dot, { backgroundColor: color }]} />
                  ))}
                </View>
              </Pressable>
            );
          })}
        </View>

        <Pressable
          style={({ pressed }) => [styles.navBtn, pressed && styles.pressed]}
          onPress={() => shift(daysShown)}
          accessibilityRole="button"
          accessibilityLabel="Next days"
        >
          <Ionicons name="chevron-forward" size={18} color={colors.textSoft} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: space.sm,
    paddingVertical: space.sm,
    ...shadow.card,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingLeft: space.xs,
    marginBottom: 2,
  },
  month: { color: colors.textFaint, fontFamily: font.semi, fontSize: 11, letterSpacing: 0.8 },
  addBtn: {
    width: 30,
    height: 30,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.7 },
  strip: { flexDirection: 'row', alignItems: 'center' },
  navBtn: { width: 22, alignItems: 'center', justifyContent: 'center', alignSelf: 'stretch' },
  days: { flex: 1, flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: '14.2857%', alignItems: 'center', paddingVertical: 2 },
  weekday: { color: colors.textFaint, fontFamily: font.medium, fontSize: 10, marginBottom: 1 },
  circle: {
    width: 30,
    height: 30,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  today: { backgroundColor: colors.primary },
  selected: { borderColor: colors.primary },
  dayText: { color: colors.text, fontFamily: font.medium, fontSize: 13.5 },
  dayTextToday: { color: '#FFFFFF', fontFamily: font.semi },
  dotSlot: { height: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 2 },
  dot: { width: 4.5, height: 4.5, borderRadius: radius.pill },
});
