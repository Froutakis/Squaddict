import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, textSize, typo } from '../../theme';

type IconName = keyof typeof Ionicons.glyphMap;

type IconTabsProps<T extends string> = {
  options: { value: T; label: string; icon: IconName; activeIcon: IconName }[];
  value: T;
  onChange: (value: T) => void;
};

// An iOS segmented control: one grey track, the chosen segment a raised white pill.
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
            style={({ pressed }) => [styles.item, active && styles.itemActive, pressed && !active && styles.pressed]}
          >
            <Ionicons
              name={active ? option.activeIcon : option.icon}
              size={15}
              color={active ? colors.text : colors.textFaint}
            />
            <Text selectable={false} style={[styles.label, active && styles.labelActive]}>{option.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: { flexDirection: 'row', gap: 2, padding: 2, borderRadius: 11, backgroundColor: 'rgba(118,118,128,0.14)' },
  item: {
    flex: 1,
    height: 32,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: 9,
  },
  itemActive: {
    backgroundColor: colors.surface,
    shadowColor: '#000000',
    shadowOpacity: 0.12,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  pressed: { opacity: 0.6 },
  label: { color: colors.textFaint, ...typo.semi, fontSize: textSize.body },
  labelActive: { color: colors.text },
});
