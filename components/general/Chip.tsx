import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { colors, font, radius, space, textSize } from '../../theme';

type ChipProps = {
  label: string;
  active?: boolean;
  onPress?: () => void;
  icon?: keyof typeof Ionicons.glyphMap;
  /** Δεδομένο και όχι ετικέτα — αποστάσεις, ώρες, μετρητές. */
  mono?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
};

export default function Chip({
  label,
  active = false,
  onPress,
  icon,
  mono = false,
  disabled = false,
  style,
}: ChipProps) {
  const body = (
    <>
      {icon ? (
        <Ionicons name={icon} size={13} color={active ? '#FFFFFF' : colors.textSoft} />
      ) : null}
      <Text style={[styles.label, mono && styles.mono, active && styles.labelActive]} numberOfLines={1}>
        {label}
      </Text>
    </>
  );

  if (!onPress) {
    return (
      <View style={[styles.chip, active ? styles.active : styles.idle, style]}>{body}</View>
    );
  }

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ selected: active, disabled }}
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.chip,
        active ? styles.active : styles.idle,
        pressed && styles.pressed,
        disabled && styles.disabled,
        style,
      ]}
    >
      {body}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    height: 30,
    paddingHorizontal: 12,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  idle: { backgroundColor: colors.surface, borderColor: colors.border },
  active: { backgroundColor: colors.text, borderColor: colors.text },
  pressed: { opacity: 0.7 },
  disabled: { opacity: 0.5 },

  label: { color: colors.textSoft, fontFamily: font.semi, fontSize: textSize.small },
  mono: { fontFamily: font.mono, fontSize: textSize.caption, letterSpacing: 0.6 },
  labelActive: { color: '#FFFFFF' },
});
