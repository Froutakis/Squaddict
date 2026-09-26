import { Platform, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { colors, radius, shadow, space, textSize, tracking, typo } from '../../theme';
import Monogram from '../general/Monogram';

export const GROUP_CARD_WIDTH = 216;

export type CardGroup = {
  id: string;
  handle: string;
  name: string;
  bio: string | null;
  memberCount: number;
  openEvents?: number;
  followerCount?: number;
};

type GroupCardProps = {
  group: CardGroup;
  following?: boolean;
  member?: boolean;
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
  group,
  following = false,
  member = false,
  saving = false,
  reason,
  onPress,
  onFollow,
  style,
}: GroupCardProps) {
  const stats = [plural(group.memberCount, 'member', 'members')];
  if (group.openEvents !== undefined && group.openEvents > 0) {
    stats.push(plural(group.openEvents, 'plan up', 'plans up'));
  } else if (group.followerCount !== undefined && group.followerCount > 0) {
    stats.push(plural(group.followerCount, 'follower', 'followers'));
  }

  const label = `${group.name}, @${group.handle}, ${stats.join(', ')}`;

  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress && !(Platform.OS === 'web' && onFollow && !member) ? 'button' : undefined}
      accessibilityLabel={label}
      style={({ pressed }) => [styles.card, pressed && onPress ? styles.pressed : null, style]}
    >
      <View style={styles.head}>
        <Monogram name={group.name} size={38} square />

        <View style={styles.headText}>
          <Text style={styles.name} numberOfLines={1}>
            {group.name}
          </Text>
          <Text style={styles.handle} numberOfLines={1}>
            @{group.handle}
          </Text>
        </View>
      </View>

      {reason ? (
        <Text style={styles.reason} numberOfLines={2}>
          {reason}
        </Text>
      ) : null}

      <View style={styles.foot}>
        <Text style={styles.stats} numberOfLines={1}>
          {stats.join(' · ')}
        </Text>

        {member ? (
          <Text style={styles.memberText}>Member</Text>
        ) : onFollow ? (
          <Pressable
            onPress={onFollow}
            disabled={saving}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={following ? `Unfollow ${group.name}` : `Follow ${group.name}`}
            accessibilityState={{ selected: following, disabled: saving }}
            style={({ pressed }) => (pressed || saving ? styles.pressed : null)}
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
    padding: 14,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    ...shadow.card,
  },
  pressed: { opacity: 0.7 },

  head: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  headText: { flex: 1 },
  name: { color: colors.text, ...typo.semi, fontSize: 15.5, letterSpacing: tracking.title },
  handle: {
    marginTop: 1,
    color: colors.textFaint,
    ...typo.medium,
    fontSize: textSize.small,
  },

  reason: {
    marginTop: 11,
    color: colors.primary,
    ...typo.medium,
    fontSize: textSize.small,
    lineHeight: 16,
  },

  foot: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    marginTop: 11,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  stats: {
    flex: 1,
    color: colors.textFaint,
    ...typo.mono,
    fontSize: textSize.small,
  },
  followText: { color: colors.primary, ...typo.semi, fontSize: textSize.base },
  followingText: { color: colors.success, ...typo.semi, fontSize: textSize.base },
  memberText: { color: colors.textFaint, ...typo.semi, fontSize: textSize.base },
});
