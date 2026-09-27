import { StyleSheet, Text, View } from 'react-native';
import type { Group } from '../../services/serviceGroup';
import { todayLabel } from '../../lib/datetime';
import GroupSelect from '../general/GroupSelect';
import { colors, space, textSize, typo } from '../../theme';

type HomeHeaderProps = {
  displayName: string;
  avatarUrl?: string | null;
  groups: Group[];
  groupId: string | null;
  onGroupSelect: (groupId: string | null) => void;
};

export default function HomeHeader({
  displayName,
  avatarUrl = null,
  groups,
  groupId,
  onGroupSelect,
}: HomeHeaderProps) {
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
});
