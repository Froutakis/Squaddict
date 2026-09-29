import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, typo } from '../../theme';

type IconName = keyof typeof Ionicons.glyphMap;

type IconTabsProps<T extends string> = {
  options: { value: T; label: string; icon: IconName; activeIcon: IconName }[];
  value: T;
  onChange: (value: T) => void;
};

// Tabs as icon + small mono label, the chosen one filled and underlined.
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
            <View style={styles.head}>
              <Ionicons
                name={active ? option.activeIcon : option.icon}
                size={17}
                color={active ? colors.text : colors.textFaint}
              />
              <Text style={[styles.label, active && styles.labelActive]}>{option.label.toUpperCase()}</Text>
            </View>
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
  head: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  label: { color: colors.textFaint, ...typo.mono, fontSize: 10.5, letterSpacing: 1.2 },
  labelActive: { color: colors.text },
  bar: { alignSelf: 'stretch', height: 2, marginHorizontal: 18, borderRadius: 1, backgroundColor: 'transparent' },
  barActive: { backgroundColor: colors.text },
});
