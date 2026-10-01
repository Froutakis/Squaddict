import { useMemo, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Image, Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import type { MyEvent } from '../services/serviceEvents';
import { addMonths, keyOf, monthGrid } from '../lib/datetime';
import { colors, layout, radius, solidFor, space, textSize, typo } from '../theme';
import { FAB_CENTER_Y, FAB_INSET } from '../components/general/MenuFab';

type CalendarScreenProps = {
  // The squad whose month this is, shown under the month.
  squadName?: string;
  events: MyEvent[];
  covers: Record<string, string>;
  onBack: () => void;
  // Opens the day: its plans, its photos, or a new plan on a free day.
  onSelectDate: (date: string) => void;
};

const WEEKDAYS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];
// How many plans a day names before it says "+2".
const MAX_TITLES = 2;
// Room at the bottom so the last item can scroll clear.
const NAV_CLEARANCE = 96;

function sameMonth(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
}

// The squad's month as a whole page: the grid fills the screen, each day
// names its plans, and a night that was kept shows its photo.
export default function CalendarScreen({ squadName, events, covers, onBack, onSelectDate }: CalendarScreenProps) {
  const today = useMemo(() => new Date(), []);
  const todayKey = keyOf(today);
  const [month, setMonth] = useState(() => addMonths(today, 0));

  const weeks = useMemo(() => {
    const days = monthGrid(month);
    return Array.from({ length: 6 }, (_, i) => days.slice(i * 7, i * 7 + 7)).filter((week) =>
      week.some((day) => sameMonth(day, month)),
    );
  }, [month]);

  const byDay = useMemo(() => {
    const map = new Map<string, MyEvent[]>();
    for (const event of events) {
      const list = map.get(event.date) ?? [];
      list.push(event);
      map.set(event.date, list);
    }
    return map;
  }, [events]);

  const onThisMonth = sameMonth(month, today);

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.column}>
        <View style={styles.topBar}>
          <Pressable
            onPress={onBack}
            accessibilityRole="button"
            accessibilityLabel="Back to Home"
            hitSlop={8}
            style={({ pressed }) => [styles.back, pressed && styles.pressed]}
          >
            <Ionicons name="chevron-back" size={24} color={colors.text} />
            <Text style={styles.backText}>Home</Text>
          </Pressable>

          {onThisMonth ? null : (
            <Pressable
              onPress={() => setMonth(addMonths(today, 0))}
              accessibilityRole="button"
              accessibilityLabel="Go to this month"
              style={({ pressed }) => [styles.today, pressed && styles.pressed]}
            >
              <Text style={styles.todayText}>Today</Text>
            </Pressable>
          )}
        </View>

        <View style={styles.head}>
          <View style={styles.titles}>
            <Text style={styles.month} numberOfLines={1}>
              {month.toLocaleDateString('en-US', { month: 'long' })}{' '}
              <Text style={styles.year}>{month.getFullYear()}</Text>
            </Text>
            {squadName ? (
              <Text style={styles.squad} numberOfLines={1}>
                {squadName}
              </Text>
            ) : null}
          </View>

          <Pressable
            onPress={() => setMonth(addMonths(month, -1))}
            accessibilityRole="button"
            accessibilityLabel="Previous month"
            style={({ pressed }) => [styles.arrow, pressed && styles.pressed]}
          >
            <Ionicons name="chevron-back" size={20} color={colors.text} />
          </Pressable>
          <Pressable
            onPress={() => setMonth(addMonths(month, 1))}
            accessibilityRole="button"
            accessibilityLabel="Next month"
            style={({ pressed }) => [styles.arrow, pressed && styles.pressed]}
          >
            <Ionicons name="chevron-forward" size={20} color={colors.text} />
          </Pressable>
        </View>

        <View style={styles.weekdays}>
          {WEEKDAYS.map((name) => (
            <Text key={name} style={styles.weekday}>
              {name}
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
                const plans = byDay.get(key) ?? [];
                const cover = inMonth ? covers[key] : undefined;
                const extra = plans.length - MAX_TITLES;

                return (
                  <Pressable
                    key={key}
                    onPress={() => onSelectDate(key)}
                    accessibilityRole="button"
                    accessibilityLabel={
                      key + (plans.length > 0 ? `, ${plans.map((plan) => plan.title).join(', ')}` : ', nothing on')
                    }
                    style={({ pressed }) => [styles.cell, !inMonth && styles.cellOutside, pressed && styles.pressed]}
                  >
                    {cover ? (
                      <>
                        <Image source={{ uri: cover }} style={styles.fill} resizeMode="cover" />
                        <LinearGradient
                          colors={['rgba(12,25,38,0.55)', 'rgba(12,25,38,0.15)', 'rgba(12,25,38,0.6)']}
                          style={styles.fill}
                        />
                      </>
                    ) : null}

                    <View style={[styles.number, isToday && styles.numberToday]}>
                      <Text
                        style={[
                          styles.numberText,
                          cover !== undefined && styles.onPhoto,
                          isToday && styles.numberTodayText,
                        ]}
                      >
                        {day.getDate()}
                      </Text>
                    </View>

                    {plans.slice(0, MAX_TITLES).map((plan) => (
                      <View key={plan.id} style={styles.plan}>
                        <View style={[styles.planBar, { backgroundColor: solidFor(plan.groupName) }]} />
                        <Text style={[styles.planText, cover !== undefined && styles.onPhoto]} numberOfLines={1}>
                          {plan.title}
                        </Text>
                      </View>
                    ))}

                    {extra > 0 ? (
                      <Text style={[styles.more, cover !== undefined && styles.onPhoto]}>+{extra}</Text>
                    ) : null}
                  </Pressable>
                );
              })}
            </View>
          ))}
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: colors.bg },
  column: {
    flex: 1,
    width: '100%',
    maxWidth: layout.column,
    alignSelf: 'center',
    paddingBottom: NAV_CLEARANCE,
  },
  pressed: { opacity: 0.6 },
  fill: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },

  // Starts right of the floating menu button, level with it.
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingLeft: FAB_INSET - space.xs,
    paddingRight: space.xs,
    height: 48,
    marginTop: FAB_CENTER_Y - 24,
  },
  back: { flexDirection: 'row', alignItems: 'center', gap: 2, paddingRight: space.sm, minHeight: 44 },
  backText: { color: colors.text, ...typo.semi, fontSize: textSize.lead },
  today: { minHeight: 44, justifyContent: 'center', paddingHorizontal: space.md },
  todayText: { color: colors.primary, ...typo.semi, fontSize: textSize.lead },

  head: { flexDirection: 'row', alignItems: 'center', paddingLeft: space.lg, paddingRight: space.xs },
  titles: { flex: 1, minWidth: 0 },
  month: { color: colors.text, ...typo.display, fontSize: textSize.hero, letterSpacing: -0.6 },
  year: { color: colors.textFaint, ...typo.medium },
  squad: { color: colors.textSoft, ...typo.medium, fontSize: textSize.base },
  arrow: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },

  weekdays: { flexDirection: 'row', paddingHorizontal: space.xs, paddingTop: space.sm, paddingBottom: space.xs },
  weekday: {
    flex: 1,
    textAlign: 'center',
    color: colors.textFaint,
    ...typo.semi,
    fontSize: textSize.micro,
    letterSpacing: 0.8,
  },

  // The grid takes every bit of height that is left; each week shares it.
  grid: { flex: 1, paddingHorizontal: space.xs, gap: 3 },
  week: { flex: 1, flexDirection: 'row', gap: 3 },
  cell: {
    flex: 1,
    minWidth: 0,
    padding: 4,
    gap: 2,
    borderRadius: radius.sm,
    overflow: 'hidden',
    backgroundColor: colors.surface,
  },
  cellOutside: { opacity: 0.4 },

  number: {
    alignSelf: 'flex-start',
    minWidth: 22,
    height: 22,
    paddingHorizontal: 4,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  numberToday: { backgroundColor: colors.primary },
  numberText: { color: colors.text, ...typo.mono, fontSize: textSize.body },
  numberTodayText: { color: '#FFFFFF', ...typo.bold },
  onPhoto: { color: '#FFFFFF' },

  plan: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  planBar: { width: 3, height: 11, borderRadius: 2 },
  planText: { flex: 1, color: colors.text, ...typo.medium, fontSize: textSize.caption },
  more: { color: colors.textSoft, ...typo.medium, fontSize: textSize.micro, paddingLeft: 6 },
});
