import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { colors, font, radius, solidFor, space, textSize } from '../../theme';
import { initialsFor } from '../general/GradientAvatar';

export const GROUP_CARD_WIDTH = 232;

export type CardSquad = {
  id: string;
  handle: string;
  name: string;
  bio: string | null;
  memberCount: number;
  openEvents?: number;
};

type GroupCardProps = {
  squad: CardSquad;
  following?: boolean;
  saving?: boolean;
  reason?: string;
  onPress?: () => void;
  onFollow?: () => void;
  style?: StyleProp<ViewStyle>;
};

function plural(count: number, one: string, many: string) {
  return `${count} ${count === 1 ? one : many}`;
}

export default function GroupCard({
  squad,
  following = false,
  saving = false,
  reason,
  onPress,
  onFollow,
  style,
}: GroupCardProps) {
  const stats = [plural(squad.memberCount, 'member', 'members')];
  if (squad.openEvents !== undefined && squad.openEvents > 0) {
    stats.push(plural(squad.openEvents, 'plan up', 'plans up'));
  }

  const label = `${squad.name}, @${squad.handle}, ${stats.join(', ')}`;

  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={label}
      style={({ pressed }) => [styles.card, pressed && onPress ? styles.pressed : null, style]}
    >
      <View style={styles.head}>
        <View style={[styles.monogram, { backgroundColor: solidFor(squad.name) }]}>
          <Text style={styles.monogramText}>{initialsFor(squad.name)}</Text>
        </View>

        <View style={styles.headText}>
          <Text style={styles.name} numberOfLines={1}>
            {squad.name}
          </Text>
          <Text style={styles.handle} numberOfLines={1}>
            @{squad.handle}
          </Text>
        </View>
      </View>

      {reason ? (
        <Text style={styles.reason} numberOfLines={2}>
          {reason}
        </Text>
      ) : null}

      {squad.bio ? (
        <Text style={styles.bio} numberOfLines={2}>
          {squad.bio}
        </Text>
      ) : null}

      <View style={styles.rule} />

      <View style={styles.foot}>
        <Text style={styles.stats} numberOfLines={1}>
          {stats.join(' · ')}
        </Text>

        {onFollow ? (
          <Pressable
            onPress={onFollow}
            disabled={saving}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={following ? `Unfollow ${squad.name}` : `Follow ${squad.name}`}
            accessibilityState={{ selected: following, disabled: saving }}
            style={({ pressed }) => (pressed ? styles.pressed : null)}
          >
            <Text style={following ? styles.followingText : styles.followText}>
              {following ? 'Following' : 'Follow'}
            </Text>
          </Pressable>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    width: GROUP_CARD_WIDTH,
    padding: space.md,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pressed: { opacity: 0.7 },

  head: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  monogram: {
    width: 38,
    height: 38,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monogramText: { color: '#FFFFFF', fontFamily: font.semi, fontSize: textSize.body },
  headText: { flex: 1 },
  name: { color: colors.text, fontFamily: font.display, fontSize: textSize.lead, letterSpacing: -0.2 },
  handle: {
    marginTop: 1,
    color: colors.textFaint,
    fontFamily: font.mono,
    fontSize: textSize.caption,
  },

  reason: {
    marginTop: space.sm,
    color: colors.primary,
    fontFamily: font.mono,
    fontSize: 9.5,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    lineHeight: 14,
  },
  bio: {
    marginTop: space.xs,
    color: colors.textSoft,
    fontFamily: font.medium,
    fontSize: textSize.small,
    lineHeight: 17,
  },

  rule: { height: 1, backgroundColor: colors.border, marginTop: space.sm },

  foot: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    marginTop: space.sm,
  },
  stats: {
    flex: 1,
    color: colors.textFaint,
    fontFamily: font.mono,
    fontSize: 10,
    letterSpacing: 0.4,
  },
  followText: { color: colors.primary, fontFamily: font.semi, fontSize: textSize.small },
  followingText: { color: colors.success, fontFamily: font.semi, fontSize: textSize.small },
});
