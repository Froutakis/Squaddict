import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { Group } from '../../services/serviceGroup';
import SquadTile from './SquadTile';
import { colors, radius, space, textSize, typo } from '../../theme';

type SquadGridProps = {
  groups: Group[];
  actingId: string | null;
  unread: Record<string, number>;
  onOpen: (group: Group) => void;
  onNew: () => void;
};

type Cell = { kind: 'squad'; group: Group } | { kind: 'new' };

// Every squad you are in, two to a row, with a last tile to start or join one.
export default function SquadGrid({ groups, actingId, unread, onOpen, onNew }: SquadGridProps) {
  const cells: Cell[] = [...groups.map((group) => ({ kind: 'squad' as const, group })), { kind: 'new' }];
  const rows: Cell[][] = [];
  for (let i = 0; i < cells.length; i += 2) rows.push(cells.slice(i, i + 2));

  return (
    <View style={styles.grid}>
      {rows.map((pair, index) => (
        <View key={index} style={styles.row}>
          {pair.map((cell) =>
            cell.kind === 'squad' ? (
              <SquadTile
                key={cell.group.id}
                group={cell.group}
                acting={cell.group.id === actingId}
                unread={unread[cell.group.id] ?? 0}
                onPress={() => onOpen(cell.group)}
              />
            ) : (
              <Pressable
                key="new"
                onPress={onNew}
                accessibilityRole="button"
                accessibilityLabel="New squad: make one or join with a code"
                style={({ pressed }) => [styles.newTile, pressed && styles.pressed]}
              >
                <View style={styles.plus}>
                  <Ionicons name="add" size={22} color={colors.primary} />
                </View>
                <Text style={styles.newTitle}>New squad</Text>
                <Text style={styles.newHint}>Make one or enter a code</Text>
              </Pressable>
            ),
          )}
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
  newTile: {
    flex: 1,
    minHeight: 160,
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.xxs,
    padding: space.sm,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.borderStrong,
  },
  plus: {
    width: 42,
    height: 42,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    marginBottom: space.xxs,
  },
  newTitle: { color: colors.text, ...typo.semi, fontSize: textSize.base },
  newHint: { color: colors.textFaint, ...typo.medium, fontSize: textSize.caption, textAlign: 'center' },
  pressed: { opacity: 0.7 },
});
