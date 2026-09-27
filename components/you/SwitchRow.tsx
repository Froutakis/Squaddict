import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { Group } from '../../services/serviceGroup';
import { unreadLabel } from '../chat/unread';
import Monogram from '../general/Monogram';
import Punch from '../general/Punch';
import { colors, radius, space, textSize, typo } from '../../theme';

type SwitchRowProps = {
  group: Group;
  unread: number;
  first: boolean;
  disabled?: boolean;
  onPress: () => void;
};

export default function SwitchRow({ group, unread, first, disabled = false, onPress }: SwitchRowProps) {
  const badge = unreadLabel(unread);
  const members = `${group.memberCount} ${group.memberCount === 1 ? 'member' : 'members'}`;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={`Act as ${group.name}${badge ? `, ${badge} unread` : ''}`}
      style={({ pressed }) => [styles.row, !first && styles.divider, pressed && styles.pressed]}
    >
      <Punch state="open" size={24} />
      <Monogram name={group.name} size={44} uri={group.avatarUrl} />

      <View style={styles.text}>
        <Text style={styles.name} numberOfLines={1}>
          {group.name}
        </Text>
        <Text style={styles.meta} numberOfLines={1}>
          @{group.handle} · {members}
        </Text>
      </View>

      {badge ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{badge}</Text>
        </View>
      ) : (
        <Ionicons name="chevron-forward" size={18} color={colors.text} />
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingHorizontal: space.md,
    paddingVertical: 14,
  },
  divider: { borderTopWidth: 1, borderTopColor: colors.border },
  pressed: { opacity: 0.6 },
  text: { flex: 1 },
  name: { color: colors.text, ...typo.bold, fontSize: textSize.lead },
  meta: { color: colors.textFaint, ...typo.mono, fontSize: textSize.small },
  badge: {
    minWidth: 22,
    height: 22,
    paddingHorizontal: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { color: '#FFFFFF', ...typo.bold, fontSize: textSize.caption },
});
