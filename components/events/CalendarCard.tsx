import { useMemo, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import type { MyEvent } from '../../services/serviceEvents';
import { colors, typo, radius, shadow, solidFor, space, sun } from '../../theme';
import { addMonths, keyOf, monthGrid } from '../../lib/datetime';
import SectionHead from '../general/SectionHead';

type CalendarCardProps = {
  events: MyEvent[];
  selectedDate: string | null;
  onSelectDate: (date: string) => void;
  onAddEvent?: () => void;
  covers?: Record<string, string>;
  // Without the section title and side padding, for use inside a sheet.
  bare?: boolean;
};

const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const MAX_DOTS = 3;
const GAP = 2;
const TILE = 40;

function monthLabel(d: Date) {
  return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

function sameMonth(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
}

export default function CalendarCard({
  events,
  selectedDate,
  onSelectDate,
  covers = {},
  bare = false,
}: CalendarCardProps) {
  const today = useMemo(() => new Date(), []);
  const todayKey = keyOf(today);

  const [month, setMonth] = useState(() => addMonths(today, 0));
  const days = useMemo(() => monthGrid(month), [month]);
  const weeks = useMemo(
    () =>
      Array.from({ length: 6 }, (_, i) => days.slice(i * 7, i * 7 + 7)).filter((week) =>
        week.some((day) => sameMonth(day, month)),
      ),
    [days, month],
  );

  const colorsByDay = new Map<string, string[]>();
  for (const event of events) {
    const seen = colorsByDay.get(event.date) ?? [];
    const color = solidFor(event.groupName);
    if (!seen.includes(color)) seen.push(color);
    colorsByDay.set(event.date, seen);
  }

  const onThisMonth = sameMonth(month, today);

  return (
    <View>
      {bare ? null : <SectionHead title="Calendar" />}

      <View style={bare ? null : styles.frame}>
      <View style={[styles.card, bare && styles.cardBare]}>
        <View style={styles.head}>
          <Pressable
            onPress={() => setMonth(addMonths(today, 0))}
            disabled={onThisMonth}
            accessibilityRole="button"
            accessibilityLabel="Back to this month"
            style={styles.monthButton}
          >
            <Text style={styles.month}>{monthLabel(month)}</Text>
          </Pressable>

          <Pressable
            onPress={() => setMonth(addMonths(month, -1))}
            accessibilityRole="button"
            accessibilityLabel="Previous month"
            style={({ pressed }) => [styles.arrow, pressed && styles.pressed]}
          >
            <Ionicons name="chevron-back" size={18} color={colors.text} />
          </Pressable>
          <Pressable
            onPress={() => setMonth(addMonths(month, 1))}
            accessibilityRole="button"
            accessibilityLabel="Next month"
            style={({ pressed }) => [styles.arrow, pressed && styles.pressed]}
          >
            <Ionicons name="chevron-forward" size={18} color={colors.text} />
          </Pressable>
        </View>

        <View style={styles.week}>
          {WEEKDAYS.map((letter, i) => (
            <Text key={i} style={styles.weekday}>
              {letter}
            </Text>
          ))}
        </View>

        <View style={styles.grid}>
          {weeks.map((week) => (
            <View key={keyOf(week[0])} style={styles.week}>
              {week.map(function (day) {
                const key = keyOf(day);
                const inMonth = sameMonth(day, month);
                const isToday = key === todayKey;
                const isSelected = key === selectedDate;
                const cover = inMonth ? covers[key] : undefined;
                const dots = (colorsByDay.get(key) ?? []).slice(0, MAX_DOTS);
                const onDark = Boolean(cover) || isSelected;

                return (
                  <Pressable
                    key={key}
                    onPress={() => onSelectDate(key)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: isSelected }}
                    accessibilityLabel={key}
                    style={styles.cell}
                  >
                  {({ pressed }) => (
                  <View
                    style={[
                      styles.tile,
                      isToday && styles.tileToday,
                      isSelected && styles.tileSelected,
                      !inMonth && styles.tileOutside,
                      pressed && styles.pressed,
                    ]}
                  >
                    {cover ? (
                      <>
                        <Image source={{ uri: cover }} style={styles.cover} resizeMode="cover" />
                        <LinearGradient
                          colors={['rgba(12,25,38,0.15)', 'rgba(12,25,38,0.7)']}
                          style={styles.cover}
                        />
                        <View style={styles.punch} />
                      </>
                    ) : null}

                    <Text
                      style={[
                        styles.number,
                        isToday && !onDark && styles.numberToday,
                        onDark && styles.numberOnDark,
                      ]}
                    >
                      {day.getDate()}
                    </Text>

                    {cover ? null : (
                      <View style={styles.dotSlot}>
                        {dots.map((color) => (
                          <View key={color} style={[styles.dot, { backgroundColor: color }]} />
                        ))}
                      </View>
                    )}
                  </View>
                  )}
                  </Pressable>
                );
              })}
            </View>
          ))}
        </View>
      </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { paddingHorizontal: space.lg },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: space.md,
    paddingTop: space.xs,
    paddingBottom: space.md,
    ...shadow.card,
  },
  cardBare: { borderWidth: 0, shadowOpacity: 0, elevation: 0, paddingHorizontal: space.xs },
  head: { flexDirection: 'row', alignItems: 'center', marginBottom: space.xs },
  monthButton: { flex: 1, minHeight: 44, justifyContent: 'center' },
  month: { color: colors.text, ...typo.semi, fontSize: 15 },
  arrow: { width: 36, height: 44, alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.6 },

  grid: { gap: GAP, marginTop: space.xs },
  week: { flexDirection: 'row', gap: GAP },
  weekday: {
    flex: 1,
    textAlign: 'center',
    color: colors.textFaint,
    ...typo.semi,
    fontSize: 11,
    letterSpacing: 0.6,
  },

  cell: { flex: 1, height: TILE + 4, alignItems: 'center', justifyContent: 'center' },
  tile: {
    width: TILE,
    height: TILE,
    borderRadius: radius.md,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileToday: { backgroundColor: colors.surfaceAlt },
  // The ring keeps the choice visible on a day that shows a photo.
  tileSelected: { backgroundColor: colors.ink, borderWidth: 2, borderColor: colors.ink },
  tileOutside: { opacity: 0.35 },

  cover: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
  punch: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 8,
    height: 8,
    borderRadius: radius.pill,
    borderWidth: 2,
    borderColor: sun,
    backgroundColor: '#0A1420',
  },

  number: { color: colors.text, ...typo.mono, fontSize: 14 },
  numberToday: { color: colors.primary },
  numberOnDark: { color: '#FFFFFF' },

  dotSlot: { height: 5, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 2 },
  dot: { width: 4, height: 4, borderRadius: radius.pill },
});
