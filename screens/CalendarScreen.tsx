import { useEffect, useMemo, useRef, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import {
  Animated,
  Easing,
  Image,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import type { MyEvent } from '../services/serviceEvents';
import { getPhotoReactions } from '../services/servicePhotoFeed';
import { addMonths, eventWindow, keyOf, monthGrid, parseLocal } from '../lib/datetime';
import { REACTIONS, type ReactionEmoji } from '../lib/photoFeed';
import { REACTION_ICONS, REACTION_NAMES } from '../components/general/reactionIcons';
import TicketShape from '../components/general/TicketShape';
import TicketBackdrop from '../components/general/TicketBackdrop';
import DashedDivider from '../components/general/DashedDivider';
import { OnNow, Pill, type TicketPill } from '../components/home/PlanTicket';
import { shortPlace } from '../components/home/LineTicket';
import { alpha, colors, dusk, layout, radius, scrim, shadow, space, sun, sunOn, textSize, tint, typo } from '../theme';
import { FAB_CENTER_Y, FAB_INSET } from '../components/general/MenuFab';

// A kept night on the calendar: its first photo, signed, and how many it has.
export type CalendarNight = {
  url: string;
  event: MyEvent;
  count: number;
  photoIds: string[];
};

type CalendarScreenProps = {
  // The squad whose month this is, shown under the month.
  squadName?: string;
  events: MyEvent[];
  covers: Record<string, CalendarNight>;
  now: Date;
  onBack: () => void;
  // Opens the day: its plans, its photos, or a new plan on a free day.
  onSelectDate: (date: string) => void;
  onOpenPlan: (event: MyEvent) => void;
  onThrowPlan: (date: string) => void;
};

const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const LONG_DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const SHORT_DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

// A day is a number on top and as many tiny tickets as fit under it.
const GAP = 4;
const CELL_TOP = 5;
const NUMBER = 20;
const CELL_BOTTOM = 4;
const CHIP = 18;
// While the peek is open the days are shorter, so the tickets are too.
const CHIP_PEEK = 15;
const CHIP_GAP = 3;
const MAX_CHIPS = 3;
// The peek lists this many plans; a busier day opens its own list.
const MAX_ROWS = 3;
// Where the peek's tear line and notches sit, from its top.
const PEEK_TEAR = 65;

type ChipTone = 'in' | 'maybe' | 'ask' | 'live' | 'over';

function sameMonth(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
}

// What a plan is to you right now: on, over, yours, or waiting on your answer.
// (Plans still being voted on are not events yet, so they have no chip here.)
function toneOf(plan: MyEvent, now: Date): ChipTone {
  const { startsAt, endsAt } = eventWindow(plan.date, plan.startTime, plan.endTime);
  if (now >= endsAt) return 'over';
  if (now >= startsAt) return 'live';
  if (plan.myStatus === undefined) return 'ask';
  if (plan.myStatus === 'maybe') return 'maybe';
  return plan.myStatus === 'in' ? 'in' : 'over';
}

function firstName(name: string) {
  return name.trim().split(/\s+/)[0] || 'Someone';
}

// The squad's month as a whole page: tall days, kept nights filling theirs
// with the photo, coming plans as tiny tickets. The first tap peeks at a day
// under the month; the second does what a tap always did.
export default function CalendarScreen({
  squadName,
  events,
  covers,
  now,
  onBack,
  onSelectDate,
  onOpenPlan,
  onThrowPlan,
}: CalendarScreenProps) {
  const today = useMemo(() => new Date(), []);
  const todayKey = keyOf(now);
  const [month, setMonth] = useState(() => addMonths(today, 0));
  const [picked, setPicked] = useState<string | null>(null);
  const [gridHeight, setGridHeight] = useState(0);

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
    for (const list of map.values()) list.sort((a, b) => (a.startTime ?? '').localeCompare(b.startTime ?? ''));
    return map;
  }, [events]);

  const onThisMonth = sameMonth(month, today);
  const peeking = picked !== null;
  const chip = peeking ? CHIP_PEEK : CHIP;

  // How many tickets fit under a day's number, from the height the grid got.
  const rowHeight = weeks.length > 0 ? (gridHeight - GAP * (weeks.length - 1)) / weeks.length : 0;
  const slots = Math.max(0, Math.min(MAX_CHIPS, Math.floor((rowHeight - CELL_TOP - NUMBER - CELL_BOTTOM) / (chip + CHIP_GAP))));

  function changeMonth(next: Date) {
    setMonth(next);
    setPicked(null);
  }

  // First tap peeks; a second tap on the same day opens it as before.
  function tapDay(key: string) {
    if (picked === key) onSelectDate(key);
    else setPicked(key);
  }

  function onGridLayout(event: LayoutChangeEvent) {
    const height = event.nativeEvent.layout.height;
    setGridHeight((was) => (Math.abs(was - height) < 0.5 ? was : height));
  }

  return (
    <SafeAreaView style={styles.screen}>
      <TicketBackdrop />
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
              onPress={() => changeMonth(addMonths(today, 0))}
              accessibilityRole="button"
              accessibilityLabel="Go to this month"
              style={({ pressed }) => [styles.today, pressed && styles.pressed]}
            >
              <View style={styles.todayPill}>
                <Text style={styles.todayText}>Today</Text>
              </View>
            </Pressable>
          )}
        </View>

        <View style={styles.head}>
          <View style={styles.titles}>
            <Text style={styles.month} numberOfLines={1}>
              {MONTHS[month.getMonth()]} <Text style={styles.year}>{month.getFullYear()}</Text>
            </Text>
            {squadName ? (
              <Text style={styles.squad} numberOfLines={1}>
                {squadName}
              </Text>
            ) : null}
          </View>

          <Pressable
            onPress={() => changeMonth(addMonths(month, -1))}
            accessibilityRole="button"
            accessibilityLabel="Previous month"
            style={({ pressed }) => [styles.arrow, pressed && styles.pressed]}
          >
            <Ionicons name="chevron-back" size={20} color={colors.text} />
          </Pressable>
          <Pressable
            onPress={() => changeMonth(addMonths(month, 1))}
            accessibilityRole="button"
            accessibilityLabel="Next month"
            style={({ pressed }) => [styles.arrow, pressed && styles.pressed]}
          >
            <Ionicons name="chevron-forward" size={20} color={colors.text} />
          </Pressable>
        </View>

        <View style={styles.weekdays} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          {WEEKDAYS.map((name, i) => (
            <Text key={i} style={styles.weekday}>
              {name}
            </Text>
          ))}
        </View>

        <View style={[styles.grid, peeking && styles.gridPeeking]} onLayout={onGridLayout}>
          {weeks.map((week) => (
            <View key={keyOf(week[0])} style={styles.week}>
              {week.map(function (day) {
                const key = keyOf(day);
                // Days of the next and last month stay out of the way.
                if (!sameMonth(day, month)) return <View key={key} style={styles.cellOut} />;

                const isToday = key === todayKey;
                const gone = key < todayKey;
                const chosen = picked === key;
                const plans = byDay.get(key) ?? [];
                const night = covers[key];
                const shown = plans.length <= slots ? plans.length : Math.max(0, slots - 1);
                const extra = plans.length - shown;
                const what = night
                  ? `${night.event.title}, ${night.count} ${night.count === 1 ? 'photo' : 'photos'}`
                  : plans.length > 0
                    ? plans.map((plan) => plan.title).join(', ')
                    : 'nothing on';

                return (
                  <Pressable
                    key={key}
                    onPress={() => tapDay(key)}
                    accessibilityRole="button"
                    accessibilityLabel={`${dayTitle(key)}${isToday ? ', today' : ''}, ${what}`}
                    accessibilityHint={chosen ? 'Opens the day' : 'Shows the day below the month'}
                    accessibilityState={{ selected: chosen }}
                    style={({ pressed }) => [
                      styles.cell,
                      gone && styles.cellGone,
                      night && styles.cellPhoto,
                      pressed && styles.cellPressed,
                    ]}
                  >
                    {night ? <Image source={{ uri: night.url }} style={StyleSheet.absoluteFill} resizeMode="cover" /> : null}

                    <View
                      style={[
                        styles.number,
                        night && styles.numberPhoto,
                        isToday && !night && styles.numberToday,
                      ]}
                    >
                      <Text
                        style={[
                          styles.numberText,
                          gone && styles.numberGone,
                          night && styles.numberTextPhoto,
                          isToday && !night && styles.numberTodayText,
                        ]}
                      >
                        {day.getDate()}
                      </Text>
                    </View>

                    {night ? (
                      <View style={styles.count}>
                        <Ionicons name="images-outline" size={11} color={colors.onInk} />
                        <Text style={styles.countText}>{night.count}</Text>
                      </View>
                    ) : (
                      <>
                        {plans.slice(0, shown).map((plan) => (
                          <Chip key={plan.id} tone={toneOf(plan, now)} time={plan.startTime ?? 'day'} height={chip} />
                        ))}
                        {extra > 0 && slots > 0 ? <Text style={styles.more}>+{extra}</Text> : null}
                      </>
                    )}

                    {/* The rings: the sun for today, cobalt for the peeked day. */}
                    {isToday ? <View style={[styles.ring, styles.ringToday, chosen && styles.ringInner]} pointerEvents="none" /> : null}
                    {chosen && night ? <View style={[styles.ring, styles.ringWhite, styles.ringInner]} pointerEvents="none" /> : null}
                    {chosen ? <View style={[styles.ring, styles.ringChosen]} pointerEvents="none" /> : null}
                  </Pressable>
                );
              })}
            </View>
          ))}
        </View>

        {picked ? (
          <Peek
            key={picked}
            dayKey={picked}
            todayKey={todayKey}
            plans={byDay.get(picked) ?? []}
            night={covers[picked]}
            squadName={squadName}
            now={now}
            onClose={() => setPicked(null)}
            onOpenDay={() => onSelectDate(picked)}
            onOpenPlan={onOpenPlan}
            onThrowPlan={() => onThrowPlan(picked)}
          />
        ) : null}
      </View>
    </SafeAreaView>
  );
}

