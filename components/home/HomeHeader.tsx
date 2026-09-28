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
  onChat?: (groupId: string) => void;
  onPlan?: () => void;
  chatUnread?: number;
};

export default function HomeHeader({
  displayName,
  avatarUrl = null,
  groups,
  groupId,
  onGroupSelect,
  onChat,
  onPlan,
  chatUnread = 0,
}: HomeHeaderProps) {
  const active = groups.find((group) => group.id === groupId);

  return (
    <View style={styles.header}>
      <Text style={styles.date}>{todayLabel()}</Text>

      <View style={styles.top}>
        <View style={styles.picker}>
          <GroupSelect
            groups={groups}
            groupId={groupId}
            onSelect={onGroupSelect}
            allAvatarLabel={displayName}
            allAvatarUrl={avatarUrl}
          />
        </View>

        <View style={styles.actions}>
          {active && onChat ? (
            <Pressable
              onPress={() => onChat(active.id)}
              accessibilityRole="button"
              accessibilityLabel={
                chatUnread > 0
                  ? `Open the ${active.name} chat, ${chatUnread} unread`
                  : `Open the ${active.name} chat`
              }
              style={({ pressed }) => [styles.action, pressed && styles.pressed]}
            >
              <Ionicons name="chatbubble-ellipses-outline" size={16} color={colors.text} />
              <Text style={styles.actionText}>Chat</Text>
              {chatUnread > 0 ? (
                <View style={styles.unread}>
                  <Text style={styles.unreadText}>{chatUnread > 99 ? '99+' : chatUnread}</Text>
                </View>
              ) : null}
            </Pressable>
          ) : null}
          {onPlan ? (
            <Pressable
              onPress={onPlan}
              accessibilityRole="button"
              accessibilityLabel={active ? `Propose a plan to ${active.name}` : 'Propose a plan'}
              style={({ pressed }) => [styles.action, styles.actionMain, pressed && styles.pressed]}
            >
              <Ionicons name="add" size={17} color={colors.textOnBrand} />
              <Text style={[styles.actionText, styles.actionMainText]}>Plan</Text>
            </Pressable>
          ) : null}
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
  unread: {
    minWidth: 18,
    height: 18,
    paddingHorizontal: 5,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.danger,
  },
  unreadText: { color: '#FFFFFF', ...typo.semi, fontSize: 10 },
  actions: { flexDirection: 'row', gap: space.xs },
  action: {
    height: 34,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  actionMain: { borderColor: colors.primary, backgroundColor: colors.primary },
  actionText: { color: colors.text, ...typo.semi, fontSize: textSize.small },
  actionMainText: { color: colors.textOnBrand },
  pressed: { opacity: 0.7 },
});
