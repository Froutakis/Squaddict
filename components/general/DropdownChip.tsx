import { useRef, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Modal, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { colors, radius, space, textSize, typo } from '../../theme';
import Chip from './Chip';
import Glass from './Glass';
import PopIn from './PopIn';

const MENU_WIDTH = 200;
const EDGE = 12;

type Option<T extends string> = { key: T; label: string };

type DropdownChipProps<T extends string> = {
  value: T | null;
  options: Option<T>[];
  placeholder: string;
  icon?: keyof typeof Ionicons.glyphMap;
  onChange: (value: T | null) => void;
};

export default function DropdownChip<T extends string>({
  value,
  options,
  placeholder,
  icon,
  onChange,
}: DropdownChipProps<T>) {
  const anchor = useRef<View>(null);
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
  const { width } = useWindowDimensions();

  const selected = options.find((option) => option.key === value);

  function open() {
    anchor.current?.measureInWindow((x, y, _w, h) => {
      setMenu({ x: Math.max(EDGE, Math.min(x, width - MENU_WIDTH - EDGE)), y: y + h + 6 });
    });
  }

  function pick(next: T | null) {
    setMenu(null);
    onChange(next);
  }

  const rows: Option<T | ''>[] = [{ key: '', label: placeholder }, ...options];

  return (
    <View ref={anchor} collapsable={false}>
      <Chip
        label={selected?.label ?? placeholder}
        icon={icon}
        trailingIcon={menu ? 'chevron-up' : 'chevron-down'}
        active={selected !== undefined}
        onPress={open}
      />

      <Modal visible={menu !== null} transparent animationType="none" onRequestClose={() => setMenu(null)}>
        <Pressable style={styles.backdrop} onPress={() => setMenu(null)} accessibilityLabel="Close menu" />

        {menu ? (
          <PopIn style={[styles.menu, { left: menu.x, top: menu.y }]}>
            <Glass radius={radius.lg} style={styles.glass}>
              {rows.map((row) => {
                const isSelected = (row.key || null) === (value ?? null);

                return (
                  <Pressable
                    key={row.key || 'none'}
                    onPress={() => pick((row.key || null) as T | null)}
                    accessibilityRole="menuitem"
                    accessibilityState={{ selected: isSelected }}
                    style={({ pressed }) => [styles.row, pressed && styles.pressed]}
                  >
                    <Text style={[styles.rowText, isSelected && styles.rowTextSelected]}>{row.label}</Text>
                    {isSelected ? <Ionicons name="checkmark" size={16} color={colors.primary} /> : null}
                  </Pressable>
                );
              })}
            </Glass>
          </PopIn>
        ) : null}
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
  menu: { position: 'absolute', width: MENU_WIDTH },
  glass: { paddingVertical: space.xs },
  row: {
    height: 42,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.md,
  },
  pressed: { backgroundColor: 'rgba(12,25,38,0.05)' },
  rowText: { color: colors.text, ...typo.medium, fontSize: textSize.base },
  rowTextSelected: { color: colors.primary, ...typo.semi },
});