// "Saturday 19 September".
function dayTitle(key: string) {
  const day = parseLocal(key);
  return `${LONG_DAYS[day.getDay()]} ${day.getDate()} ${MONTHS[day.getMonth()]}`;
}

// A plan on its day: a tiny ticket with its time.
function Chip({ tone, time, height }: { tone: ChipTone; time: string; height: number }) {
  return (
    <View style={[styles.chip, { height }]}>
      <TicketShape fill={chipFill[tone]} corner={5} notch={2.5} />
      <Text style={[styles.chipText, { color: chipInk[tone] }, height < CHIP && styles.chipTextSmall]} numberOfLines={1}>
        {time}
      </Text>
    </View>
  );
}

type PeekProps = {
  dayKey: string;
  todayKey: string;
  plans: MyEvent[];
  night?: CalendarNight;
  squadName?: string;
  now: Date;
  onClose: () => void;
  onOpenDay: () => void;
  onOpenPlan: (event: MyEvent) => void;
  onThrowPlan: () => void;
};

// The day under the month, on a ticket: a kept night, its plans, or nothing.
function Peek({ dayKey, todayKey, plans, night, squadName, now, onClose, onOpenDay, onOpenPlan, onThrowPlan }: PeekProps) {
  const rise = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(rise, { toValue: 1, duration: 280, easing: Easing.bezier(0.2, 0.8, 0.2, 1), useNativeDriver: true }).start();
  }, [rise]);

  const day = parseLocal(dayKey);
  const asks = plans.filter((plan) => toneOf(plan, now) === 'ask').length;
  let sub: string;
  if (night) sub = night.event.going.length > 0 ? `${night.event.going.length} of you went` : night.event.groupName;
  else if (plans.length > 0) {
    sub = `${plans.length} ${plans.length === 1 ? 'plan' : 'plans'}${asks > 0 ? `, ${asks === 1 ? 'one needs' : `${asks} need`} you` : ''}`;
  } else if (dayKey < todayKey) sub = 'Nothing was on';
  else sub = 'Nothing on. Suspicious.';

  return (
    <Animated.View
      style={[
        styles.peek,
        {
          opacity: rise,
          transform: [{ translateY: rise.interpolate({ inputRange: [0, 1], outputRange: [24, 0] }) }],
        },
      ]}
      accessibilityLabel={dayTitle(dayKey)}
    >
      <TicketShape fill={colors.surface} corner={radius.xl} notch={7} notchAt={PEEK_TEAR} />
      <View style={styles.peekHead}>
        <View style={styles.peekTitles}>
          <Text style={styles.peekTitle} numberOfLines={1} accessibilityRole="header">
            {dayTitle(dayKey)}
          </Text>
          <Text style={styles.peekSub} numberOfLines={1}>
            {sub}
          </Text>
        </View>
        <Pressable
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Close the day"
          style={({ pressed }) => [styles.close, pressed && styles.pressed]}
        >
          <Ionicons name="close" size={20} color={colors.text} />
        </Pressable>
      </View>
      <View style={styles.tear}>
        <DashedDivider />
      </View>

      {night ? (
        <KeptNight night={night} others={plans.filter((plan) => plan.id !== night.event.id)} onPlay={onOpenDay} />
      ) : plans.length > 0 ? (
        <>
          {plans.slice(0, MAX_ROWS).map((plan, i) => (
            <PlanRow key={plan.id} plan={plan} now={now} first={i === 0} onPress={() => onOpenPlan(plan)} />
          ))}
          {plans.length > MAX_ROWS ? (
            <Pressable
              onPress={onOpenDay}
              accessibilityRole="button"
              accessibilityLabel={`All ${plans.length} plans of ${dayTitle(dayKey)}`}
              style={({ pressed }) => [styles.row, styles.rowRule, pressed && styles.pressed]}
            >
              <Text style={styles.rowMore}>+{plans.length - MAX_ROWS} more</Text>
              <Ionicons name="chevron-forward" size={16} color={colors.accentInk} />
            </Pressable>
          ) : null}
        </>
      ) : dayKey < todayKey ? (
        <Text style={styles.empty}>Quiet day. Nothing filed.</Text>
      ) : (
        <>
          <Text style={styles.empty}>
            Throw out a plan for {SHORT_DAYS[day.getDay()]} {day.getDate()} and {squadName ?? 'the parea'} votes on it in the chat.
          </Text>
          <Pressable
            onPress={onThrowPlan}
            accessibilityRole="button"
            accessibilityLabel={`Throw out a plan for ${dayTitle(dayKey)}`}
            style={({ pressed }) => [styles.blue, pressed && styles.pressed]}
          >
            <Ionicons name="add" size={18} color={colors.onInk} />
            <Text style={styles.blueText}>Throw out a plan</Text>
          </Pressable>
        </>
      )}
    </Animated.View>
  );
}

