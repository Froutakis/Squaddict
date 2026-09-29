import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme';

type IconName = keyof typeof Ionicons.glyphMap;

type IconTabsProps<T extends string> = {
  options: { value: T; label: string; icon: IconName; activeIcon: IconName }[];
  value: T;
  onChange: (value: T) => void;
};

// Instagram-style tabs: one icon each, the chosen one filled and underlined.
export default function IconTabs<T extends string>({ options, value, onChange }: IconTabsProps<T>) {
  return (
    <View style={styles.track} accessibilityRole="tablist">
      {options.map((option) => {
        const active = option.value === value;

        return (
          <Pressable
            key={option.value}
            onPress={() => onChange(option.value)}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            accessibilityLabel={option.label}
            style={styles.item}
          >
            <Ionicons
              name={active ? option.activeIcon : option.icon}
              size={23}
              color={active ? colors.text : colors.textFaint}
            />
            <View style={[styles.bar, active && styles.barActive]} />
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: 'row',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderStrong,
  },
  item: { flex: 1, alignItems: 'center', paddingTop: 10, gap: 9 },
  bar: { alignSelf: 'stretch', height: 1.5, backgroundColor: 'transparent' },
  barActive: { backgroundColor: colors.text },
});
