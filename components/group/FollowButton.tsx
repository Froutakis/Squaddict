import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { Group } from '../../services/serviceGroup';
import { getActingSquad } from '../../services/serviceUser';
import { isFollowing } from '../../services/serviceFollow';
import { castVote, getOpenSquadVote, type SquadVote } from '../../services/serviceVotes';
import { followButtonLabel } from '../../lib/follows';
import { voteButtonLabel } from '../../lib/squadVote';
import Monogram from '../general/Monogram';
import { colors, paper, radius, space, textSize, typo } from '../../theme';

type FollowButtonProps = {
  group: Group;
  userId: string;
  // Full width, for a row of its own under the profile buttons.
  block?: boolean;
  // Called when a vote moves or settles.
  onChanged?: () => void;
  // Opens the acting squad's Votes page: a follow vote only starts there.
  onOpenVotes: (groupId?: string) => void;
};

// Following is the acting squad's call, not one member's: the button shows
// whether it follows and the vote while one is open. A tap says yes to that
// vote, or takes you to Votes to start one.
export default function FollowButton({ group, userId, block = false, onChanged, onOpenVotes }: FollowButtonProps) {
  const [acting, setActing] = useState<Group | null>(null);
  const [following, setFollowing] = useState<boolean | null>(null);
  const [vote, setVote] = useState<SquadVote | null>(null);
  const [followsBack, setFollowsBack] = useState(false);
  const [saving, setSaving] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const readState = useCallback(
    async function readState(mine: Group) {
      const [out, open] = await Promise.all([
        isFollowing(mine.id, group.id),
        getOpenSquadVote(mine.id, group.id, userId).catch(() => null),
      ]);
      return { out, open };
    },
    [group.id, userId],
  );

  useEffect(() => {
    let cancelled = false;
    setActing(null);
    setFollowing(null);
    setVote(null);
    setFollowsBack(false);
    setNote(null);
    setError(null);

    async function load() {
      try {
        const mine = await getActingSquad(userId);
        if (cancelled || !mine || mine.id === group.id) return;

        const [state, back] = await Promise.all([
          readState(mine),
          isFollowing(group.id, mine.id).catch(() => false),
        ]);
        if (cancelled) return;

        setActing(mine);
        setFollowing(state.out);
        setVote(state.open);
        setFollowsBack(back);
      } catch {
        // No button when the acting squad or follow state cannot be read.
      }
    }

    load();

    return function cleanup() {
      cancelled = true;
    };
  }, [group.id, userId, readState]);

  async function press() {
    if (!acting || following === null || saving) return;
    if (!vote || vote.myVote === true) {
      onOpenVotes(acting.id);
      return;
    }

    setSaving(true);
    setNote(null);
    setError(null);

    try {
      const status = await castVote(vote.id, true);

      const state = await readState(acting);
      setFollowing(state.out);
      setVote(state.open);

      if (status === 'rejected') setNote(`${acting.name} voted this down.`);
      onChanged?.();
    } catch {
      setError('Could not update. Try again.');
    } finally {
      setSaving(false);
    }
  }

  if (!acting || following === null) return null;

  const waiting = vote !== null && vote.myVote === true;
  const label = vote
    ? voteButtonLabel(vote.kind, vote.myVote, vote.yes, acting.memberCount)
    : followButtonLabel(following, acting.name);
  const quiet = vote ? waiting : following;
  const icon = vote ? (waiting ? 'time-outline' : 'thumbs-up-outline') : following ? 'checkmark' : 'add';

  return (
    <View style={[styles.wrap, block && styles.wrapBlock]}>
      <Pressable
        onPress={press}
        disabled={saving}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityHint={vote && !waiting ? undefined : `Opens Votes in ${acting.name}`}
        accessibilityState={{ disabled: saving }}
        style={({ pressed }) => [
          styles.button,
          block && styles.buttonBlock,
          quiet ? styles.outlined : styles.solid,
          block && !quiet && styles.solidBlock,
          (pressed || saving) && styles.pressed,
        ]}
      >
        <Ionicons name={icon} size={15} color={quiet ? colors.text : '#FFFFFF'} />
        <Text style={[styles.label, quiet ? styles.outlinedText : styles.solidText]} numberOfLines={1}>
          {label}
        </Text>
      </Pressable>

      {vote ? (
        <Text style={styles.note}>
          {acting.name} {vote.kind === 'follow' ? 'follows' : 'unfollows'} once most members say yes.
        </Text>
      ) : null}

      {note ? (
        <Text style={styles.note} accessibilityLiveRegion="polite">
          {note}
        </Text>
      ) : null}

      {followsBack ? (
        <View style={styles.back}>
          <View style={styles.duo}>
            <Monogram name={group.name} size={18} uri={group.avatarUrl} ring={2} ringColor={paper.accentSoft} />
            <Monogram
              name={acting.name}
              size={18}
              uri={acting.avatarUrl}
              ring={2}
              ringColor={paper.accentSoft}
              style={styles.duoSecond}
            />
          </View>
          <Text style={styles.backText}>They follow you back</Text>
        </View>
      ) : null}

      {error ? (
        <Text style={styles.error} accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'flex-end', gap: space.xxs, maxWidth: '100%' },
  wrapBlock: { alignItems: 'center' },
  buttonBlock: { alignSelf: 'stretch', justifyContent: 'center', height: 40 },
  solidBlock: { backgroundColor: colors.primary },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xxs,
    maxWidth: '100%',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: radius.pill,
  },
  solid: { backgroundColor: colors.text },
  outlined: { borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.surface },
  label: { flexShrink: 1, ...typo.semi, fontSize: textSize.body },
  solidText: { color: '#FFFFFF' },
  outlinedText: { color: colors.text },
  pressed: { opacity: 0.6 },
  note: { color: colors.textSoft, ...typo.medium, fontSize: textSize.small, textAlign: 'right' },
  back: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    paddingVertical: 3,
    paddingHorizontal: space.xs,
    borderRadius: radius.pill,
    backgroundColor: paper.accentSoft,
  },
  duo: { flexDirection: 'row' },
  duoSecond: { marginLeft: -6 },
  backText: { color: colors.primary, ...typo.semi, fontSize: textSize.caption },
  error: { color: colors.danger, ...typo.medium, fontSize: textSize.small, textAlign: 'right' },
});