// A kept night: the photo, how many, the reactions, and Play the night.
function KeptNight({ night, others, onPlay }: { night: CalendarNight; others: MyEvent[]; onPlay: () => void }) {
  const [counts, setCounts] = useState<Partial<Record<ReactionEmoji, number>> | null>(null);
  const ids = night.photoIds.join(',');

  // Reactions are on each photo; the night shows them added up. If they can't
  // be read, the night simply shows none.
  useEffect(() => {
    let cancelled = false;
    setCounts(null);
    getPhotoReactions(ids === '' ? [] : ids.split(','))
      .then((byPhoto) => {
        if (cancelled) return;
        const next: Partial<Record<ReactionEmoji, number>> = {};
        for (const list of Object.values(byPhoto)) {
          for (const reaction of list) {
            const emoji = reaction.emoji as ReactionEmoji;
            if (REACTIONS.includes(emoji)) next[emoji] = (next[emoji] ?? 0) + 1;
          }
        }
        setCounts(next);
      })
      .catch(() => {
        if (!cancelled) setCounts({});
      });
    return () => {
      cancelled = true;
    };
  }, [ids]);

  const given = REACTIONS.filter((emoji) => (counts?.[emoji] ?? 0) > 0).slice(0, 3);
  const photos = `${night.count} ${night.count === 1 ? 'photo' : 'photos'}`;

  return (
    <>
      <View style={styles.night}>
        <Image
          source={{ uri: night.url }}
          style={styles.nightPhoto}
          resizeMode="cover"
          accessibilityRole="image"
          accessibilityLabel={`A photo from ${night.event.title}`}
        />
        <View style={styles.nightText}>
          <Text style={styles.nightTitle} numberOfLines={2}>
            {night.event.title}
          </Text>
          <Text style={styles.peekSub} numberOfLines={1}>
            {photos}
            {others.length > 0 ? `, and ${others[0].title}` : ''}
          </Text>
          {given.length > 0 ? (
            <View
              style={styles.reactions}
              accessible
              accessibilityLabel={given.map((emoji) => `${counts?.[emoji]} ${REACTION_NAMES[emoji]}`).join(', ')}
            >
              {given.map((emoji) => (
                <View key={emoji} style={styles.reaction}>
                  <Ionicons name={REACTION_ICONS[emoji][1]} size={16} color={reactionColor[emoji]} />
                  <Text style={styles.reactionText}>{counts?.[emoji]}</Text>
                </View>
              ))}
            </View>
          ) : null}
        </View>
      </View>
      <Pressable
        onPress={onPlay}
        accessibilityRole="button"
        accessibilityLabel={`Play the night, ${night.event.title}`}
        style={({ pressed }) => [styles.blue, pressed && styles.pressed]}
      >
        <Ionicons name="play" size={16} color={colors.onInk} />
        <Text style={styles.blueText}>Play the night</Text>
      </Pressable>
    </>
  );
}

