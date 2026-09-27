import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { Group } from '../../services/serviceGroup';
import type { Person } from '../../lib/people';
import { todayLabel } from '../../lib/datetime';
import GroupSelect from '../general/GroupSelect';
import AttendeeStack from '../events/Attendee';
import { colors, radius, space, textSize, typo } from '../../theme';

type HomeHeaderProps = {
  displayName: string;
  avatarUrl?: string | null;
  groups: Group[];
  groupId: string | null;
  members?: Person[];
  onGroupSelect: (groupId: string | null) => void;
  onChat?: (groupId: string) => void;
  onPlan?: () => void;
};

function plural(n: number, one: string, many: string) {
  return `${n} ${n === 1 ? one : many}`;
}

export default function HomeHeader({
  displayName,
  avatarUrl = null,
  groups,
  groupId,
  members = [],
  onGroupSelect,
  onChat,
  onPlan,
}: HomeHeaderProps) {
  const active = groups.find((group) => group.id === groupId);

  return (
    <View style={styles.header}>
      <Text style={styles.date}>{todayLabel()}</Text>

      <View style={styles.picker}>
        <GroupSelect
          groups={groups}
          groupId={groupId}
          onSelect={onGroupSelect}
          allAvatarLabel={displayName}
          allAvatarUrl={avatarUrl}
        />
      </View>

      {active ? (
        <View style={styles.squad}>
          <View style={styles.faces}>
            <AttendeeStack people={members} size={26} max={5} />
            <Text style={styles.count}>{plural(active.memberCount, 'member', 'members')}</Text>
          </View>

          <View style={styles.actions}>
            {onChat ? (
              <Pressable
                onPress={() => onChat(active.id)}
                accessibilityRole="button"
                accessibilityLabel={`Open the ${active.name} chat`}
                style={({ pressed }) => [styles.action, pressed && styles.pressed]}
              >
                <Ionicons name="chatbubble-ellipses-outline" size={16} color={colors.text} />
                <Text style={styles.actionText}>Chat</Text>
              </Pressable>
            ) : null}
            {onPlan ? (
              <Pressable
                onPress={onPlan}
                accessibilityRole="button"
                accessibilityLabel={`Propose a plan to ${active.name}`}
                style={({ pressed }) => [styles.action, styles.actionMain, pressed && styles.pressed]}
              >
                <Ionicons name="add" size={17} color={colors.textOnBrand} />
                <Text style={[styles.actionText, styles.actionMainText]}>Plan</Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      ) : groups.length > 1 ? (
        <Text style={styles.hint}>All your pareas · tap to pick one</Text>
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
  picker: { marginTop: 3, alignSelf: 'flex-start' },
  hint: { marginTop: 2, color: colors.textFaint, ...typo.medium, fontSize: textSize.small },
  squad: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.sm,
    marginTop: space.sm,
  },
  faces: { flexDirection: 'row', alignItems: 'center', gap: space.xs, flexShrink: 1 },
  count: { color: colors.textSoft, ...typo.medium, fontSize: textSize.small },
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
