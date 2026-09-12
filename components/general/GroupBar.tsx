import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { Group } from '../../services/serviceGroup';
import { colors, typo, radius, solidFor, space, textSize } from '../../theme';
import { initialsFor } from './Monogram';

type GroupBarProps = {
  groups: Group[];
  activeId: string | null;
  onSelect: (id: string | null) => void;
  unread?: Record<string, number>;
  showAll?: boolean;
};

export default function GroupBar({
  groups,
  activeId,
  onSelect,
  unread = {},
  showAll = true,
}: GroupBarProps) {
  return (
    <ScrollView
      horizontal
      keyboardShouldPersistTaps="handled"
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
    >
      {showAll ? (
        <Pressable
          onPress={() => onSelect(null)}
          accessibilityRole="button"
          accessibilityState={{ selected: activeId === null }}
          accessibilityLabel="All squads"
          style={({ pressed }) => [
            styles.chip,
            activeId === null ? styles.chipActive : styles.chipIdle,
            pressed && styles.pressed,
          ]}
        >
          <Text style={[styles.name, activeId === null && styles.nameActive]}>All</Text>
        </Pressable>
      ) : null}

      {groups.map(function (group) {
        const active = activeId === group.id;
        const count = unread[group.id] ?? 0;

        return (
          <Pressable
            key={group.id}
            onPress={() => onSelect(group.id)}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            accessibilityLabel={group.name}
            style={({ pressed }) => [
              styles.chip,
              active ? styles.chipActive : styles.chipIdle,
              pressed && styles.pressed,
            ]}
          >
            <View style={[styles.monogram, { backgroundColor: solidFor(group.name) }]}>
              <Text style={styles.monogramText}>{initialsFor(group.name)}</Text>
            </View>

            <Text style={[styles.name, active && styles.nameActive]} numberOfLines={1}>
              {group.name}
            </Text>

            {count > 0 ? (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{count > 9 ? '9+' : count}</Text>
              </View>
            ) : null}
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { gap: space.xs, paddingVertical: 2, paddingRight: space.md },

  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    height: 34,
    maxWidth: 190,
    paddingLeft: 5,
    paddingRight: space.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  chipIdle: { backgroundColor: colors.surface, borderColor: colors.border },
  chipActive: { backgroundColor: colors.ink, borderColor: colors.ink },
  pressed: { opacity: 0.7 },

  monogram: {
    width: 24,
    height: 24,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monogramText: { color: '#FFFFFF', ...typo.semi, fontSize: 9.5 },

  name: { flexShrink: 1, color: colors.textSoft, ...typo.semi, fontSize: textSize.small },
  nameActive: { color: '#FFFFFF' },

  badge: {
    minWidth: 18,
    height: 18,
    paddingHorizontal: 5,
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { color: '#FFFFFF', ...typo.bold, fontSize: 10 },
});
