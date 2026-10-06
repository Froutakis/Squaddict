import { useEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import type { MyEvent, RsvpStatus } from '../../services/serviceEvents';
import { addDays, eventWindow, keyOf, parseLocal, startOfWeek } from '../../lib/datetime';
import { DateNode, GroupNode, GroupTitle, TimeNode, TimelineRow, TodayNode } from './Timeline';
import { shortPlace, type DayPhase } from './LineTicket';
import PlanTicket, { TicketActions, type TicketPill } from './PlanTicket';
import AnswerSeg, { toStatus, type Answer } from '../general/AnswerSeg';
import AttendeeStack from '../events/Attendee';
import { colors, radius, space, sunInk, sun, textSize, typo } from '../../theme';

// Another parea's public plan you haven't answered, that your parea is
// looking at: suggested to it, or members of it are going.
export type OtherPlan = {
  event: MyEvent;
  // "Μαρία & Νίκος are going", "Μαρία suggests".
  note: string;
  saving: boolean;
};

type PlanLineProps = {
  // Your plans from today on, from all your pareas (and one that started
  // yesterday and is still going).
  plans: MyEvent[];
  // Other pareas' plans, on the line in date order but never the ticket.
  others?: OtherPlan[];
  onAnswerOther?: (plan: MyEvent, status: RsvpStatus) => void;
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
  // Where today starts on the line (its plans, or the empty day), so the page
  // opens on today; onTodayLayout says when it moved.
  todayRef?: RefObject<View | null>;
  onTodayLayout?: () => void;
  onNowLayout?: () => void;
  // A problem saving an answer, a check-in or a photo; shown under NOW.
  error?: string | null;
};

// The upper half of the memories line, read like the rest of the page: later
// is higher. The coming days on top, grouped into stretches; then today, hour
// by hour; then NOW. The rail always says when (the day, or today the hour);
// the content says what. Every plan is a ticket. The first tap chooses one
// (blue, with In | Maybe | Out) or grows the one on now; the second opens it.
export default function PlanLine({
  plans,
  others = [],
  onAnswerOther,
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
  todayRef,
  onTodayLayout,
  onNowLayout,
  error = null,
}: PlanLineProps) {
  // One plan chosen on the line at a time.
  const [chosen, setChosen] = useState<string | null>(null);
  // Plans you said Maybe to here. Only in and out are saved, so Maybe clears
  // your answer and is remembered for as long as the line is open.
  const [maybes, setMaybes] = useState<Set<string>>(new Set());
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
  // Other pareas' plans join the rows: one already over is gone.
  const otherById = new Map(others.map((one) => [one.event.id, one]));
  const otherPlans = others.map((one) => one.event).filter((plan) => plan.date > todayKey || phaseOf(plan) !== 'past');
  const futureRows = [...future, ...otherPlans.filter((plan) => plan.date > todayKey)].sort(soonestFirst);
  const aheadRows = [...ahead, ...otherPlans.filter((plan) => plan.date <= todayKey)];
  const toGo = ahead.filter((plan) => plan.myStatus !== 'out').length;

  // A chosen plan that left the list lets go.
  useEffect(() => {
    if (chosen && !plans.some((plan) => plan.id === chosen) && !others.some((one) => one.event.id === chosen)) {
      setChosen(null);
    }
  }, [chosen, plans, others]);

  // First tap chooses (or grows the live one); the second opens it.
  function tap(plan: MyEvent) {
    if (chosen === plan.id) onOpen(plan);
    else setChosen(plan.id);
  }

  function answerOf(plan: MyEvent): Answer | null {
    if (plan.myStatus) return plan.myStatus;
    return maybes.has(plan.id) ? 'maybe' : null;
  }

  function answer(plan: MyEvent, choice: Answer) {
    setMaybes((was) => {
      const next = new Set(was);
      if (choice === 'maybe') next.add(plan.id);
      else next.delete(plan.id);
      return next;
    });
    const other = otherById.get(plan.id);
    if (other) {
      // Another parea's plan has nothing to clear: Maybe stays here only.
      if (choice !== 'maybe') onAnswerOther?.(plan, choice);
      return;
    }
    const status = toStatus(choice);
    if (status === (plan.myStatus ?? null)) return;
    onRsvp(plan, status);
  }

  // "You, Nikos, Marina +1".
  function people(plan: MyEvent): string | null {
    const names = [
      ...plan.going.filter((person) => person.id === userId).map(() => 'You'),
      ...plan.going.filter((person) => person.id !== userId).map((person) => firstName(person.name)),
    ].filter(Boolean);
    if (names.length === 0) return null;
    const rest = names.length - 3;
    return `${names.slice(0, 3).join(', ')}${rest > 0 ? ` +${rest}` : ''}`;
  }

  function ticket(plan: MyEvent, phase: DayPhase, showTime: boolean) {
    const other = otherById.get(plan.id);
    const place = shortPlace(plan.placeLabel ?? plan.location);
    const isIn = plan.myStatus === 'in';
    const passed = plan.myStatus === 'out';
    const count = plan.going.length;

    if (phase === 'past') {
      const sub = [people(plan), place].filter(Boolean).join(', ') || plan.groupName;
      return (
        <PlanTicket
          state="past"
          title={plan.title}
          sub={sub}
          pill={{ label: isIn ? 'went' : 'missed', tone: 'quiet' }}
          onPress={() => onOpen(plan)}
          accessibilityLabel={`${plan.title}, ${sub}, ${isIn ? 'you went' : 'over'}. Open the plan`}
        />
      );
    }

    if (phase === 'live' && !other) {
      const here = hereCount(plan.id);
      const grown = chosen === plan.id;
      const checkedIn = isCheckedIn(plan.id);
      const short = [place, here > 0 ? `${here} here` : count > 0 ? `${count} in` : null].filter(Boolean).join(', ') || plan.groupName;
      const long = [place, people(plan)].filter(Boolean).join('. ') || plan.groupName;
      return (
        <PlanTicket
          state="live"
          grown={grown}
          title={plan.title}
          sub={short}
          long={long}
          onPress={() => tap(plan)}
          accessibilityLabel={`${plan.title}, on now, ${grown ? long : short}`}
          accessibilityHint={grown ? 'Opens the plan' : 'Shows who is there'}
          extra={
            <>
              {count > 0 || here > 0 ? (
                <View style={styles.here}>
                  <AttendeeStack people={plan.going} size={24} max={3} />
                  <Text style={styles.hereText}>{here > 0 ? `${here} here` : `${count} in`}</Text>
                </View>
              ) : null}
              {isIn ? (
                <TicketActions
                  actions={[
                    {
                      label: checkedIn ? "You're here" : "I'm here",
                      icon: checkedIn ? 'checkmark' : 'location-outline',
                      strong: !checkedIn,
                      disabled: checkedIn,
                      onPress: () => onCheckIn(plan),
                    },
                    { label: 'Photo', icon: 'camera-outline', strong: checkedIn, onPress: () => onAddPhoto(plan) },
                  ]}
                />
              ) : (
                <View style={styles.liveAnswer}>
                  <AnswerSeg tone="sheet" value={answerOf(plan)} onChange={(choice) => answer(plan, choice)} label={`Your answer to ${plan.title}`} />
                </View>
              )}
            </>
          }
        />
      );
    }

    const sub = other
      ? [plan.groupName, other.note, showTime ? plan.startTime : null].filter(Boolean).join(', ')
      : [showTime ? plan.startTime : null, plan.groupName, place].filter(Boolean).join(', ');
    let pill: TicketPill | null;
    if (other || plan.myStatus === undefined) pill = { label: 'Answer', tone: 'ask' };
    else if (passed) pill = { label: 'Passed', tone: 'quiet' };
    else if (plan.myStatus === 'maybe') pill = { label: 'Maybe', tone: 'accent' };
    else pill = { label: count > 1 ? `${count} in` : "You're in", tone: 'done', icon: 'checkmark' };
    const isChosen = chosen === plan.id;
    const status =
      other || plan.myStatus === undefined
        ? 'needs your answer'
        : passed
          ? 'you passed'
          : plan.myStatus === 'maybe'
            ? 'you said maybe'
            : "you're in";

    return (
      <PlanTicket
        state={isChosen ? 'chosen' : 'plain'}
        title={plan.title}
        sub={sub}
        pill={pill}
        answer={{ value: answerOf(plan), onChange: (choice) => answer(plan, choice), disabled: other?.saving }}
        onPress={() => tap(plan)}
        accessibilityLabel={`${plan.title}, ${sub}, ${status}`}
        accessibilityHint={isChosen ? 'Opens the plan' : 'Shows your answer'}
      />
    );
  }

  function nodeKind(plan: MyEvent, phase: DayPhase): 'later' | 'live' | 'selected' {
    if (phase === 'live' && !otherById.has(plan.id)) return 'live';
    return chosen === plan.id ? 'selected' : 'later';
  }

  const rows: ReactNode[] = [];
  const isFirst = () => rows.length === 0;

  // The coming days, furthest stretch on top, each headed by a small ticket.
  for (const stretch of stretches([...futureRows].reverse(), now)) {
    const asks = stretch.plans.filter((plan) => plan.myStatus === undefined && !otherById.has(plan.id)).length;
    rows.push(
      <TimelineRow key={`s-${stretch.label}`} first={isFirst()} node={<GroupNode />}>
        <GroupTitle
          kicker={stretch.label}
          title={stretch.plans.length === 1 ? '1 plan' : `${stretch.plans.length} plans`}
          meta={asks > 0 ? `${asks} ${asks === 1 ? 'needs' : 'need'} you` : undefined}
        />
      </TimelineRow>,
    );
    stretch.plans.forEach((plan, i) => {
      const sameDayAbove = i > 0 && stretch.plans[i - 1].date === plan.date;
      const kind = nodeKind(plan, 'later');
      rows.push(
        <TimelineRow
          key={plan.id}
          node={
            sameDayAbove ? (
              <TimeNode time={plan.startTime} kind={kind} />
            ) : (
              <DateNode date={plan.date} kind={kind === 'selected' ? 'selected' : 'future'} />
            )
          }
        >
          {ticket(plan, 'later', true)}
        </TimelineRow>,
      );
    });
  }

  // Today, latest on top, down to NOW.
  rows.push(<View key="today-mark" ref={todayRef} collapsable={false} onLayout={() => onTodayLayout?.()} />);
  if (aheadRows.length > 0) {
    for (const plan of [...aheadRows].sort(latestFirst)) {
      const phase = phaseOf(plan);
      rows.push(
        <TimelineRow key={plan.id} first={isFirst()} node={<TimeNode time={plan.startTime} kind={nodeKind(plan, phase)} />}>
          {ticket(plan, phase, false)}
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
            <Text style={styles.nowText}>{clock(now)}</Text>
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
          {ticket(plan, 'past', false)}
        </TimelineRow>
      ))}
    </View>
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

  here: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: space.xs },
  hereText: { color: colors.textSoft, ...typo.medium, fontSize: 12.5 },
  liveAnswer: { marginTop: 12 },

  now: { flexDirection: 'row', alignItems: 'center', gap: space.xs, height: 30, paddingTop: 2 },
  nowText: { color: sunInk, ...typo.mono, fontWeight: '600', fontSize: textSize.small },
  nowRule: { flex: 1, height: 1.5, backgroundColor: sun },

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
    borderColor: colors.accentSoft,
  },
  emptyText: { flex: 1, color: colors.textSoft, ...typo.semi, fontSize: textSize.body },
  emptyButton: { minHeight: 44, justifyContent: 'center', paddingHorizontal: space.sm },
  emptyAction: { color: colors.primary, ...typo.display, fontSize: textSize.body },
  error: { marginTop: space.xs, color: colors.danger, ...typo.medium, fontSize: textSize.body },
});
