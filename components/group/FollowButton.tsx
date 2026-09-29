import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { Group } from '../../services/serviceGroup';
import { getActingSquad } from '../../services/serviceUser';
import { followSquad, isFollowing, unfollowSquad } from '../../services/serviceFollow';
import { followButtonLabel } from '../../lib/follows';
import Monogram from '../general/Monogram';
import { colors, paper, radius, space, textSize, typo } from '../../theme';

type FollowButtonProps = {
  group: Group;
  userId: string;
};

export default function FollowButton({ group, userId }: FollowButtonProps) {
  const [acting, setActing] = useState<Group | null>(null);
  const [following, setFollowing] = useState<boolean | null>(null);
  const [followsBack, setFollowsBack] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setActing(null);
    setFollowing(null);
    setFollowsBack(false);
    setError(null);

    async function load() {
      try {
        const mine = await getActingSquad(userId);
        if (cancelled || !mine || mine.id === group.id) return;

        const [out, back] = await Promise.all([
          isFollowing(mine.id, group.id),
          isFollowing(group.id, mine.id).catch(() => false),
        ]);
        if (cancelled) return;

        setActing(mine);
        setFollowing(out);
        setFollowsBack(back);
      } catch {
        // No button when the acting squad or follow state cannot be read.
      }
    }

    load();

    return function cleanup() {
      cancelled = true;
    };
  }, [group.id, userId]);

  async function toggle() {
    if (!acting || following === null || saving) return;

    const next = !following;
    setFollowing(next);
    setSaving(true);
    setError(null);

    try {
      if (next) await followSquad(acting.id, group.id);
      else await unfollowSquad(acting.id, group.id);
    } catch {
      setFollowing(!next);
      setError('Could not update. Try again.');
    } finally {
      setSaving(false);
    }
  }

  if (!acting || following === null) return null;

  const label = followButtonLabel(following, acting.name);

  return (
    <View style={styles.wrap}>
      <Pressable
        onPress={toggle}
        disabled={saving}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ checked: following, disabled: saving }}
        style={({ pressed }) => [
          styles.button,
          following ? styles.outlined : styles.solid,
          (pressed || saving) && styles.pressed,
        ]}
      >
        <Ionicons name={following ? 'checkmark' : 'add'} size={16} color={following ? colors.text : '#FFFFFF'} />
        <Text style={following ? styles.outlinedText : styles.solidText} numberOfLines={1}>
          {label}
        </Text>
      </Pressable>

      {followsBack ? (
        <View style={styles.back}>
          <View style={styles.duo}>
            <Monogram name={group.name} size={24} uri={group.avatarUrl} ring={2} ringColor={paper.accentSoft} />
            <Monogram
              name={acting.name}
              size={24}
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
  wrap: { gap: space.sm },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.xs,
    paddingVertical: 12,
    paddingHorizontal: space.md,
    borderRadius: radius.md,
  },
  solid: { backgroundColor: colors.text },
  outlined: { borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.surface },
  solidText: { color: '#FFFFFF', ...typo.semi, fontSize: textSize.base },
  outlinedText: { color: colors.text, ...typo.semi, fontSize: textSize.base },
  pressed: { opacity: 0.6 },
  back: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    padding: space.sm,
    borderRadius: radius.md,
    backgroundColor: paper.accentSoft,
  },
  duo: { flexDirection: 'row' },
  duoSecond: { marginLeft: -8 },
  backText: { color: colors.primary, ...typo.semi, fontSize: textSize.small },
  error: { color: colors.danger, ...typo.medium, fontSize: textSize.body },
});
