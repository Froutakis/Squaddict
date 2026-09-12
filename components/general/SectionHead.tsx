import { StyleSheet, Text, View } from 'react-native';
import { colors, radius, space, textSize, tracking, typo } from '../../theme';

type SectionHeadProps = {
  title: string;
  meta?: string;
  count?: number;
  live?: boolean;
};

export default function SectionHead({ title, meta, count, live = false }: SectionHeadProps) {
  return (
    <View style={styles.row}>
      {live ? <View style={styles.dot} /> : null}

      <Text style={styles.title}>{title}</Text>

      {count !== undefined ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{count}</Text>
        </View>
      ) : null}

      {meta ? <Text style={styles.meta}>{meta}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    paddingHorizontal: space.lg,
    paddingBottom: space.sm,
    marginTop: space.xs,
  },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.success },
  title: { color: colors.text, ...typo.title, fontSize: textSize.heading, letterSpacing: tracking.title },
  badge: {
    minWidth: 20,
    height: 20,
    paddingHorizontal: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { color: '#FFFFFF', ...typo.bold, fontSize: textSize.small },
  meta: {
    marginLeft: 'auto',
    color: colors.textFaint,
    ...typo.mono,
    fontSize: textSize.body,
  },
});
