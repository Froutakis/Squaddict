import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text } from 'react-native';
import { colors, space, textSize, typo } from '../../theme';

type ShowMoreProps = {
  hidden: number;
  expanded: boolean;
  onToggle: () => void;
};

// The foot of a list that only shows its first few rows.
export default function ShowMore({ hidden, expanded, onToggle }: ShowMoreProps) {
  if (hidden <= 0 && !expanded) return null;

  return (
    <Pressable
      onPress={onToggle}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityState={{ expanded }}
      style={({ pressed }) => [styles.button, pressed && styles.pressed]}
    >
      <Text style={styles.text}>{expanded ? 'Show less' : `Show ${hidden} more`}</Text>
      <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={15} color={colors.primary} />
    </Pressable>
  );
}

// Which rows to render and how many are tucked away.
export function visibleSlice<T>(items: T[], limit: number, expanded: boolean) {
  const shown = expanded ? items : items.slice(0, limit);
  return { shown, hidden: items.length - shown.length };
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: space.sm,
  },
  pressed: { opacity: 0.6 },
  text: { color: colors.primary, ...typo.semi, fontSize: textSize.body },
});
