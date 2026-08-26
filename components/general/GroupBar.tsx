import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { Group } from '../../services/serviceGroup';
import { colors, font, gradientFor, radius, space } from '../../theme';
import { initialsFor } from './GradientAvatar';

type GroupBarProps = {
  groups: Group[];
  activeId: string | null;
  onSelect: (id: string | null) => void;
  unread?: Record<string, number>;
  /** Το κυκλάκι "All" — κρύψε το εκεί που δεν έχει νόημα (π.χ. στο chat). */
  showAll?: boolean;
  /** Πιο μικρά avatars και λιγότερο ύψος — για τη μπάρα μέσα στο chat. */
  compact?: boolean;
};

/** Διαστάσεις ανά μέγεθος: κανονικό για το Home, μικρό για το chat. */
function dimsFor(compact: boolean) {
  const avatar = compact ? 42 : 54;
  const gap = avatar + 6;
  const ring = gap + 5;
  return {
    avatar,
    gap,
    ring,
    item: compact ? 60 : 72,
    label: compact ? 10 : 11,
    avatarText: compact ? 15 : 19,
    padV: compact ? space.xs : space.sm,
  };
}

type StoryRingProps = {
  colors: readonly [string, string];
  active: boolean;
  size: number;
  children: React.ReactNode;
};

/** Δαχτυλίδι σε στιλ story: χρωματιστό στην ενεργή παρέα, σβηστό στις υπόλοιπες. */
function StoryRing({ colors: ring, active, size, children }: StoryRingProps) {
  return (
    <LinearGradient
      colors={active ? [ring[0], ring[1]] : [colors.border, colors.border]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.ring, { width: size, height: size }]}
    >
      {/* Το εσωτερικό κενό είναι 5px μικρότερο — έτσι φαίνεται το δαχτυλίδι. */}
      <View style={[styles.ringGap, { width: size - 5, height: size - 5 }]}>{children}</View>
    </LinearGradient>
  );
}

export default function GroupBar({
  groups,
  activeId,
  onSelect,
  unread = {},
  showAll = true,
  compact = false,
}: GroupBarProps) {
  const d = dimsFor(compact);

  // Τα κυκλικά μεγέθη εξαρτώνται από το compact, γι' αυτό μπαίνουν inline.
  const ringSize = { width: d.ring, height: d.ring };
  const gapSize = { width: d.gap, height: d.gap };
  const avatarSize = { width: d.avatar, height: d.avatar };

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={[styles.row, { paddingVertical: d.padV }]}
    >
      {showAll ? (
        <Pressable
          style={[styles.item, { width: d.item }]}
          onPress={() => onSelect(null)}
          accessibilityRole="button"
          accessibilityState={{ selected: activeId === null }}
          accessibilityLabel="All squads"
        >
          <StoryRing colors={[colors.primary, colors.accent]} active={activeId === null} size={d.ring}>
            <View style={[styles.allTile, avatarSize]}>
              <Ionicons name="people-outline" size={Math.round(d.avatar * 0.4)} color={colors.bg} />
            </View>
          </StoryRing>
          <Text
            style={[styles.label, { fontSize: d.label }, activeId === null && styles.labelActive]}
            numberOfLines={1}
          >
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
            style={[styles.item, { width: d.item }]}
            onPress={() => onSelect(group.id)}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            accessibilityLabel={group.name}
          >
            <View>
              <StoryRing colors={gradientFor(group.name)} active={active} size={d.ring}>
                <LinearGradient
                  colors={gradientFor(group.name)}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={[styles.avatar, avatarSize, !active && styles.avatarIdle]}
                >
                  <Text style={[styles.avatarText, { fontSize: d.avatarText }]}>
                    {initialsFor(group.name)}
                  </Text>
                </LinearGradient>
              </StoryRing>

              {count > 0 ? (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{count > 9 ? '9+' : count}</Text>
                </View>
              ) : null}
            </View>

            <Text
              style={[styles.label, { fontSize: d.label }, active && styles.labelActive]}
              numberOfLines={1}
            >
              {group.name}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { paddingHorizontal: space.md, gap: space.sm },
  item: { alignItems: 'center' },
  ring: {
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringGap: {
    borderRadius: radius.pill,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  allTile: {
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatar: {
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarIdle: { opacity: 0.72 },
  avatarText: { color: '#FFFFFF', fontFamily: font.semi },
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
