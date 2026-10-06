import { useEffect, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, typo, radius, space } from '../../theme';
import SheetHeader from './SheetHeader';
import { addMonths, keyOf, monthGrid, parseDateKey } from '../../lib/datetime';

type DatePickerSheetProps = {
  visible: boolean;
  title: string;
  value: string;
  minDate?: string;
  onCancel: () => void;
  onSelect: (date: string) => void;
};

const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

function monthLabel(d: Date) {
  return `${d.toLocaleDateString('en-US', { month: 'long' }).toUpperCase()} ${d.getFullYear()}`;
}

export default function DatePickerSheet({
  visible,
  title,
  value,
  minDate,
  onCancel,
  onSelect,
}: DatePickerSheetProps) {
  const [visibleMonth, setVisibleMonth] = useState(() => parseDateKey(value) ?? new Date());

  useEffect(() => {
    if (!visible) return;
    setVisibleMonth(parseDateKey(value) ?? new Date());
  }, [visible, value]);

  const days = monthGrid(visibleMonth);
  const todayKey = keyOf(new Date());

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onCancel}>
      <Pressable style={styles.backdrop} onPress={onCancel}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          <SheetHeader title={title} onClose={onCancel} />

          <View style={styles.monthRow}>
            <Pressable
              style={({ pressed }) => [styles.navBtn, pressed && styles.pressed]}
              onPress={() => setVisibleMonth((current) => addMonths(current, -1))}
              accessibilityRole="button"
              accessibilityLabel="Previous month"
            >
              <Ionicons name="chevron-back" size={18} color={colors.textSoft} />
            </Pressable>

            <Text style={styles.month}>{monthLabel(visibleMonth)}</Text>

            <Pressable
              style={({ pressed }) => [styles.navBtn, pressed && styles.pressed]}
              onPress={() => setVisibleMonth((current) => addMonths(current, 1))}
              accessibilityRole="button"
              accessibilityLabel="Next month"
            >
              <Ionicons name="chevron-forward" size={18} color={colors.textSoft} />
            </Pressable>
          </View>

          <View style={styles.grid}>
            {WEEKDAYS.map((weekday, i) => (
              <Text key={i} style={styles.weekday}>
                {weekday}
              </Text>
            ))}

            {days.map((day) => {
              const key = keyOf(day);
              const outside = day.getMonth() !== visibleMonth.getMonth();
              const isToday = key === todayKey;
              const isSelected = key === value;
              const blocked = !!minDate && key < minDate;

              return (
                <Pressable
                  key={key}
                  style={styles.cell}
                  disabled={blocked}
                  onPress={() => onSelect(key)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isSelected, disabled: blocked }}
                  accessibilityLabel={key}
                >
                  <View style={[styles.circle, isToday && styles.today, isSelected && !isToday && styles.selected]}>
                    <Text
                      style={[
                        styles.dayText,
                        outside && styles.outside,
                        blocked && styles.blocked,
                        isToday && styles.dayTextToday,
                      ]}
                    >
                      {day.getDate()}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
    padding: space.lg,
    gap: space.md,
  },

  monthRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  month: { color: colors.textFaint, ...typo.semi, fontSize: 12, letterSpacing: 0.8 },
  navBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.7 },

  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  weekday: {
    width: '14.2857%',
    textAlign: 'center',
    color: colors.textFaint,
    ...typo.medium,
    fontSize: 11,
    marginBottom: space.xs,
  },
  cell: { width: '14.2857%', alignItems: 'center', paddingVertical: 3 },
  circle: {
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  today: { backgroundColor: colors.primary },
  selected: { borderColor: colors.primary },
  dayText: { color: colors.text, ...typo.medium, fontSize: 14 },
  dayTextToday: { color: colors.textOnBrand, ...typo.semi },
  outside: { color: colors.textFaint },
  blocked: { color: colors.textFaint, opacity: 0.5 },
});
