import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet } from 'react-native';
import TicketShape from './TicketShape';
import { colors, space } from '../../theme';

const SIZE = 58;
// Where it sits: bottom-right, in thumb reach, above the home indicator.
export const PLAN_BUTTON_RIGHT = space.md;
export const PLAN_BUTTON_BOTTOM = 14;
// The strip at the bottom of the side rail that holds it.
export const PLAN_BUTTON_SPACE = PLAN_BUTTON_BOTTOM + SIZE + space.sm;

type PlanButtonProps = {
  squadName: string;
  onPress: () => void;
};

// New plan for the current parea: a small blue ticket with a +, notched on
// both sides, shown while the side rail is open.
export default function PlanButton({ squadName, onPress }: PlanButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`New plan for ${squadName}`}
      style={({ pressed }) => [styles.button, pressed && styles.pressed]}
    >
      <TicketShape fill={colors.primary} corner={16} notch={4} />
      <Ionicons name="add" size={30} color={colors.onInk} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: SIZE,
    height: SIZE,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.38,
    shadowRadius: 14,
  },
  pressed: { transform: [{ scale: 0.92 }] },
});
