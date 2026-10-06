import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { RsvpStatus } from '../../services/serviceEvents';
import { colors, radius, textSize, typo } from '../../theme';

// Your answer to a plan. The database keeps in or out; Maybe means no answer
// yet, said out loud, so it clears whatever you had.
export type Answer = 'in' | 'maybe' | 'out';

const OPTIONS: { key: Answer; label: string }[] = [
  { key: 'in', label: 'In' },
  { key: 'maybe', label: 'Maybe' },
  { key: 'out', label: 'Out' },
];

// What the database is told for each choice.
export function toStatus(answer: Answer): RsvpStatus | null {
  return answer === 'maybe' ? null : answer;
}

type AnswerSegProps = {
  value: Answer | null;
  onChange: (answer: Answer) => void;
  disabled?: boolean;
  // 'onBlue': inside a chosen (blue) ticket, on a white 16% track.
  // 'sheet': the big one in the plan sheet, on the page grey.
  tone?: 'onBlue' | 'sheet';
  label?: string;
};

// In | Maybe | Out as one segmented control; the chosen one stands out.
export default function AnswerSeg({ value, onChange, disabled = false, tone = 'onBlue', label = 'Your answer' }: AnswerSegProps) {
  const sheet = tone === 'sheet';
  return (
    <View style={[styles.track, sheet ? styles.trackSheet : styles.trackBlue]} accessibilityRole="radiogroup" accessibilityLabel={label}>
      {OPTIONS.map((option) => {
        const on = value === option.key;
        return (
          <Pressable
            key={option.key}
            onPress={() => onChange(option.key)}
            disabled={disabled}
            accessibilityRole="radio"
            accessibilityLabel={option.label}
            accessibilityState={{ checked: on, disabled }}
            style={({ pressed }) => [
              styles.option,
              sheet ? styles.optionSheet : styles.optionBlue,
              on && (sheet ? styles.onSheet : styles.onBlue),
              pressed && styles.pressed,
              disabled && styles.disabled,
            ]}
          >
            {sheet && on && option.key === 'in' ? <Ionicons name="checkmark" size={17} color={colors.onInk} /> : null}
            <Text
              style={[
                styles.text,
                sheet ? styles.textSheet : styles.textBlue,
                on && (sheet ? styles.textOnSheet : styles.textOnBlue),
              ]}
              numberOfLines={1}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: { flexDirection: 'row', gap: 4 },
  trackBlue: { padding: 3, borderRadius: radius.sm + 2, backgroundColor: 'rgba(255,255,255,0.16)' },
  trackSheet: { padding: 4, gap: 6, borderRadius: radius.md + 2, backgroundColor: colors.bg },
  option: { flex: 1, flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center' },
  optionBlue: { height: 32, borderRadius: 9 },
  optionSheet: { height: 44, borderRadius: radius.sm + 2 },
  onBlue: { backgroundColor: colors.surface },
  onSheet: { backgroundColor: colors.primary },
  pressed: { transform: [{ scale: 0.97 }] },
  disabled: { opacity: 0.6 },
  text: { ...typo.semi },
  textBlue: { color: 'rgba(255,255,255,0.85)', fontSize: textSize.body },
  textSheet: { color: colors.textSoft, fontSize: 14.5 },
  textOnBlue: { color: colors.accentInk },
  textOnSheet: { color: colors.onInk },
});
