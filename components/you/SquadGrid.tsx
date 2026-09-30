import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { Group } from '../../services/serviceGroup';
import SquadTile from './SquadTile';
import { colors, radius, space, textSize, typo } from '../../theme';

type SquadGridProps = {
  groups: Group[];
  actingId: string | null;
  unread: Record<string, number>;
  votes?: Record<string, number>;
  onOpen: (group: Group) => void;
  onNew: () => void;
};

type Cell = { kind: 'squad'; group: Group } | { kind: 'new' };

// Every squad you are in, with a last tile to start or join one. Two to a row
// on a phone, three once there is room, so the cards never sprawl.
const WIDE = 520;
export default function SquadGrid({ groups, actingId, unread, votes = {}, onOpen, onNew }: SquadGridProps) {
  const [columns, setColumns] = useState(2);
  const cells: Cell[] = [...groups.map((group) => ({ kind: 'squad' as const, group })), { kind: 'new' }];
  const rows: Cell[][] = [];
  for (let i = 0; i < cells.length; i += columns) rows.push(cells.slice(i, i + columns));

  return (
    <View
      style={styles.grid}
      onLayout={(event) => setColumns(event.nativeEvent.layout.width >= WIDE ? 3 : 2)}
    >
      {rows.map((pair, index) => (
        <View key={index} style={styles.row}>
          {pair.map((cell) =>
            cell.kind === 'squad' ? (
              <SquadTile
                key={cell.group.id}
                group={cell.group}
                acting={cell.group.id === actingId}
                unread={unread[cell.group.id] ?? 0}
                votes={votes[cell.group.id] ?? 0}
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
                  <Ionicons name="add" size={18} color={colors.primary} />
                </View>
                <Text style={styles.newTitle}>New squad</Text>
                <Text style={styles.newHint}>Make one or enter a code</Text>
              </Pressable>
            ),
          )}
          {Array.from({ length: columns - pair.length }).map((_, i) => (
            <View key={'pad' + i} style={styles.spacer} />
          ))}
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
    minHeight: 124,
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
    width: 34,
    height: 34,
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
