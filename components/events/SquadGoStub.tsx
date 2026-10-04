import type { ReactNode } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import type { PlanStance } from '../../lib/squadVote';
import { colors, radius, space, textSize, typo } from '../../theme';

type SquadGoStubProps = {
  stance: PlanStance | null;
  busy: boolean;
  // Yes on the acting squad's open vote, or the Votes page when there is
  // none to answer (useSquadPlans' act).
  onAct: () => void;
  // The plain I'm in / Pass buttons, shown when the member can answer.
  children: ReactNode;
};

// Where I'm in / Pass sit on another squad's public plan: the squad decides
// first. Until then this shows the acting squad's vote, says yes to it, or
// takes you to Votes to start one.
export default function SquadGoStub({ stance, busy, onAct, children }: SquadGoStubProps) {
  if (stance === null) {
    return (
      <View style={styles.row}>
        <ActivityIndicator size="small" color={colors.textSoft} />
      </View>
    );
  }

  if (stance.kind === 'rsvp') return <>{children}</>;

  if (stance.kind === 'no-squad') {
    return (
      <View style={styles.row}>
        <Text style={styles.note}>{stance.text}</Text>
      </View>
    );
  }

  const waiting = stance.kind === 'vote' && stance.waiting;
  const icon = stance.kind === 'propose' ? 'people-outline' : waiting ? 'time-outline' : 'thumbs-up-outline';

  return (
    <Pressable
      onPress={onAct}
      disabled={busy}
      accessibilityRole="button"
      accessibilityLabel={stance.label}
      accessibilityHint={stance.kind === 'propose' || waiting ? 'Opens Votes' : undefined}
      accessibilityState={{ disabled: busy }}
      style={({ pressed }) => [
        styles.button,
        waiting ? styles.outlined : styles.solid,
        (pressed || busy) && styles.pressed,
      ]}
    >
      <Ionicons name={icon} size={15} color={waiting ? colors.text : '#FFFFFF'} />
      <Text style={[styles.label, waiting ? styles.outlinedText : styles.solidText]} numberOfLines={1}>
        {stance.label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flex: 1, minHeight: 36, flexDirection: 'row', alignItems: 'center' },
  note: { color: colors.textSoft, ...typo.medium, fontSize: textSize.small },
  button: {
    flex: 1,
    minHeight: 36,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.xxs,
    paddingHorizontal: 14,
    borderRadius: radius.pill,
  },
  solid: { backgroundColor: colors.text },
  outlined: { borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.surface },
  label: { flexShrink: 1, ...typo.semi, fontSize: textSize.body },
  solidText: { color: '#FFFFFF' },
  outlinedText: { color: colors.text },
  pressed: { opacity: 0.6 },
});
