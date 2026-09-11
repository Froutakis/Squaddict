import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { RsvpStatus } from '../../services/serviceEvents';
import { colors, typo, radius, space, textSize } from '../../theme';
import Punch, { type PunchState } from '../general/Punch';

type RsvpButtonsProps = {
  status?: RsvpStatus;
  saving: boolean;
  onChange: (status: RsvpStatus | null) => void;
  compact?: boolean;
  onDark?: boolean;
  stretch?: boolean;
};

function punchState(status?: RsvpStatus): PunchState {
  if (status === 'in') return 'in';
  if (status === 'out') return 'out';
  return 'open';
}

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
      <Punch state={punchState(status)} size={compact ? 24 : 28} onDark={onDark} />

      <Option
        label={status === 'in' ? "You're in" : "I'm in"}
        active={status === 'in'}
        disabled={saving}
        compact={compact}
        onDark={onDark}
        stretch={stretch}
        onPress={() => pick('in')}
      />
      <Option
        label={status === 'out' ? 'Passed' : 'Pass'}
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
  active: boolean;
  disabled: boolean;
  compact: boolean;
  onDark: boolean;
  stretch: boolean;
  onPress: () => void;
};

function Option({ label, active, disabled, compact, onDark, stretch, onPress }: OptionProps) {
  let box = onDark ? styles.idleDark : styles.idleLight;
  let text = onDark ? styles.textIdleDark : styles.textIdleLight;

  if (active) {
    box = onDark ? styles.activeDark : styles.activeLight;
    text = onDark ? styles.textActiveDark : styles.textActiveLight;
  }

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
        box,
        pressed && styles.pressed,
        disabled && styles.disabled,
      ]}
    >
      <Text style={[styles.label, text]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  rowFill: { flex: 1 },

  option: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 44,
    paddingHorizontal: space.md,
    borderRadius: radius.sm,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  optionCompact: { height: 36, paddingHorizontal: space.sm },
  optionFill: { flex: 1 },
  pressed: { opacity: 0.75 },
  disabled: { opacity: 0.5 },

  idleLight: { backgroundColor: colors.surface, borderColor: colors.border },
  idleDark: { backgroundColor: 'transparent', borderColor: 'rgba(255,255,255,0.3)' },
  activeLight: { backgroundColor: colors.ink, borderColor: colors.ink },
  activeDark: { backgroundColor: '#FFFFFF', borderColor: '#FFFFFF' },

  label: { ...typo.semi, fontSize: textSize.base },
  textIdleLight: { color: colors.textSoft },
  textIdleDark: { color: '#FFFFFF' },
  textActiveLight: { color: '#FFFFFF' },
  textActiveDark: { color: colors.onLight },
});
