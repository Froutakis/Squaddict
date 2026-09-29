import { StyleSheet, View } from 'react-native';
import { colors } from '../../theme';

// A row of short dashes, like the tear line on our tickets. Drawn as views
// because a one-sided dashed border does not render on every platform.
const DASHES = 80;

export default function DashedDivider() {
  return (
    <View style={styles.row} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {Array.from({ length: DASHES }).map((_, i) => (
        <View key={i} style={styles.dash} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 4, height: 1.5, overflow: 'hidden' },
  dash: { width: 6, height: 1.5, borderRadius: 1, backgroundColor: colors.borderStrong },
});
