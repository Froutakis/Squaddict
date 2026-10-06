import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, textSize, typo } from '../../theme';

type IconName = keyof typeof Ionicons.glyphMap;

type IconTabsProps<T extends string> = {
  // `dot` marks a tab that has something waiting for you.
  options: { value: T; label: string; icon: IconName; activeIcon: IconName; dot?: boolean }[];
  value: T;
  onChange: (value: T) => void;
};

// Quiet tabs: plain words, the chosen one on a soft neutral chip. No colour.
export default function IconTabs<T extends string>({ options, value, onChange }: IconTabsProps<T>) {
  return (
    <View style={styles.track} accessibilityRole="tablist">
      {options.map((option) => {
        const active = option.value === value;

        return (
          <Pressable
            key={option.value}
            onPress={() => onChange(option.value)}
            hitSlop={4}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            accessibilityLabel={option.dot ? option.label + ', something needs you' : option.label}
            style={({ pressed }) => [styles.item, active && styles.itemActive, pressed && !active && styles.pressed]}
          >
            <Ionicons
              name={active ? option.activeIcon : option.icon}
              size={15}
              color={active ? colors.text : colors.textFaint}
            />
            <Text selectable={false} style={[styles.label, active && styles.labelActive]}>{option.label}</Text>
            {option.dot ? <View style={styles.dot} /> : null}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: { flexDirection: 'row', gap: 4 },
  item: {
    flex: 1,
    height: 36,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: radius.md,
  },
  itemActive: { backgroundColor: colors.surfaceAlt },
  pressed: { opacity: 0.6 },
  label: { color: colors.textFaint, ...typo.semi, fontSize: textSize.body },
  labelActive: { color: colors.text },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.accent },
});
