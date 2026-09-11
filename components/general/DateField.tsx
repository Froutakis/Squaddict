import { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { colors, typo } from '../../theme';
import { dayMonth } from '../../lib/datetime';
import { fieldStyles } from '../../fieldStyles';
import DatePickerSheet from './DatePickerSheet';

type DateFieldProps = {
  label?: string;
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
  const name = label ?? 'Date';

  return (
    <View style={[fieldStyles.field, style]}>
      {label ? <Text style={fieldStyles.label}>{label}</Text> : null}

      <Pressable
        style={[
          fieldStyles.box,
          open && fieldStyles.focused,
          !!error && fieldStyles.errorBox,
          disabled && fieldStyles.disabled,
        ]}
        onPress={() => setOpen(true)}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={name}
        accessibilityValue={{ text: shown }}
      >
        <Ionicons
          name={icon}
          size={20}
          color={error ? colors.danger : open ? colors.primary : colors.textSoft}
        />
        <Text style={[styles.value, !value && fieldStyles.placeholder]} numberOfLines={1}>
          {shown}
        </Text>
        <Ionicons name="chevron-down" size={18} color={colors.textFaint} />
      </Pressable>

      {error ? <Text style={fieldStyles.error}>{error}</Text> : null}

      <DatePickerSheet
        visible={open}
        title={name}
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
  value: {
    flex: 1,
    color: colors.text,
    ...typo.mono,
    fontSize: 15,
    letterSpacing: 0.4,
  },
});
