import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { Group } from '../../services/serviceGroup';
import SquadTile from './SquadTile';
import { colors, radius, space, textSize, typo } from '../../theme';

// Wide enough for a name, narrow enough that the next card peeks in and says "swipe".
const CARD = 150;
const GAP = space.sm;

type SquadSliderProps = {
  groups: Group[];
  actingId: string | null;
  unread: Record<string, number>;
  onOpen: (group: Group) => void;
  onNew: () => void;
};

// Every squad you are in as a row of profile cards, the acting one first,
// with a last card to start or join one.
export default function SquadSlider({ groups, actingId, unread, onOpen, onNew }: SquadSliderProps) {
  const sorted = [...groups].sort((a, b) => Number(b.id === actingId) - Number(a.id === actingId));

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      snapToInterval={CARD + GAP}
      decelerationRate="fast"
      contentContainerStyle={styles.row}
    >
      {sorted.map((group) => (
        <View key={group.id} style={styles.card}>
          <SquadTile
            group={group}
            acting={group.id === actingId}
            unread={unread[group.id] ?? 0}
            onPress={() => onOpen(group)}
          />
        </View>
      ))}

      <Pressable
        onPress={onNew}
        accessibilityRole="button"
        accessibilityLabel="New squad: make one or join with a code"
        style={({ pressed }) => [styles.card, styles.newTile, pressed && styles.pressed]}
      >
        <View style={styles.plus}>
          <Ionicons name="add" size={20} color={colors.primary} />
        </View>
        <Text style={styles.newTitle}>New squad</Text>
        <Text style={styles.newHint}>Make one or enter a code</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { gap: GAP, paddingHorizontal: space.lg, paddingVertical: 4 },
  card: { width: CARD },
  newTile: {
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
    width: 38,
    height: 38,
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
