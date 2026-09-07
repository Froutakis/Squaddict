import { StyleSheet, Text, View } from 'react-native';
import { colors, font, radius, space } from '../../theme';

type SectionLabelProps = {
  children: string;
  count?: number;
};

export default function SectionLabel({ children, count }: SectionLabelProps) {
  if (count === undefined) {
    return <Text style={styles.label}>{children}</Text>;
  }

  return (
    <View style={styles.row}>
      <Text style={[styles.label, styles.inRow]}>{children}</Text>
      <View style={styles.badge}>
        <Text style={styles.badgeText}>{count}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  label: {
    color: colors.textFaint,
    fontFamily: font.bold,
    fontSize: 11,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: space.xs,
    marginHorizontal: 2,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  inRow: { marginBottom: 0 },
  badge: {
    minWidth: 19,
    height: 19,
    paddingHorizontal: 5,
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: space.xs,
  },
  badgeText: { color: '#FFFFFF', fontFamily: font.bold, fontSize: 10.5 },
});
