import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, textSize, typo } from '../../theme';

type SegmentedProps<T extends string> = {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
};

// Profile-style tabs: plain labels on a hairline, the chosen one underlined.
export default function Segmented<T extends string>({ options, value, onChange }: SegmentedProps<T>) {
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
            <Text style={[styles.label, active && styles.labelActive]}>{option.label}</Text>
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
  label: { color: colors.textFaint, ...typo.semi, fontSize: textSize.base },
  labelActive: { color: colors.text },
  bar: { height: 2, width: 28, borderRadius: 1, backgroundColor: 'transparent' },
  barActive: { backgroundColor: colors.text },
});
