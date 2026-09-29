import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { Group } from '../../services/serviceGroup';
import { getNightsKept } from '../../services/serviceGroup';
import { getActingGroupId, setActingGroup } from '../../services/serviceUser';
import { getFollowing } from '../../services/serviceFollow';
import { pickActing, splitVisible, switchList } from '../../lib/acting';
import ActingCard from './ActingCard';
import FollowShelf from './FollowShelf';
import SwitchRow from './SwitchRow';
import { colors, paper, radius, shadow, space, textSize, typo } from '../../theme';

type SquadSectionProps = {
  userId: string;
  groups: Group[];
  unread: Record<string, number>;
  // Bump to re-read the acting squad, its nights and who it follows.
  reloadKey: number;
  onOpenProfile: (group: Group) => void;
  onOpenFollows: (acting: Group) => void;
  onMake: () => void;
  onJoin: () => void;
};

// The squad you act as ("the punched one"), the others you can switch to,
// and the pareas the acting squad follows.
export default function SquadSection({
  userId,
  groups,
  unread,
  reloadKey,
  onOpenProfile,
  onOpenFollows,
  onMake,
  onJoin,
}: SquadSectionProps) {
  const [actingId, setActingId] = useState<string | null>(null);
  const [nights, setNights] = useState(0);
  const [switchError, setSwitchError] = useState<string | null>(null);
  const [switching, setSwitching] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [follows, setFollows] = useState<{ forId: string; list: Group[]; error: boolean } | null>(null);
  const switchSeq = useRef(0);

  useEffect(() => {
    const seq = switchSeq.current;
    let cancelled = false;

    getActingGroupId(userId)
      .catch(() => null)
      .then(function (stored) {
        if (!cancelled && switchSeq.current === seq) setActingId(stored);
      });

    return function cleanup() {
      cancelled = true;
    };
  }, [userId, reloadKey]);

  const acting = pickActing(groups, actingId);
  const others = switchList(groups, acting);
  const { shown, more } = expanded ? { shown: others, more: 0 } : splitVisible(others);
  const shelf = acting && follows?.forId === acting.id ? follows : null;

  useEffect(() => {
    if (!acting) return;

    let cancelled = false;
    setNights(0);
    getNightsKept(acting.id)
      .then(function (count) {
        if (!cancelled) setNights(count);
      })
      .catch(function () {});

    return function cleanup() {
      cancelled = true;
    };
  }, [acting?.id, reloadKey]);

  useEffect(() => {
    if (!acting) return;

    const forId = acting.id;
    let cancelled = false;
    getFollowing(forId)
      .then(function (list) {
        if (!cancelled) setFollows({ forId, list, error: false });
      })
      .catch(function () {
        if (!cancelled) setFollows({ forId, list: [], error: true });
      });

    return function cleanup() {
      cancelled = true;
    };
  }, [acting?.id, reloadKey]);

  async function switchTo(group: Group) {
    if (switching) return;

    switchSeq.current += 1;
    const previous = actingId;
    setActingId(group.id);
    setSwitchError(null);
    setSwitching(true);

    try {
      await setActingGroup(userId, group.id);
    } catch {
      setActingId(previous);
      setSwitchError('Could not switch. Try again.');
    } finally {
      setSwitching(false);
    }
  }

  const startButtons = (
    <View style={styles.startRow}>
      <Pressable
        onPress={onMake}
        accessibilityRole="button"
        accessibilityLabel="Make a squad"
        style={({ pressed }) => [styles.start, pressed && styles.pressed]}
      >
        <Ionicons name="add" size={18} color={colors.text} />
        <Text style={styles.startText}>Make a squad</Text>
      </Pressable>
      <Pressable
        onPress={onJoin}
        accessibilityRole="button"
        accessibilityLabel="Enter a code"
        style={({ pressed }) => [styles.start, pressed && styles.pressed]}
      >
        <Ionicons name="ticket-outline" size={18} color={colors.text} />
        <Text style={styles.startText}>Enter a code</Text>
      </Pressable>
    </View>
  );

  if (!acting) {
    return (
      <View style={styles.section}>
        <Text style={styles.quiet}>You are not in a parea yet.</Text>
        {startButtons}
      </View>
    );
  }

  return (
    <View style={styles.section}>
      <View style={styles.labels}>
        <Text style={styles.label}>ACTING AS</Text>
        <Text style={styles.label}>THE PUNCHED ONE</Text>
      </View>

      <ActingCard
        group={acting}
        nights={nights}
        onOpenProfile={() => onOpenProfile(acting)}
        onOpenFollows={() => onOpenFollows(acting)}
      />

      <View style={styles.info}>
        <Ionicons name="ticket-outline" size={16} color={colors.primary} />
        <Text style={styles.infoText}>
          Explore, Parea and the shelf on Home speak as{' '}
          <Text style={styles.infoStrong}>{acting.name}</Text>. Punch another one below to switch.
        </Text>
      </View>

      {others.length > 0 ? (
        <>
          <View style={styles.labels}>
            <Text style={styles.label}>SWITCH TO</Text>
            {more > 0 ? (
              <Pressable
                onPress={() => setExpanded(true)}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel={`Show ${more} more squads`}
              >
                <Text style={styles.label}>{more} MORE</Text>
              </Pressable>
            ) : null}
          </View>

          <View style={styles.list}>
            {shown.map((group, index) => (
              <SwitchRow
                key={group.id}
                group={group}
                unread={unread[group.id] ?? 0}
                first={index === 0}
                disabled={switching}
                onPress={() => switchTo(group)}
              />
            ))}
          </View>

          {switchError ? <Text style={styles.error}>{switchError}</Text> : null}
        </>
      ) : null}

      <View style={styles.labels}>
        <Text style={[styles.label, styles.labelShrink]} numberOfLines={1}>
          {acting.name.toUpperCase()} FOLLOWS
        </Text>
        {shelf && shelf.list.length > 0 ? (
          <Pressable
            onPress={() => onOpenFollows(acting)}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={`See all ${shelf.list.length} squads ${acting.name} follows`}
          >
            <Text style={[styles.label, styles.link]}>SEE ALL {shelf.list.length}</Text>
          </Pressable>
        ) : null}
      </View>

      {!shelf ? (
        <ActivityIndicator color={colors.primary} style={styles.spinner} />
      ) : shelf.error ? (
        <Text style={styles.error}>Could not load who you follow.</Text>
      ) : shelf.list.length === 0 ? (
        <Text style={styles.quiet}>Nobody yet. Follows belong to the squad, not to you.</Text>
      ) : (
        <FollowShelf groups={splitVisible(shelf.list, 4).shown} onOpen={onOpenProfile} />
      )}

      {startButtons}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: space.md },
  labels: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  label: { color: colors.textFaint, ...typo.mono, fontSize: textSize.caption, letterSpacing: 1.2 },
  labelShrink: { flexShrink: 1 },
  link: { color: colors.primary },
  info: {
    flexDirection: 'row',
    gap: space.sm,
    padding: space.md,
    borderRadius: radius.md,
    backgroundColor: paper.accentSoft,
  },
  infoText: { flex: 1, color: colors.text, ...typo.medium, fontSize: textSize.body, lineHeight: 19 },
  infoStrong: { color: colors.primary, ...typo.bold },
  list: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    overflow: 'hidden',
    ...shadow.card,
  },
  startRow: { flexDirection: 'row', gap: space.sm },
  start: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.xs,
    paddingVertical: 14,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  startText: { color: colors.text, ...typo.semi, fontSize: textSize.base },
  spinner: { alignSelf: 'flex-start', marginVertical: space.sm },
  error: { color: colors.danger, ...typo.medium, fontSize: 13 },
  quiet: { color: colors.textFaint, ...typo.medium, fontSize: 13 },
  pressed: { opacity: 0.6 },
});
