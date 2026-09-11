import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius, shadow, solidFor, space, textSize, tracking, typo } from '../../theme';
import { weekdayShort } from '../../lib/datetime';

export const PLAN_CARD_WIDTH = 250;

type PlanCardProps = {
  title: string;
  date: string;
  line: string;
  groupName?: string;
  onPress?: () => void;
};

export default function PlanCard({ title, date, line, groupName, onPress }: PlanCardProps) {
  const day = date.slice(8, 10);
  const groupColor = groupName ? solidFor(groupName) : undefined;

  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={`${title}, ${line}`}
      style={({ pressed }) => [styles.card, pressed && onPress ? styles.pressed : null]}
    >
      <View style={styles.chip}>
        <Text style={styles.weekday}>{weekdayShort(date)}</Text>
        <Text style={styles.day}>{day}</Text>
      </View>

      <View style={styles.body}>
        {groupName ? (
          <View style={styles.groupRow}>
            <View style={[styles.groupDot, { backgroundColor: groupColor }]} />
            <Text style={[styles.groupName, { color: groupColor }]} numberOfLines={1}>
              {groupName}
            </Text>
          </View>
        ) : null}

        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        <Text style={styles.line} numberOfLines={1}>
          {line}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    width: PLAN_CARD_WIDTH,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    padding: 13,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    ...shadow.card,
  },
  pressed: { opacity: 0.7 },

  chip: {
    width: 50,
    height: 48,
    borderRadius: 12,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  weekday: { color: colors.accent, ...typo.semi, fontSize: 10, letterSpacing: 0.5 },
  day: { color: colors.text, ...typo.title, fontSize: 20, letterSpacing: tracking.title },

  body: { flex: 1, minWidth: 0 },
  groupRow: { flexDirection: 'row', alignItems: 'center', gap: space.xs, marginBottom: 3 },
  groupDot: { width: 6, height: 6, borderRadius: radius.pill },
  groupName: { flexShrink: 1, ...typo.semi, fontSize: textSize.caption },
  title: { color: colors.text, ...typo.semi, fontSize: 15.5, letterSpacing: tracking.lead, lineHeight: 19 },
  line: { marginTop: 2, color: colors.textSoft, ...typo.medium, fontSize: textSize.small },
});
