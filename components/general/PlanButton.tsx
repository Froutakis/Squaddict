import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet } from 'react-native';
import { colors, radius, space } from '../../theme';

const SIZE = 56;
// Where it sits: bottom-right, in thumb reach, above the home indicator.
export const PLAN_BUTTON_RIGHT = space.md;
export const PLAN_BUTTON_BOTTOM = 14;
// The strip at the bottom of the side rail that holds it.
export const PLAN_BUTTON_SPACE = PLAN_BUTTON_BOTTOM + SIZE + space.sm;

type PlanButtonProps = {
  squadName: string;
  onPress: () => void;
};

// New plan for the current parea: a plain blue +, shown while the side rail is open.
export default function PlanButton({ squadName, onPress }: PlanButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`New plan for ${squadName}`}
      style={({ pressed }) => [styles.button, pressed && styles.pressed]}
    >
      <Ionicons name="add" size={28} color={colors.onInk} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: SIZE,
    height: SIZE,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 6,
  },
  pressed: { transform: [{ scale: 0.92 }] },
});
