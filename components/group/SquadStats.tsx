import { StyleSheet, Text, View } from 'react-native';
import { colors, space, textSize, typo } from '../../theme';

export type SquadStat = { value: number | null; label: string };

// A squad's numbers in one sharp row: figure over a small label, hairlines between.
export default function SquadStats({ stats }: { stats: SquadStat[] }) {
  return (
    <View style={styles.row}>
      {stats.map((stat, index) => (
        <View
          key={stat.label}
          style={[styles.cell, index > 0 && styles.divider]}
          accessible
          accessibilityLabel={`${stat.value ?? 'unknown'} ${stat.label}`}
        >
          <Text style={styles.value}>{stat.value === null ? '–' : stat.value}</Text>
          <Text style={styles.label} numberOfLines={1}>
            {stat.label.toUpperCase()}
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    paddingVertical: space.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderStrong,
  },
  cell: { flex: 1, alignItems: 'center', gap: 3 },
  divider: { borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: colors.borderStrong },
  value: { color: colors.text, ...typo.display, fontSize: textSize.heading, letterSpacing: -0.4 },
  label: { color: colors.textFaint, ...typo.mono, fontSize: 9.5, letterSpacing: 1 },
});
