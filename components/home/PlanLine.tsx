import { useEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import type { MyEvent, RsvpStatus } from '../../services/serviceEvents';
import { addDays, eventWindow, keyOf, parseLocal, startOfWeek } from '../../lib/datetime';
import { DateNode, GroupNode, GroupTitle, TimeNode, TimelineRow, TodayNode } from './Timeline';
import LineTicket, { shortPlace, type DayPhase } from './LineTicket';
import { colors, radius, space, textSize, typo } from '../../theme';

type PlanLineProps = {
  // Your plans from today on, from all your pareas (and one that started
  // yesterday and is still going).
  plans: MyEvent[];
  now: Date;
  userId: string;
  isCheckedIn: (eventId: string) => boolean;
  hereCount: (eventId: string) => number;
  onOpen: (plan: MyEvent) => void;
  onRsvp: (plan: MyEvent, status: RsvpStatus | null) => void;
  onCheckIn: (plan: MyEvent) => void;
  onAddPhoto: (plan: MyEvent) => void;
  onThrowPlan: () => void;
  // Where the NOW row sits inside the line, so Home can open on it.
  // The NOW row, so the page can measure where it sits; onNowLayout says when it moved.
  nowRef?: RefObject<View | null>;
  onNowLayout?: () => void;
  // A problem saving an answer, a check-in or a photo; shown under NOW.
  error?: string | null;
};

// The upper half of the memories line, read like the rest of the page: later
// is higher. The coming days on top, grouped into stretches; then today, hour
// by hour; then NOW. The rail always says when (the day, or today the hour);
// the content says what. One plan is a ticket, the one that matters now; tap
// any other row and it becomes the ticket instead.
export default function PlanLine({
  plans,
  now,
  userId,
  isCheckedIn,
  hereCount,
  onOpen,
  onRsvp,
  onCheckIn,
  onAddPhoto,
  onThrowPlan,
  nowRef,
  onNowLayout,
  error = null,
}: PlanLineProps) {
  const [chosen, setChosen] = useState<string | null>(null);
  const todayKey = keyOf(now);

  const phaseOf = (plan: MyEvent): DayPhase => {
    const { startsAt, endsAt } = eventWindow(plan.date, plan.startTime, plan.endTime);
    if (now >= endsAt) return 'past';
    return now >= startsAt ? 'live' : 'later';
  };

  const future = plans.filter((plan) => plan.date > todayKey).sort(soonestFirst);
  const today = plans.filter((plan) => plan.date <= todayKey);
  const ahead = today.filter((plan) => phaseOf(plan) !== 'past');
  const over = today.filter((plan) => phaseOf(plan) === 'past');

  // On now first (one with a start time before an all-day one), else the next
  // one still to come, today or later; never one you passed on.
  const live = ahead
    .filter((plan) => phaseOf(plan) === 'live' && plan.myStatus !== 'out')
    .sort((a, b) => Number(!!b.startTime) - Number(!!a.startTime) || (b.startTime ?? '').localeCompare(a.startTime ?? ''));
  const natural =
    live[0] ??
    [...ahead.filter((plan) => phaseOf(plan) === 'later'), ...future]
      .filter((plan) => plan.myStatus !== 'out')
      .sort(soonestFirst)[0] ??
    null;
  const front = plans.find((plan) => plan.id === chosen) ?? natural;
  const toGo = ahead.filter((plan) => plan.myStatus !== 'out').length;

  // When the clock moves the natural plan on (one ended, one started), a plan
  // you had opened by hand lets go too; so does one that left the list.
  const naturalId = natural?.id ?? null;
  useEffect(() => {
    setChosen(null);
  }, [naturalId]);
  useEffect(() => {
    if (chosen && !plans.some((plan) => plan.id === chosen)) setChosen(null);
  }, [chosen, plans]);

  // Tapping the natural plan's row brings it back; any other opens that one.
  function toggle(plan: MyEvent) {
    setChosen(plan.id === naturalId ? null : plan.id);
  }

  function kicker(plan: MyEvent, phase: DayPhase) {
    const time = plan.startTime;
    const next = plan.id === naturalId ? 'NEXT · ' : '';
    if (phase === 'live') return plan.endTime ? `ON NOW · TILL ${plan.endTime}` : 'ON NOW';
    if (phase === 'past') return time ? `EARLIER · ${time}` : 'EARLIER TODAY';
    if (plan.date > todayKey) return `${next}${dayWord(plan.date, now)}${time ? ` · ${time}` : ''}`;
    if (!time) return `${next}TODAY`;
    const { startsAt } = eventWindow(plan.date, plan.startTime, plan.endTime);
    const mins = Math.max(1, Math.round((startsAt.getTime() - now.getTime()) / 60000));
    return `${next}${time} · IN ${mins < 60 ? `${mins} MIN` : `${Math.round(mins / 60)}H`}`;
  }

  function people(plan: MyEvent, phase: DayPhase): string | null {
    const here = phase === 'live' ? hereCount(plan.id) : 0;
    if (here > 0) return `${here} here now`;
    const names = [
      ...plan.going.filter((person) => person.id === userId).map(() => 'You'),
      ...plan.going.filter((person) => person.id !== userId).map((person) => firstName(person.name)),
    ].filter(Boolean);
    if (names.length === 0) return null;
    const rest = names.length - 2;
    return `${names.slice(0, 2).join(', ')}${rest > 0 ? ` +${rest}` : ''} ${phase === 'past' ? 'went' : 'in'}`;
  }

  function body(plan: MyEvent, phase: DayPhase, showTime: boolean) {
    if (plan.id === front?.id) {
      return (
        <Reveal key={`${plan.id}-ticket`} style={styles.ticketWrap}>
          <LineTicket
            event={plan}
            phase={phase}
            kicker={kicker(plan, phase)}
            people={people(plan, phase)}
            checkedIn={isCheckedIn(plan.id)}
            onOpen={() => onOpen(plan)}
            onIn={() => onRsvp(plan, 'in')}
            onPass={() => {
              // Passing on the plan you opened folds it back to the natural one.
              if (chosen === plan.id) setChosen(null);
              onRsvp(plan, 'out');
            }}
            onClear={() => onRsvp(plan, null)}
            onCheckIn={() => onCheckIn(plan)}
            onAddPhoto={() => onAddPhoto(plan)}
          />
        </Reveal>
      );
    }
    return (
      <Reveal key={`${plan.id}-row`}>
        <LineRow plan={plan} phase={phase} showTime={showTime} onPress={() => toggle(plan)} />
      </Reveal>
    );
  }

  const rows: ReactNode[] = [];
  const isFirst = () => rows.length === 0;

  // The coming days, furthest stretch on top, each headed by a hollow diamond.
  for (const stretch of stretches([...future].reverse(), now)) {
    const asks = stretch.plans.filter((plan) => plan.myStatus === undefined).length;
    rows.push(
      <TimelineRow key={`s-${stretch.label}`} first={isFirst()} node={<GroupNode hollow />}>
        <GroupTitle
          kicker={stretch.label}
          title={stretch.plans.length === 1 ? '1 plan' : `${stretch.plans.length} plans`}
          meta={asks > 0 ? `${asks} ${asks === 1 ? 'needs' : 'need'} you` : undefined}
        />
      </TimelineRow>,
    );
    stretch.plans.forEach((plan, i) => {
      const sameDayAbove = i > 0 && stretch.plans[i - 1].date === plan.date;
      const ask = plan.myStatus === undefined;
      rows.push(
        <TimelineRow
          key={plan.id}
          node={
            sameDayAbove ? (
              <TimeNode time={plan.startTime} kind={ask ? 'ask' : 'later'} />
            ) : (
              <DateNode date={plan.date} kind={ask ? 'ask' : 'future'} />
            )
          }
        >
          {body(plan, 'later', true)}
        </TimelineRow>,
      );
    });
  }

  // Today, latest on top, down to NOW.
  if (ahead.length > 0) {
    for (const plan of [...ahead].sort(latestFirst)) {
      const phase = phaseOf(plan);
      const kind = phase === 'live' ? 'live' : plan.myStatus === undefined ? 'ask' : 'later';
      rows.push(
        <TimelineRow key={plan.id} first={isFirst()} node={<TimeNode time={plan.startTime} kind={kind} />}>
          {body(plan, phase, false)}
        </TimelineRow>,
      );
    }
  } else {
    rows.push(
      <TimelineRow key="empty" first={isFirst()}>
        <View style={styles.empty}>
          <Text style={styles.emptyText}>{today.length === 0 ? 'Nothing on today.' : "That was today's lot."}</Text>
          <Pressable
            onPress={onThrowPlan}
            accessibilityRole="button"
            style={({ pressed }) => [styles.emptyButton, pressed && styles.pressed]}
          >
            <Text style={styles.emptyAction}>Throw out a plan</Text>
          </Pressable>
        </View>
      </TimelineRow>,
    );
  }

  return (
    <View>
      {rows}

      <View ref={nowRef} collapsable={false} onLayout={() => onNowLayout?.()}>
        <TimelineRow solid node={<TodayNode note={toGo > 0 ? `${toGo} to go` : undefined} />}>
          <View style={styles.now} accessible accessibilityLabel={`Now, ${clock(now)}`}>
            <Text style={styles.nowText}>NOW · {clock(now)}</Text>
            <View style={styles.nowRule} />
          </View>
          {error ? (
            <Text style={styles.error} accessibilityLiveRegion="polite">
              {error}
            </Text>
          ) : null}
        </TimelineRow>
      </View>

      {[...over].sort(latestFirst).map((plan) => (
        <TimelineRow key={plan.id} solid node={<TimeNode time={plan.startTime} kind="over" />}>
          {body(plan, 'past', false)}
        </TimelineRow>
      ))}
    </View>
  );
}

function LineRow({
  plan,
  phase,
  showTime,
  onPress,
}: {
  plan: MyEvent;
  phase: DayPhase;
  showTime: boolean;
  onPress: () => void;
}) {
  const past = phase === 'past';
  const live = phase === 'live';
  const isIn = plan.myStatus === 'in';
  const passed = plan.myStatus === 'out';
  const ask = plan.myStatus === undefined && !past;
  const count = plan.going.length;

  let right: ReactNode;
  if (live && !passed) right = <Text style={styles.live}>ON NOW</Text>;
  else if (past) right = <Text style={styles.meta}>{isIn ? 'went' : 'missed'}</Text>;
  else if (ask) right = <Text style={styles.answer}>ANSWER</Text>;
  else if (passed) right = <Text style={styles.meta}>passed</Text>;
  else right = count > 0 ? <Text style={styles.meta}>{count} in</Text> : null;

  const status = live ? 'on now' : past ? (isIn ? 'you went' : 'over') : ask ? 'needs your answer' : passed ? 'you passed' : "you're in";
  const sub = [showTime ? plan.startTime : null, plan.groupName, shortPlace(plan.placeLabel ?? plan.location)]
    .filter(Boolean)
    .join(' · ');

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${plan.title}, ${sub}, ${status}. Show it`}
      style={({ pressed }) => [styles.row, past && styles.rowPast, pressed && styles.rowPressed]}
    >
      <View style={styles.rowText}>
        <Text style={[styles.title, passed && styles.titlePassed]} numberOfLines={1}>
          {plan.title}
        </Text>
        <Text style={styles.sub} numberOfLines={1}>
          {sub}
        </Text>
      </View>
      {right}
    </Pressable>
  );
}

// Fades and lifts in whatever it wraps the moment it appears: a row folding
// back, or a row opening into the ticket.
export function Reveal({ children, style }: { children: ReactNode; style?: object }) {
  const t = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(t, { toValue: 1, duration: 260, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [t]);

  return (
    <Animated.View
      style={[
        style,
        {
          opacity: t,
          transform: [
            { translateY: t.interpolate({ inputRange: [0, 1], outputRange: [6, 0] }) },
            { scale: t.interpolate({ inputRange: [0, 1], outputRange: [0.97, 1] }) },
          ],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}

// The coming plans (furthest first) split into stretches of time: later this
// week, this weekend, next week, later in the month, then by month.
function stretches(plans: MyEvent[], now: Date): { label: string; plans: MyEvent[] }[] {
  const out: { label: string; plans: MyEvent[] }[] = [];
  for (const plan of plans) {
    const label = stretchOf(plan.date, now);
    const last = out[out.length - 1];
    if (last && last.label === label) last.plans.push(plan);
    else out.push({ label, plans: [plan] });
  }
  return out;
}

export function stretchOf(date: string, now: Date): string {
  const d = parseLocal(date);
  const week = startOfWeek(now);
  const nextWeek = addDays(week, 7);
  const after = addDays(week, 14);
  if (d < nextWeek) return d.getDay() === 0 || d.getDay() === 6 ? 'This weekend' : 'Later this week';
  if (d < after) return 'Next week';
  const month = d.toLocaleDateString('en-US', { month: 'long' });
  if (d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()) return `Later in ${month}`;
  return d.getFullYear() === now.getFullYear() ? month : `${month} ${d.getFullYear()}`;
}

// "TOMORROW", or "SAT 3 OCT".
export function dayWord(date: string, now: Date): string {
  if (date === keyOf(addDays(now, 1))) return 'TOMORROW';
  const d = parseLocal(date);
  const weekday = d.toLocaleDateString('en-US', { weekday: 'short' });
  const month = d.toLocaleDateString('en-US', { month: 'short' });
  return `${weekday} ${d.getDate()} ${month}`.toUpperCase();
}

function soonestFirst(a: MyEvent, b: MyEvent) {
  return a.date.localeCompare(b.date) || (a.startTime ?? '').localeCompare(b.startTime ?? '');
}

function latestFirst(a: MyEvent, b: MyEvent) {
  return soonestFirst(b, a);
}

function firstName(name: string) {
  return name.trim().split(/\s+/)[0] ?? '';
}

function clock(d: Date) {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

const styles = StyleSheet.create({
  pressed: { opacity: 0.6 },
  ticketWrap: { marginTop: 2, marginBottom: space.xs },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    minHeight: 50,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginBottom: space.xs,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: 'rgba(255,255,255,0.6)',
  },
  rowPast: { opacity: 0.55, borderStyle: 'dashed', backgroundColor: 'transparent' },
  rowPressed: { backgroundColor: colors.surface },
  rowText: { flex: 1, minWidth: 0 },
  title: { color: colors.text, ...typo.bold, fontSize: textSize.base },
  titlePassed: { color: colors.textSoft, textDecorationLine: 'line-through' },
  sub: { color: colors.textSoft, ...typo.medium, fontSize: textSize.caption },
  meta: { color: colors.textSoft, ...typo.semi, fontSize: textSize.small },
  live: { color: colors.danger, ...typo.mono, fontSize: textSize.micro, letterSpacing: 1 },
  answer: {
    overflow: 'hidden',
    color: '#8A5300',
    backgroundColor: '#FFF3D6',
    ...typo.mono,
    fontSize: textSize.micro,
    letterSpacing: 1,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: radius.pill,
  },

  now: { flexDirection: 'row', alignItems: 'center', gap: space.xs, height: 26 },
  nowText: { color: colors.danger, ...typo.mono, fontSize: textSize.micro, letterSpacing: 1.2 },
  nowRule: { flex: 1, height: 1.5, backgroundColor: colors.danger, opacity: 0.5 },

  empty: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    minHeight: 50,
    paddingLeft: 14,
    paddingRight: 4,
    marginBottom: space.xs,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: '#B9C6F3',
  },
  emptyText: { flex: 1, color: colors.textSoft, ...typo.semi, fontSize: textSize.body },
  emptyButton: { minHeight: 44, justifyContent: 'center', paddingHorizontal: space.sm },
  emptyAction: { color: colors.primary, ...typo.display, fontSize: textSize.body },
  error: { marginTop: space.xs, color: colors.danger, ...typo.medium, fontSize: textSize.body },
});
