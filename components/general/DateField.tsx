import { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { colors, font, radius, space } from '../../theme';
import { dayMonth } from '../../lib/datetime';
import DatePickerSheet from './DatePickerSheet';

type DateFieldProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  icon?: keyof typeof Ionicons.glyphMap;
  disabled?: boolean;
  error?: string;
  minDate?: string;
  style?: StyleProp<ViewStyle>;
};

const EMPTY = '--/--';

export default function DateField({
  label,
  value,
  onChange,
  icon = 'calendar-outline',
  disabled = false,
  error,
  minDate,
  style,
}: DateFieldProps) {
  const [open, setOpen] = useState(false);

  const shown = dayMonth(value) || EMPTY;

  return (
    <View style={[styles.field, style]}>
      <Text style={styles.label}>{label}</Text>

      <Pressable
        style={[styles.inputBox, open && styles.focused, !!error && styles.errorBox, disabled && styles.disabled]}
        onPress={() => setOpen(true)}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityValue={{ text: shown }}
      >
        <Ionicons
          name={icon}
          size={20}
          color={error ? colors.danger : open ? colors.primary : colors.textSoft}
        />
        <Text style={[styles.value, !value && styles.placeholder]} numberOfLines={1}>
          {shown}
        </Text>
        <Ionicons name="chevron-down" size={18} color={colors.textFaint} />
      </Pressable>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <DatePickerSheet
        visible={open}
        title={label}
        value={value}
        minDate={minDate}
        onCancel={() => setOpen(false)}
        onSelect={(date) => {
          setOpen(false);
          onChange(date);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: 8 },
  label: { color: colors.textStrong, fontFamily: font.semi, fontSize: 15 },
  inputBox: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: space.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  value: { flex: 1, color: colors.text, fontFamily: font.medium, fontSize: 16 },
  placeholder: { color: colors.textFaint },
  focused: {
    borderColor: colors.primary,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  errorBox: { borderColor: colors.danger },
  disabled: { opacity: 0.6 },
  error: { color: colors.danger, fontFamily: font.medium, fontSize: 13 },
});
