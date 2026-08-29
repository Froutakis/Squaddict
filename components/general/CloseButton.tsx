import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { colors, radius } from '../../theme';

type CloseButtonProps = {
  onPress: () => void;
  disabled?: boolean;
  tone?: 'dark' | 'light';
  style?: StyleProp<ViewStyle>;
};

export default function CloseButton({
  onPress,
  disabled = false,
  tone = 'dark',
  style,
}: CloseButtonProps) {
  const light = tone === 'light';

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={10}
      accessibilityRole="button"
      accessibilityLabel="Close"
      accessibilityState={{ disabled }}
      style={({ pressed }) => [
        styles.button,
        light ? styles.light : styles.dark,
        pressed && styles.pressed,
        disabled && styles.disabled,
        style,
      ]}
    >
      <Ionicons name="close" size={18} color={light ? '#FFFFFF' : colors.textSoft} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 32,
    height: 32,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dark: { backgroundColor: colors.surfaceAlt },
  light: { backgroundColor: 'rgba(255,255,255,0.22)' },
  pressed: { opacity: 0.7 },
  disabled: { opacity: 0.4 },
});
