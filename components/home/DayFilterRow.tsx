import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, typo, radius, space } from '../../theme';

type DayFilterRowProps = {
  label: string;
  onClear: () => void;
};

export default function DayFilterRow({ label, onClear }: DayFilterRowProps) {
  return (
    <View style={styles.row}>
      <Text style={styles.text}>Showing {label}</Text>

      <Pressable
        onPress={onClear}
        accessibilityRole="button"
        accessibilityLabel="Clear the day filter"
        style={({ pressed }) => [styles.clear, pressed && styles.pressed]}
      >
        <Text style={styles.clearText}>Clear</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  text: { color: colors.textSoft, ...typo.semi, fontSize: 13, flexShrink: 1 },
  clear: {
    height: 28,
    paddingHorizontal: 12,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clearText: { color: colors.primary, ...typo.semi, fontSize: 12 },
  pressed: { opacity: 0.7 },
});
