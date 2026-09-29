import { StyleSheet, View } from 'react-native';
import type { Group } from '../../services/serviceGroup';
import SquadTile from './SquadTile';
import { space } from '../../theme';

type FollowShelfProps = {
  groups: Group[];
  onOpen: (group: Group) => void;
};

export default function FollowShelf({ groups, onOpen }: FollowShelfProps) {
  const rows: Group[][] = [];
  for (let i = 0; i < groups.length; i += 2) rows.push(groups.slice(i, i + 2));

  return (
    <View style={styles.grid}>
      {rows.map((pair) => (
        <View key={pair[0].id} style={styles.row}>
          {pair.map((group) => (
            <SquadTile key={group.id} group={group} onPress={() => onOpen(group)} />
          ))}
          {pair.length === 1 ? <View style={styles.spacer} /> : null}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { gap: space.sm },
  row: { flexDirection: 'row', gap: space.sm },
  spacer: { flex: 1 },
});
