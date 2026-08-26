import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { RsvpStatus } from '../../services/serviceEvents';
import { colors, font, radius, space, tint } from '../../theme';

type RsvpButtonsProps = {
  status?: RsvpStatus;
  saving: boolean;
  onChange: (status: RsvpStatus | null) => void;
  compact?: boolean;
  onDark?: boolean;
  stretch?: boolean;
};

export default function RsvpButtons({
  status,
  saving,
  onChange,
  compact = false,
  onDark = false,
  stretch = false,
}: RsvpButtonsProps) {
  function pick(next: RsvpStatus) {
    onChange(status === next ? null : next);
  }

  return (
    <View style={[styles.row, stretch && styles.rowFill]}>
      <Option
        label={status === 'in' ? "You're in" : "I'm going"}
        icon="checkmark"
        tone="success"
        active={status === 'in'}
        disabled={saving}
        compact={compact}
        onDark={onDark}
        stretch={stretch}
        onPress={() => pick('in')}
      />
      <Option
        label="Can't make it"
        icon="close"
        tone="danger"
        active={status === 'out'}
        disabled={saving}
        compact={compact}
        onDark={onDark}
        stretch={stretch}
        onPress={() => pick('out')}
      />
    </View>
  );
}

type OptionProps = {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  tone: 'success' | 'danger';
  active: boolean;
  disabled: boolean;
  compact: boolean;
  onDark: boolean;
  stretch: boolean;
  onPress: () => void;
};

function Option({ label, icon, tone, active, disabled, compact, onDark, stretch, onPress }: OptionProps) {
  const accent = tone === 'success' ? colors.success : colors.danger;
  const fill = tone === 'success' ? tint.success : tint.danger;
  const idleText = onDark ? '#FFFFFF' : colors.textSoft;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: active, disabled }}
      style={({ pressed }) => [
        styles.option,
        compact && styles.optionCompact,
        stretch && styles.optionFill,
        active
          ? onDark
            ? styles.activeDark
            : { backgroundColor: fill, borderColor: accent }
          : onDark
            ? styles.idleDark
            : styles.idleLight,
        pressed && styles.pressed,
        disabled && styles.disabled,
      ]}
    >
      {compact ? null : <Ionicons name={icon} size={17} color={active ? accent : idleText} />}
      <Text
        style={[
          styles.label,
          compact && styles.labelCompact,
          { color: active ? accent : idleText },
        ]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: space.sm },
  rowFill: { flex: 1 },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: space.md,
    paddingVertical: 11,
    borderRadius: radius.pill,
    borderWidth: 1.5,
  },
  optionCompact: { paddingHorizontal: 13, paddingVertical: 6 },
  optionFill: { flex: 1 },
  idleLight: { backgroundColor: colors.surface, borderColor: colors.border },
  idleDark: { backgroundColor: 'rgba(255,255,255,0.18)', borderColor: 'rgba(255,255,255,0.18)' },
  activeDark: { backgroundColor: '#FFFFFF', borderColor: '#FFFFFF' },
  pressed: { opacity: 0.7 },
  disabled: { opacity: 0.5 },
  label: { fontFamily: font.semi, fontSize: 15 },
  labelCompact: { fontSize: 15 },
});