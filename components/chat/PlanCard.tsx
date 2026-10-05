import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import type { RsvpStatus } from '../../services/serviceEvents';
import type { PlanSuggestion } from '../../services/serviceSuggestions';
import { formatDateTime } from '../../lib/datetime';
import { placeLines } from '../../lib/place';
import { paper, radius, space, typo } from '../../theme';

type PlanCardProps = {
  plan: PlanSuggestion;
  // On your own (dark) bubble.
  mine: boolean;
  saving: boolean;
  onAnswer: (status: RsvpStatus | null) => void;
  onOpen: () => void;
};

// A plan suggested in the chat: what, when, where, and I'm in / Pass right
// there. Not a vote: everyone answers for themselves.
export default function PlanCard({ plan, mine, saving, onAnswer, onOpen }: PlanCardProps) {
  const event = plan.event;
  const status = event.myStatus;
  const where = placeLines(event.location, event.placeLabel).primary;
  const line = [formatDateTime(event.date, event.startTime), where].filter(Boolean).join(' · ');
  const meta = [event.groupName, plan.goingCount > 0 ? `${plan.goingCount} in` : null].filter(Boolean).join(' · ');

  function pick(next: RsvpStatus) {
    onAnswer(status === next ? null : next);
  }

  return (
    <View style={styles.card}>
      <Pressable
        onPress={onOpen}
        accessibilityRole="button"
        accessibilityLabel={`Suggested plan: ${event.title}. ${line}. ${meta}. Open it`}
        style={({ pressed }) => pressed && styles.pressed}
      >
        <Text style={[styles.kicker, mine && styles.kickerMine]}>SUGGESTS A PLAN</Text>
        <Text style={[styles.title, mine && styles.textMine]} numberOfLines={2}>
          {event.title}
        </Text>
        <Text style={[styles.line, mine && styles.lineMine]} numberOfLines={2}>
          {line}
        </Text>
        {meta ? (
          <Text style={[styles.meta, mine && styles.lineMine]} numberOfLines={1}>
            {meta}
          </Text>
        ) : null}
      </Pressable>

      <View style={styles.buttons}>
        {saving ? (
          <ActivityIndicator size="small" color={mine ? paper.onMine : paper.accent} style={styles.spinner} />
        ) : (
          <>
            <Pressable
              onPress={() => pick('in')}
              accessibilityRole="button"
              accessibilityLabel={status === 'in' ? "You're in. Tap to take it back" : "I'm in"}
              accessibilityState={{ selected: status === 'in' }}
              style={({ pressed }) => [
                styles.button,
                mine && styles.buttonOnMine,
                status === 'in' && styles.buttonIn,
                pressed && styles.pressed,
              ]}
            >
              <Ionicons
                name={status === 'in' ? 'checkmark' : 'thumbs-up-outline'}
                size={14}
                color={status === 'in' ? paper.onMine : mine ? paper.onMine : paper.ink}
              />
              <Text style={[styles.buttonText, (mine || status === 'in') && styles.textMine]}>
                {status === 'in' ? "You're in" : "I'm in"}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => pick('out')}
              accessibilityRole="button"
              accessibilityLabel={status === 'out' ? 'You passed. Tap to take it back' : 'Pass'}
              accessibilityState={{ selected: status === 'out' }}
              style={({ pressed }) => [
                styles.button,
                mine && styles.buttonOnMine,
                status === 'out' && styles.buttonOut,
                pressed && styles.pressed,
              ]}
            >
              <Text style={[styles.buttonText, mine && styles.textMine, status === 'out' && styles.textOut]}>
                {status === 'out' ? 'Passed' : 'Pass'}
              </Text>
            </Pressable>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: space.sm, minWidth: 200 },
  kicker: { color: paper.accent, ...typo.mono, fontSize: 9.5, letterSpacing: 1.2 },
  kickerMine: { color: paper.accentOnMine },
  title: { marginTop: 2, color: paper.ink, ...typo.semi, fontSize: 15, lineHeight: 20 },
  line: { color: paper.inkSoft, ...typo.mono, fontSize: 11, marginTop: 2 },
  meta: { color: paper.inkFaint, ...typo.medium, fontSize: 11.5, marginTop: 1 },
  lineMine: { color: 'rgba(255,255,255,0.7)' },
  textMine: { color: paper.onMine },
  buttons: { flexDirection: 'row', gap: space.xs, minHeight: 36 },
  spinner: { alignSelf: 'center', marginLeft: space.xs },
  button: {
    flex: 1,
    minHeight: 36,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingHorizontal: space.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: paper.line,
    backgroundColor: paper.surface,
  },
  buttonOnMine: { borderColor: 'rgba(255,255,255,0.25)', backgroundColor: 'rgba(255,255,255,0.08)' },
  buttonIn: { borderColor: paper.accent, backgroundColor: paper.accent },
  buttonOut: { borderColor: paper.danger, backgroundColor: paper.dangerSoft },
  buttonText: { color: paper.ink, ...typo.semi, fontSize: 13 },
  textOut: { color: paper.danger },
  pressed: { opacity: 0.7 },
});
