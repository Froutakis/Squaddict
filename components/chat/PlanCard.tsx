import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import type { RsvpStatus } from '../../services/serviceEvents';
import type { PlanSuggestion } from '../../services/serviceSuggestions';
import { formatDateTime } from '../../lib/datetime';
import { placeLines } from '../../lib/place';
import Ticket from '../general/Ticket';
import { CARD_WIDTH } from './ChatVoteCard';
import { colors, radius, space, textSize, tint, typo } from '../../theme';

type PlanCardProps = {
  plan: PlanSuggestion;
  saving: boolean;
  onAnswer: (status: RsvpStatus | null) => void;
  onOpen: () => void;
  // The message menu (reply, react), from the part of the card that opens.
  onLongPress?: () => void;
};

// A plan suggested in the chat, as a ticket: what, when, where, and I'm in /
// Pass on the stub. Not a vote: everyone answers for themselves.
export default function PlanCard({ plan, saving, onAnswer, onOpen, onLongPress }: PlanCardProps) {
  const event = plan.event;
  const status = event.myStatus;
  const where = placeLines(event.location, event.placeLabel).primary;
  const line = [formatDateTime(event.date, event.startTime), where].filter(Boolean).join(' · ');
  // "Harbour Crew's plan", "Jazz Lovers' plan".
  const whose = event.groupName.endsWith('s') ? `${event.groupName}'` : `${event.groupName}'s`;
  const meta = [`${whose} plan`, plan.goingCount > 0 ? `${plan.goingCount} in` : null]
    .filter(Boolean)
    .join(' · ');

  function pick(next: RsvpStatus) {
    onAnswer(status === next ? null : next);
  }

  return (
    <Ticket
      style={styles.card}
      stub={
        <View style={styles.stub}>
          {saving ? (
            <ActivityIndicator size="small" color={colors.primary} style={styles.spinner} />
          ) : (
            <View style={styles.buttons}>
              <Pressable
                onPress={() => pick('in')}
                accessibilityRole="button"
                accessibilityLabel={status === 'in' ? "You're in. Tap to take it back" : "I'm in"}
                accessibilityState={{ selected: status === 'in' }}
                style={({ pressed }) => [styles.button, status === 'in' ? styles.inChip : styles.ink, pressed && styles.pressed]}
              >
                <Ionicons
                  name={status === 'in' ? 'checkmark' : 'thumbs-up-outline'}
                  size={15}
                  color={status === 'in' ? colors.success : colors.onInk}
                />
                <Text style={[styles.buttonText, status === 'in' ? styles.inText : styles.onInk]}>
                  {status === 'in' ? "You're in" : "I'm in"}
                </Text>
              </Pressable>
              <Pressable
                onPress={() => pick('out')}
                accessibilityRole="button"
                accessibilityLabel={status === 'out' ? 'You passed. Tap to take it back' : 'Pass'}
                accessibilityState={{ selected: status === 'out' }}
                style={({ pressed }) => [styles.button, status === 'out' ? styles.outChip : styles.grey, pressed && styles.pressed]}
              >
                <Text style={[styles.buttonText, status === 'out' && styles.outText]}>
                  {status === 'out' ? 'Passed' : 'Pass'}
                </Text>
              </Pressable>
            </View>
          )}
          <Text style={styles.note}>Not a vote. Everyone answers for themselves.</Text>
        </View>
      }
    >
      <Pressable
        onPress={onOpen}
        onLongPress={onLongPress}
        accessibilityRole="button"
        accessibilityLabel={`Suggested plan: ${event.title}. ${line}. ${meta}. Open it`}
        style={({ pressed }) => pressed && styles.pressed}
      >
        <View style={styles.kickerRow}>
          <Ionicons name="compass" size={13} color={colors.success} />
          <Text style={styles.kicker}>Suggests a plan</Text>
        </View>
        <Text style={styles.title} numberOfLines={2}>
          {event.title}
        </Text>
        <Text style={styles.line} numberOfLines={2}>
          {line}
        </Text>
        <Text style={styles.meta} numberOfLines={1}>
          {meta}
        </Text>
      </Pressable>
    </Ticket>
  );
}

const styles = StyleSheet.create({
  card: { width: CARD_WIDTH },
  pressed: { opacity: 0.8 },
  kickerRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  kicker: {
    color: colors.success,
    ...typo.mono,
    fontSize: textSize.micro,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  title: {
    marginTop: 6,
    marginBottom: 4,
    color: colors.text,
    ...typo.display,
    fontSize: 18,
    lineHeight: 21,
    letterSpacing: -0.5,
  },
  line: {
    color: colors.textSoft,
    ...typo.mono,
    fontSize: textSize.caption,
    lineHeight: 15,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  meta: { marginTop: 6, color: colors.textSoft, ...typo.semi, fontSize: 12.5 },

  stub: { gap: space.xs + 2 },
  spinner: { height: 44 },
  buttons: { flexDirection: 'row', gap: space.xs + 2 },
  button: {
    flex: 1,
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: radius.sm + 2,
  },
  buttonText: { color: colors.ink, ...typo.display, fontSize: textSize.base },
  onInk: { color: colors.onInk },
  ink: { backgroundColor: colors.ink },
  grey: { backgroundColor: colors.surfaceAlt },
  inChip: { backgroundColor: tint.success },
  inText: { color: colors.success },
  outChip: { backgroundColor: tint.danger },
  outText: { color: colors.danger },
  note: { color: colors.textSoft, ...typo.medium, fontSize: textSize.small },
});
