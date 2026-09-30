import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { Group } from '../../services/serviceGroup';
import { todayLabel } from '../../lib/datetime';
import GroupSelect from '../general/GroupSelect';
import { colors, radius, space, textSize, typo } from '../../theme';

type HomeHeaderProps = {
  displayName: string;
  avatarUrl?: string | null;
  groups: Group[];
  groupId: string | null;
  onGroupSelect: (groupId: string | null) => void;
  onMenu?: () => void;
  // Unread messages across every squad, shown on the menu button.
  menuUnread?: number;
};

// Chat and new plans live in the side menu, so the header is just the menu
// button and the squad you are looking at.
export default function HomeHeader({
  displayName,
  avatarUrl = null,
  groups,
  groupId,
  onGroupSelect,
  onMenu,
  menuUnread = 0,
}: HomeHeaderProps) {
  const active = groups.find((group) => group.id === groupId);

  return (
    <View style={styles.header}>
      <Text style={styles.date}>{todayLabel()}</Text>

      <View style={styles.top}>
        {onMenu ? (
          <Pressable
            onPress={onMenu}
            accessibilityRole="button"
            accessibilityLabel={menuUnread > 0 ? `Open the menu, ${menuUnread} unread` : 'Open the menu'}
            hitSlop={6}
            style={({ pressed }) => [styles.menu, pressed && styles.pressed]}
          >
            <Ionicons name="menu" size={19} color={colors.text} />
            {menuUnread > 0 ? (
              <View style={styles.unread}>
                <Text style={styles.unreadText}>{menuUnread > 99 ? '99+' : menuUnread}</Text>
              </View>
            ) : null}
          </Pressable>
        ) : null}
        <View style={styles.picker}>
          <GroupSelect
            groups={groups}
            groupId={groupId}
            onSelect={onGroupSelect}
            allAvatarLabel={displayName}
            allAvatarUrl={avatarUrl}
            showAll={false}
          />
        </View>
      </View>

      {!active && groups.length > 1 ? (
        <Text style={styles.hint} numberOfLines={1}>
          All your pareas · tap to pick one
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: space.lg, paddingTop: space.xs },
  date: {
    color: colors.textFaint,
    ...typo.mono,
    fontSize: textSize.caption,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  top: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginTop: 3 },
  picker: { flex: 1, minWidth: 0, alignItems: 'flex-start' },
  hint: { marginTop: space.xs, color: colors.textFaint, ...typo.medium, fontSize: textSize.small },
  menu: {
    width: 38,
    height: 38,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  unread: {
    position: 'absolute',
    top: -4,
    right: -5,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.danger,
    borderWidth: 2,
    borderColor: colors.bg,
  },
  unreadText: { color: '#FFFFFF', ...typo.bold, fontSize: 9 },
  pressed: { opacity: 0.7 },
});
