import { useMemo, useRef, useState } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import type { MyEvent } from '../../services/serviceEvents';
import { colors, font, radius, shadow, solidFor, space, sun } from '../../theme';
import { addDays, keyOf } from '../../lib/datetime';

type CalendarCardProps = {
  events: MyEvent[];
  selectedDate: string | null;
  onSelectDate: (date: string) => void;
  onAddEvent?: () => void;
  covers?: Record<string, string>;
  daysBack?: number;
  daysForward?: number;
};

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const MAX_DOTS = 3;

const TILE = 46;
const GAP = 8;
const STEP = TILE + GAP;
const LEAD = 1;

function shortMonth(d: Date) {
  return d.toLocaleDateString('en-US', { month: 'short' }).toUpperCase();
}

export default function CalendarCard({
  events,
  selectedDate,
  onSelectDate,
  covers = {},
  daysBack = 21,
  daysForward = 28,
}: CalendarCardProps) {
  const scroller = useRef<ScrollView>(null);
  const centered = useRef(false);

  const today = useMemo(() => new Date(), []);
  const todayKey = keyOf(today);

  const days = useMemo(
    () =>
      Array.from({ length: daysBack + daysForward + 1 }, (_, i) =>
        addDays(today, i - daysBack),
      ),
    [today, daysBack, daysForward],
  );

  const [anchorIndex, setAnchorIndex] = useState(daysBack);

  const colorsByDay = new Map<string, string[]>();
  for (const event of events) {
    const seen = colorsByDay.get(event.date) ?? [];
    const color = solidFor(event.groupName);
    if (!seen.includes(color)) seen.push(color);
    colorsByDay.set(event.date, seen);
  }

  function scrollToToday(animated: boolean) {
    scroller.current?.scrollTo({ x: Math.max(0, (daysBack - LEAD) * STEP), animated });
  }

  function handleScroll(e: NativeSyntheticEvent<NativeScrollEvent>) {
    const index = Math.round(e.nativeEvent.contentOffset.x / STEP) + LEAD;
    setAnchorIndex(Math.min(days.length - 1, Math.max(0, index)));
  }

  const anchor = days[anchorIndex] ?? today;

  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <Pressable
          onPress={() => scrollToToday(true)}
          accessibilityRole="button"
          accessibilityLabel="Back to today"
        >
          <Text style={styles.month}>
            {shortMonth(anchor)} {anchor.getFullYear()}
          </Text>
        </Pressable>
      </View>

      <ScrollView
        ref={scroller}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.strip}
        scrollEventThrottle={32}
        onScroll={handleScroll}
        onContentSizeChange={function () {
          if (centered.current) return;
          centered.current = true;
          scrollToToday(false);
        }}
      >
        {days.map(function (day) {
          const key = keyOf(day);
          const isToday = key === todayKey;
          const isSelected = key === selectedDate;
          const cover = covers[key];
          const dots = (colorsByDay.get(key) ?? []).slice(0, MAX_DOTS);
          const onDark = Boolean(cover) || isSelected;

          return (
            <Pressable
              key={key}
              onPress={() => onSelectDate(key)}
              accessibilityRole="button"
              accessibilityState={{ selected: isSelected }}
              accessibilityLabel={key}
              style={({ pressed }) => [
                styles.tile,
                isSelected && styles.tileSelected,
                cover && styles.tileCover,
                pressed && styles.pressed,
              ]}
            >
              {cover ? (
                <>
                  <Image source={{ uri: cover }} style={styles.cover} resizeMode="cover" />
                  <LinearGradient
                    colors={['rgba(12,25,38,0)', 'rgba(12,25,38,0.74)']}
                    style={styles.scrim}
                  />
                  <View style={styles.punch} />
                </>
              ) : null}

              <Text style={[styles.weekday, onDark && styles.weekdayOnDark]}>
                {WEEKDAYS[day.getDay()]}
              </Text>

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
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: space.sm,
    ...shadow.card,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space.md,
    marginBottom: space.xs,
  },
  month: { color: colors.textFaint, fontFamily: font.semi, fontSize: 11, letterSpacing: 0.8 },

  strip: { gap: GAP, paddingHorizontal: space.md },
  pressed: { opacity: 0.7 },

  tile: {
    width: TILE,
    height: 66,
    borderRadius: radius.md,
    overflow: 'hidden',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  tileSelected: { backgroundColor: colors.text, borderColor: colors.text },
  tileCover: { borderColor: 'transparent', justifyContent: 'flex-end', paddingBottom: 8 },

  cover: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
  scrim: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
  punch: {
    position: 'absolute',
    top: 5,
    right: 5,
    width: 10,
    height: 10,
    borderRadius: radius.pill,
    borderWidth: 2,
    borderColor: sun,
    backgroundColor: '#0A1420',
  },

  weekday: { color: colors.textFaint, fontFamily: font.semi, fontSize: 10, letterSpacing: 0.6 },
  weekdayOnDark: { color: 'rgba(255,255,255,0.72)' },

  number: { color: colors.text, fontFamily: font.mono, fontSize: 17 },
  numberToday: { color: colors.primary },
  numberOnDark: { color: '#FFFFFF' },

  dotSlot: { height: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 2 },
  dot: { width: 4.5, height: 4.5, borderRadius: radius.pill },
});
