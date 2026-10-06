import { Ionicons } from '@expo/vector-icons';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { MyEvent, RsvpStatus } from '../../services/serviceEvents';
import { formatDateTime, keyOf, parseLocal } from '../../lib/datetime';
import LineTicket from '../home/LineTicket';
import TonightTicket from './TonightTicket';
import { colors, paper, radius, shadow, space, textSize, tint, typo } from '../../theme';

type Starter = {
  key: string;
  icon: keyof typeof Ionicons.glyphMap;
  tint: string;
  color: string;
  label: string;
  hint: string;
  onPress: () => void;
};

type ChatEmptyProps = {
  // The parea's next plan (tonight's first), if there is one.
  plan: MyEvent | null;
  meId: string;
  compact?: boolean;
  // Shown on tonight's plan you are in on, when live spots are switched on.
  onOnMyWay?: () => void;
  onOpenPlan: (plan: MyEvent) => void;
  onAnswer: (plan: MyEvent, status: RsvpStatus | null) => void;
  // "Who's in tonight?": the question goes into the message field.
  onAsk: () => void;
  onProposePlan: () => void;
  onAskParea: () => void;
  onSharePhoto: () => void;
};

// What an empty chat shows instead of "Quiet in here": the next plan, and an
// easy first thing to say.
export default function ChatEmpty({
  plan,
  meId,
  compact = false,
  onOnMyWay,
  onOpenPlan,
  onAnswer,
  onAsk,
  onProposePlan,
  onAskParea,
  onSharePhoto,
}: ChatEmptyProps) {
  const tonight = plan !== null && plan.date === keyOf(new Date());
  const going = plan ? goingLine(plan, meId) : null;

  const starters: Starter[] = [
    {
      key: 'who',
      icon: 'people',
      tint: paper.accentSoft,
      color: colors.primary,
      label: whoLabel(plan),
      hint: 'Asks with a mention',
      onPress: onAsk,
    },
    { key: 'plan', icon: 'ticket', tint: paper.accentSoft, color: colors.primary, label: 'Propose a plan', hint: 'Goes to a vote', onPress: onProposePlan },
    { key: 'poll', icon: 'help-circle', tint: tint.sun, color: colors.ink, label: 'Ask the parea', hint: '2 to 4 choices', onPress: onAskParea },
    { key: 'photo', icon: 'image', tint: tint.neutral, color: colors.ink, label: 'Share a photo', hint: 'Camera or library', onPress: onSharePhoto },
  ];

  return (
    <ScrollView
      contentContainerStyle={[styles.wrap, compact && styles.wrapCompact]}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {plan ? (
        <View style={[styles.ticket, compact && styles.ticketCompact]}>
          {tonight && plan.myStatus === 'in' && onOnMyWay ? (
            <TonightTicket
              kicker={plan.startTime ? `Tonight · ${plan.startTime}` : 'Tonight'}
              title={plan.title}
              line={going ?? "You're in"}
              actionLabel="On my way"
              actionIcon="navigate"
              onAction={onOnMyWay}
              onOpen={() => onOpenPlan(plan)}
            />
          ) : (
            <LineTicket
              event={plan}
              phase="later"
              kicker={(tonight
                ? plan.startTime ? `Tonight · ${plan.startTime}` : 'Tonight'
                : `Next up · ${formatDateTime(plan.date, plan.startTime)}`
              ).toUpperCase()}
              people={going}
              checkedIn={false}
              onOpen={() => onOpenPlan(plan)}
              onIn={() => onAnswer(plan, 'in')}
              onPass={() => onAnswer(plan, 'out')}
              onClear={() => onAnswer(plan, null)}
              onCheckIn={() => onOpenPlan(plan)}
              onAddPhoto={() => onOpenPlan(plan)}
            />
          )}
        </View>
      ) : null}

      <Text style={[styles.title, compact && styles.titleCompact]} accessibilityRole="header">
        Nothing said yet. Suspicious.
      </Text>
      <Text style={[styles.sub, compact && styles.subCompact]}>
        {plan ? 'Start with the plan, or with something easier.' : 'Start with something easy.'}
      </Text>

      <View style={styles.starters}>
        {starters.map((starter) => (
          <Pressable
            key={starter.key}
            onPress={starter.onPress}
            accessibilityRole="button"
            accessibilityLabel={starter.label}
            accessibilityHint={starter.hint}
            style={({ pressed }) => [styles.starter, compact && styles.starterCompact, pressed && styles.pressed]}
          >
            <View style={[styles.icon, { backgroundColor: starter.tint }]}>
              <Ionicons name={starter.icon} size={17} color={starter.color} />
            </View>
            <View style={styles.starterText}>
              <Text style={styles.starterLabel} numberOfLines={1}>
                {starter.label}
              </Text>
              <Text style={styles.starterHint} numberOfLines={1}>
                {starter.hint}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={colors.textFaint} />
          </Pressable>
        ))}
      </View>
    </ScrollView>
  );
}

// "You, Nikos, Eleni in", or nobody yet.
function goingLine(plan: MyEvent, meId: string): string | null {
  const people = [...plan.going].sort((a, b) => (a.id === meId ? -1 : b.id === meId ? 1 : 0));
  const names = people.map((person) => (person.id === meId ? 'You' : person.name.split(' ')[0] || person.name));
  if (names.length === 0) return null;
  if (names.length <= 3) return `${names.join(', ')} in`;
  return `${names.slice(0, 2).join(', ')} +${names.length - 2} in`;
}

export function whoLabel(plan: MyEvent | null): string {
  if (!plan) return "Who's free this week?";
  if (plan.date === keyOf(new Date())) return "Who's in tonight?";
  const weekday = parseLocal(plan.date).toLocaleDateString('en-US', { weekday: 'long' });
  return `Who's in for ${weekday}?`;
}

const styles = StyleSheet.create({
  wrap: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: space.md, paddingTop: space.sm, paddingBottom: space.md },
  wrapCompact: { paddingTop: space.xs },
  pressed: { opacity: 0.8 },
  ticket: { marginBottom: space.lg + 2 },
  ticketCompact: { marginBottom: space.md },
  title: { color: colors.text, ...typo.display, fontSize: textSize.hero, lineHeight: 28, letterSpacing: -1 },
  titleCompact: { fontSize: 22, lineHeight: 25 },
  sub: { marginTop: 6, marginBottom: space.md, color: colors.textSoft, ...typo.regular, fontSize: textSize.base, lineHeight: 20 },
  subCompact: { marginBottom: space.sm },
  starters: { gap: space.xs + 2 },
  starter: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    ...shadow.bubble,
  },
  starterCompact: { minHeight: 46, paddingVertical: 5 },
  icon: { width: 32, height: 32, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
  starterText: { flex: 1, minWidth: 0 },
  starterLabel: { color: colors.text, ...typo.bold, fontSize: 14.5 },
  starterHint: {
    marginTop: 2,
    color: colors.textSoft,
    ...typo.mono,
    fontSize: textSize.micro,
    letterSpacing: 0.2,
  },
});