// One plan of the day: its time, title, who or where, and where you stand.
function PlanRow({ plan, now, first, onPress }: { plan: MyEvent; now: Date; first: boolean; onPress: () => void }) {
  const tone = toneOf(plan, now);
  const isIn = plan.myStatus === 'in';
  const count = plan.going.length;
  const names = plan.going.map((person) => firstName(person.name)).slice(0, 3);
  const sub = [names.join(', '), shortPlace(plan.placeLabel ?? plan.location)].filter(Boolean).join(', ') || plan.groupName;

  let pill: TicketPill | null = null;
  let status: string;
  if (tone === 'live') status = 'on now';
  else if (tone === 'over' && plan.myStatus !== 'out') {
    pill = { label: isIn ? 'went' : 'over', tone: 'quiet' };
    status = isIn ? 'you went' : 'over';
  } else if (tone === 'ask') {
    pill = { label: 'Answer', tone: 'ask' };
    status = 'needs your answer';
  } else if (plan.myStatus === 'maybe') {
    pill = { label: 'Maybe', tone: 'accent' };
    status = 'you said maybe';
  } else if (plan.myStatus === 'out') {
    pill = { label: 'Passed', tone: 'quiet' };
    status = 'you passed';
  } else {
    pill = { label: count > 1 ? `${count} in` : "You're in", tone: 'accent', icon: 'checkmark' };
    status = "you're in";
  }

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${plan.startTime ?? 'All day'}, ${plan.title}, ${sub}, ${status}`}
      accessibilityHint="Opens the plan"
      style={({ pressed }) => [styles.row, !first && styles.rowRule, pressed && styles.pressed]}
    >
      <Text style={styles.rowTime}>{plan.startTime ?? 'day'}</Text>
      <View style={styles.rowText}>
        <Text style={styles.rowTitle} numberOfLines={1}>
          {plan.title}
        </Text>
        <Text style={styles.rowSub} numberOfLines={1}>
          {sub}
        </Text>
      </View>
      {tone === 'live' ? <OnNow /> : pill ? <Pill {...pill} /> : null}
    </Pressable>
  );
}

const chipFill: Record<ChipTone, string> = {
  in: colors.primary,
  maybe: colors.accentSoft,
  ask: tint.danger,
  live: sun,
  over: colors.sunk,
};

const chipInk: Record<ChipTone, string> = {
  in: colors.onInk,
  maybe: colors.accentInk,
  // The same deep red as the Answer pill.
  ask: tint.dangerInk,
  live: sunOn,
  over: colors.textSoft,
};

const reactionColor: Record<ReactionEmoji, string> = {
  '🔥': colors.danger,
  '😂': colors.text,
  '😍': colors.primary,
  '🍻': colors.text,
};

const styles = StyleSheet.create({
  screen: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: colors.bg },
  column: {
    flex: 1,
    width: '100%',
    maxWidth: layout.column,
    alignSelf: 'center',
  },
  pressed: { opacity: 0.6 },

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
  today: { minHeight: 44, justifyContent: 'center', paddingHorizontal: space.xxs },
  todayPill: {
    height: 32,
    paddingHorizontal: 13,
    borderRadius: radius.pill,
    justifyContent: 'center',
    backgroundColor: colors.accentSoft,
  },
  todayText: { color: colors.accentInk, ...typo.bold, fontSize: textSize.body },

  head: { flexDirection: 'row', alignItems: 'flex-end', paddingTop: space.xxs, paddingLeft: 18, paddingRight: space.xs },
  titles: { flex: 1, minWidth: 0 },
  month: { color: colors.text, ...typo.display, fontSize: textSize.hero, letterSpacing: -1 },
  year: { color: colors.textFaint, ...typo.medium, letterSpacing: -0.6 },
  squad: { color: colors.textSoft, ...typo.regular, fontSize: textSize.body, marginTop: 3 },
  arrow: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },

  weekdays: { flexDirection: 'row', gap: GAP, paddingHorizontal: 8, paddingTop: space.sm, paddingBottom: space.xs },
  weekday: {
    flex: 1,
    textAlign: 'center',
    color: colors.textSoft,
    ...typo.semi,
    fontSize: 11.5,
  },

  // The grid takes every bit of height that is left; each week shares it.
  grid: { flex: 1, minHeight: 0, paddingHorizontal: 8, paddingBottom: space.lg, gap: GAP },
  gridPeeking: { paddingBottom: space.sm },
  week: { flex: 1, minHeight: 0, flexDirection: 'row', gap: GAP },
  cell: {
    flex: 1,
    minWidth: 0,
    minHeight: 44,
    paddingTop: CELL_TOP,
    paddingHorizontal: 4,
    paddingBottom: CELL_BOTTOM,
    gap: CHIP_GAP,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: alpha(colors.surface, 0.86),
  },
  cellOut: { flex: 1, minWidth: 0 },
  cellGone: { backgroundColor: alpha(colors.surface, 0.5) },
  cellPhoto: { paddingTop: 4, backgroundColor: dusk.skyTop },
  cellPressed: { transform: [{ scale: 0.96 }] },

  number: {
    alignSelf: 'flex-start',
    minWidth: 22,
    height: NUMBER,
    paddingHorizontal: 4,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  numberPhoto: { backgroundColor: scrim.inkStrong },
  numberToday: { backgroundColor: sun },
  numberText: { color: colors.text, ...typo.mono, fontWeight: '600', fontSize: textSize.body },
  numberGone: { color: colors.textFaint, fontWeight: '500' },
  numberTextPhoto: { color: colors.onInk, fontWeight: '600' },
  numberTodayText: { color: sunOn, fontWeight: '700' },

  count: {
    position: 'absolute',
    left: 4,
    bottom: 4,
    height: 18,
    paddingHorizontal: 5,
    borderRadius: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: scrim.inkStrong,
  },
  countText: { color: colors.onInk, ...typo.mono, fontWeight: '600', fontSize: 10.5 },

  chip: { alignItems: 'center', justifyContent: 'center' },
  chipText: { ...typo.mono, fontWeight: '600', fontSize: textSize.micro, letterSpacing: -0.2 },
  chipTextSmall: { fontSize: 9.5 },
  more: { color: colors.textSoft, ...typo.mono, fontWeight: '600', fontSize: textSize.micro, textAlign: 'center' },

  ring: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, borderRadius: 12, borderWidth: 2.5 },
  ringToday: { borderColor: sun },
  ringChosen: { borderColor: colors.primary },
  ringWhite: { borderColor: colors.surface },
  // Inside the cobalt ring when the day is both.
  ringInner: { top: 2.5, right: 2.5, bottom: 2.5, left: 2.5, borderRadius: 10 },

  // The peek: a ticket under the month, its tear line level with the notches.
  peek: {
    marginHorizontal: space.sm,
    marginBottom: 22,
    paddingTop: 12,
    paddingHorizontal: 14,
    paddingBottom: 14,
    borderRadius: radius.xl,
    ...shadow.hero,
  },
  peekHead: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 44 },
  peekTitles: { flex: 1, minWidth: 0 },
  peekTitle: { color: colors.text, ...typo.display, fontSize: 18, letterSpacing: -0.5 },
  peekSub: { color: colors.textSoft, ...typo.regular, fontSize: 12.5, marginTop: 1 },
  close: {
    width: 44,
    height: 44,
    marginRight: -4,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.sunk,
  },
  tear: { marginTop: 8, marginBottom: 10, marginHorizontal: -7 },
  empty: { color: colors.textSoft, ...typo.regular, fontSize: 13.5, lineHeight: 19 },

  blue: {
    height: 46,
    marginTop: 12,
    borderRadius: radius.pill,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    backgroundColor: colors.primary,
  },
  blueText: { color: colors.onInk, ...typo.semi, fontSize: 14.5 },

  night: { flexDirection: 'row', gap: 12 },
  nightPhoto: { width: 118, height: 84, borderRadius: 12, backgroundColor: dusk.skyTop },
  nightText: { flex: 1, minWidth: 0, justifyContent: 'space-between' },
  nightTitle: { color: colors.text, ...typo.bold, fontSize: textSize.lead, letterSpacing: -0.25, lineHeight: 19 },
  reactions: { flexDirection: 'row', gap: 10 },
  reaction: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  reactionText: { color: colors.text, ...typo.semi, fontSize: textSize.body },

  row: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 48, paddingVertical: 4 },
  rowRule: { borderTopWidth: 1, borderTopColor: colors.border },
  rowTime: { width: 40, color: colors.accentInk, ...typo.mono, fontWeight: '600', fontSize: textSize.small },
  rowText: { flex: 1, minWidth: 0 },
  rowTitle: { color: colors.text, ...typo.bold, fontSize: 14.5, letterSpacing: -0.2 },
  rowMore: { flex: 1, color: colors.accentInk, ...typo.semi, fontSize: textSize.body },
  rowSub: { color: colors.textSoft, ...typo.regular, fontSize: textSize.small },
});
