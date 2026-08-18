import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Group } from '../../models/main';
import { colors, font, gradientFor, radius, space } from '../../theme';
import { initialsFor } from './GradientAvatar';

type GroupBarProps = {
  groups: Group[];
  activeId: string | null;
  onSelect: (id: string | null) => void;
  unread?: Record<string, number>;
  /** Το κυκλάκι "All" — κρύψε το εκεί που δεν έχει νόημα (π.χ. στο chat). */
  showAll?: boolean;
};

type StoryRingProps = {
  colors: readonly [string, string];
  active: boolean;
  children: React.ReactNode;
};

/** Δαχτυλίδι σε στιλ story: χρωματιστό στην ενεργή παρέα, σβηστό στις υπόλοιπες. */
function StoryRing({ colors: ring, active, children }: StoryRingProps) {
  return (
    <LinearGradient
      colors={active ? [ring[0], ring[1]] : [colors.border, colors.border]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.ring}
    >
      <View style={styles.ringGap}>{children}</View>
    </LinearGradient>
  );
}

export default function GroupBar({
  groups,
  activeId,
  onSelect,
  unread = {},
  showAll = true,
}: GroupBarProps) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
      {showAll ? (
        <Pressable
          style={styles.item}
          onPress={() => onSelect(null)}
          accessibilityRole="button"
          accessibilityState={{ selected: activeId === null }}
          accessibilityLabel="All squads"
        >
          <StoryRing colors={[colors.primary, colors.accent]} active={activeId === null}>
            <View style={styles.allTile}>
              <Ionicons name="people-outline" size={22} color={colors.bg} />
            </View>
          </StoryRing>
          <Text style={[styles.label, activeId === null && styles.labelActive]} numberOfLines={1}>
            All
          </Text>
        </Pressable>
      ) : null}

      {groups.map((group) => {
        const active = activeId === group.id;
        const count = unread[group.id] ?? 0;

        return (
          <Pressable
            key={group.id}
            style={styles.item}
            onPress={() => onSelect(group.id)}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            accessibilityLabel={group.name}
          >
            <View>
              <StoryRing colors={gradientFor(group.name)} active={active}>
                <LinearGradient
                  colors={gradientFor(group.name)}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={[styles.avatar, !active && styles.avatarIdle]}
                >
                  <Text style={styles.avatarText}>{initialsFor(group.name)}</Text>
                </LinearGradient>
              </StoryRing>

              {count > 0 ? (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{count > 9 ? '9+' : count}</Text>
                </View>
              ) : null}
            </View>

            <Text style={[styles.label, active && styles.labelActive]} numberOfLines={1}>
              {group.name}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const AVATAR = 54;
const GAP = AVATAR + 6;
const RING = GAP + 5;

const styles = StyleSheet.create({
  row: { paddingHorizontal: space.md, paddingVertical: space.sm, gap: space.sm },
  item: { width: 72, alignItems: 'center' },
  ring: {
    width: RING,
    height: RING,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringGap: {
    width: GAP,
    height: GAP,
    borderRadius: radius.pill,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  allTile: {
    width: AVATAR,
    height: AVATAR,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatar: {
    width: AVATAR,
    height: AVATAR,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarIdle: { opacity: 0.72 },
  avatarText: { color: '#FFFFFF', fontFamily: font.semi, fontSize: 19 },
  badge: {
    position: 'absolute',
    top: 0,
    right: 0,
    minWidth: 21,
    height: 21,
    paddingHorizontal: 5,
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.bg,
  },
  badgeText: { color: '#FFFFFF', fontFamily: font.bold, fontSize: 11 },
  label: {
    marginTop: 6,
    maxWidth: 72,
    color: colors.textSoft,
    fontFamily: font.medium,
    fontSize: 11,
    textAlign: 'center',
  },
  labelActive: { color: colors.text, fontFamily: font.semi },
});
