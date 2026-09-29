import { Ionicons } from '@expo/vector-icons';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { Group } from '../../services/serviceGroup';
import Monogram, { initialsFor } from '../general/Monogram';
import { plural } from '../../lib/text';
import { colors, radius, space, textSize, typo } from '../../theme';

const CARD = 136;

type PareaCardsProps = {
  groups: Group[];
  unread: Record<string, number>;
  nightsByGroup: Record<string, number>;
  onOpen: (groupId: string) => void;
  onNew: () => void;
};

// Your squads, busiest chat first, with a way to start another.
export default function PareaCards({ groups, unread, nightsByGroup, onOpen, onNew }: PareaCardsProps) {
  const sorted = [...groups].sort(
    (a, b) => (unread[b.id] ?? 0) - (unread[a.id] ?? 0) || (nightsByGroup[b.id] ?? 0) - (nightsByGroup[a.id] ?? 0),
  );

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
      {sorted.map((group) => {
        const count = unread[group.id] ?? 0;
        const nights = nightsByGroup[group.id] ?? 0;

        return (
          <Pressable
            key={group.id}
            onPress={() => onOpen(group.id)}
            accessibilityRole="button"
            accessibilityLabel={
              count > 0 ? `${group.name}, ${count} unread messages` : group.name
            }
            accessibilityHint="Opens this parea"
            style={({ pressed }) => [styles.card, pressed && styles.pressed]}
          >
            <View style={styles.cardTop}>
              <Monogram name={group.name} uri={group.avatarUrl} initials={initialsFor(group.name)} size={40} />
              {count > 0 ? (
                <View style={styles.badge}>
                  <Ionicons name="chatbubble" size={10} color="#FFFFFF" />
                  <Text style={styles.badgeText}>{count > 99 ? '99+' : count}</Text>
                </View>
              ) : null}
            </View>
            <Text style={styles.name} numberOfLines={1}>
              {group.name}
            </Text>
            <Text style={styles.meta} numberOfLines={1}>
              {plural(group.memberCount, 'member', 'members')}
              {nights > 0 ? ` · ${plural(nights, 'night', 'nights')}` : ''}
            </Text>
          </Pressable>
        );
      })}

      <Pressable
        onPress={onNew}
        accessibilityRole="button"
        accessibilityLabel="Make a parea"
        style={({ pressed }) => [styles.card, styles.new, pressed && styles.pressed]}
      >
        <View style={styles.newIcon}>
          <Ionicons name="add" size={22} color={colors.primary} />
        </View>
        <Text style={[styles.name, styles.newText]}>New parea</Text>
        <Text style={styles.meta}>Start one</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { gap: space.sm, paddingHorizontal: space.lg, paddingVertical: 2 },
  card: {
    width: CARD,
    padding: space.sm,
    gap: 2,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
  },
  pressed: { opacity: 0.7 },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: space.xs,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    height: 20,
    paddingHorizontal: 7,
    borderRadius: radius.pill,
    backgroundColor: colors.danger,
  },
  badgeText: { color: '#FFFFFF', ...typo.semi, fontSize: 11 },
  name: { color: colors.text, ...typo.semi, fontSize: textSize.base },
  meta: { color: colors.textSoft, ...typo.medium, fontSize: textSize.caption },
  new: {
    alignItems: 'flex-start',
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.border,
  },
  newIcon: {
    width: 40,
    height: 40,
    marginBottom: space.xs,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  newText: { color: colors.primary },
});
