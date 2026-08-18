import { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { MyEvent } from '../../services/serviceEvents';
import { colors, font, radius, shadow, space } from '../../theme';
import { keyOf } from '../../lib/eventFormat';

type CalendarCardProps = {
  events: MyEvent[];
  selectedDate: string | null;
  onSelectDate: (date: string) => void;
  onAddEvent?: () => void;
};

const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

export default function CalendarCard({ events, selectedDate, onSelectDate, onAddEvent }: CalendarCardProps) {
  const [visible, setVisible] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  const year = visible.getFullYear();
  const month = visible.getMonth();
  const firstOffset = (new Date(year, month, 1).getDay() + 6) % 7;
  const cells = Array.from({ length: 42 }, (_, i) => new Date(year, month, 1 - firstOffset + i));

  const eventDays = new Set(events.map((e) => e.date));
  const todayKey = keyOf(new Date());
  const upcoming = events.filter((e) => e.date >= todayKey).length;

  const monthTitle = visible.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const subtitle = upcoming === 0 ? 'No events yet' : `${upcoming} event${upcoming === 1 ? '' : 's'} coming up`;

  function shiftMonth(delta: number) {
    setVisible((v) => new Date(v.getFullYear(), v.getMonth() + delta, 1));
  }

  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <View style={styles.headText}>
          <Text style={styles.month}>{monthTitle}</Text>
          <Text style={styles.subtitle}>{subtitle}</Text>
        </View>
        <View style={styles.controls}>
          <Pressable style={styles.navBtn} onPress={() => shiftMonth(-1)} accessibilityRole="button" accessibilityLabel="Previous month">
            <Ionicons name="chevron-back" size={18} color={colors.text} />
          </Pressable>
          <Pressable style={styles.navBtn} onPress={() => shiftMonth(1)} accessibilityRole="button" accessibilityLabel="Next month">
            <Ionicons name="chevron-forward" size={18} color={colors.text} />
          </Pressable>
          <Pressable style={styles.addBtn} onPress={onAddEvent} accessibilityRole="button" accessibilityLabel="Add event">
            <Ionicons name="add" size={22} color="#FFFFFF" />
          </Pressable>
        </View>
      </View>

      <View style={styles.weekRow}>
        {WEEKDAYS.map((w, i) => (
          <Text key={i} style={styles.weekday}>{w}</Text>
        ))}
      </View>

      <View style={styles.grid}>
        {cells.map((d, i) => {
          const key = keyOf(d);
          const inMonth = d.getMonth() === month;
          const isToday = key === todayKey;
          const isSelected = key === selectedDate;
          const hasEvent = inMonth && eventDays.has(key);
          return (
            <Pressable
              key={i}
              style={styles.cell}
              disabled={!inMonth}
              onPress={() => onSelectDate(key)}
              accessibilityRole="button"
              accessibilityLabel={key}
            >
              <View style={[styles.circle, isToday && styles.today, isSelected && !isToday && styles.selected]}>
                <Text style={[styles.dayText, !inMonth && styles.dayMuted, isToday && styles.dayTextToday]}>
                  {d.getDate()}
                </Text>
              </View>
              <View style={styles.dotSlot}>{hasEvent ? <View style={styles.dot} /> : null}</View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderRadius: radius.xl, padding: space.md, margin: 15, ...shadow.card },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: space.sm ,marginLeft:space.xl,    marginRight: space.xl},
  headText: { flex: 1},
  month: { color: colors.text, fontFamily: font.bold, fontSize: 18 },
  subtitle: { color: colors.textSoft, fontFamily: font.medium, fontSize: 13, marginTop: 2 },
  controls: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  navBtn: { width: 36, height: 36, borderRadius: radius.pill, backgroundColor: colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
  addBtn: { width: 36, height: 36, borderRadius: radius.pill, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  weekRow: { flexDirection: 'row', marginBottom: 4 },
  weekday: { width: '14.2857%', textAlign: 'center', color: colors.textFaint, fontFamily: font.semi, fontSize: 12 },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: '14.2857%', alignItems: 'center', paddingVertical: 3 },
  circle: { width: 34, height: 34, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: 'transparent' },
  today: { backgroundColor: colors.primary },
  selected: { borderColor: colors.primary },
  dayText: { color: colors.text, fontFamily: font.medium, fontSize: 14 },
  dayMuted: { color: colors.textFaint },
  dayTextToday: { color: '#FFFFFF', fontFamily: font.semi },
  dot: { width: 5, height: 5, borderRadius: radius.pill, backgroundColor: colors.accent },
  dotSlot: { height: 8, justifyContent: 'center' },
});
