import { useEffect, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import type { Group } from '../../services/serviceGroup';
import { unreadLabel } from '../chat/unread';
import Monogram from '../general/Monogram';
import { ACTING_ACCENT } from '../group/SquadProfileHeader';
import { colors, radius, shadow, solidFor, space, textSize, typo } from '../../theme';

const AVATAR = 30;
// A tall profile card: every one the same shape, so the row lines up.
const RATIO = 4 / 5;

type SquadTileProps = {
  group: Group;
  acting?: boolean;
  unread?: number;
  // Open follow votes this member has not answered.
  votes?: number;
  onPress: () => void;
};

export default function SquadTile({ group, acting = false, unread = 0, votes = 0, onPress }: SquadTileProps) {
  const [bannerBroken, setBannerBroken] = useState(false);

  useEffect(() => {
    setBannerBroken(false);
  }, [group.bannerUrl]);

  const banner = group.bannerUrl && !bannerBroken ? group.bannerUrl : null;
  const badge = unreadLabel(unread);
  const members = `${group.memberCount} ${group.memberCount === 1 ? 'member' : 'members'}`;
  const waiting = votes > 0 ? `${votes} ${votes === 1 ? 'vote' : 'votes'} waiting` : null;
  const label = [group.name, members, acting ? 'acting squad' : null, badge ? `${badge} unread` : null, waiting]
    .filter(Boolean)
    .join(', ');

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [styles.tile, acting && styles.tileActing, pressed && styles.pressed]}
    >
      <View style={styles.banner}>
        {banner ? (
          <Image
            source={{ uri: banner }}
            style={StyleSheet.absoluteFill}
            resizeMode="cover"
            onError={function () {
              setBannerBroken(true);
            }}
          />
        ) : (
          // No banner yet: the squad's own colour, so no two empty cards look alike.
          <LinearGradient colors={[solidFor(group.name), colors.ink]} style={StyleSheet.absoluteFill} />
        )}

        {/* Keeps the name readable on any photo. */}
        <LinearGradient
          colors={['rgba(6,14,22,0)', 'rgba(6,14,22,0.72)']}
          style={styles.shade}
          pointerEvents="none"
        />

        {acting ? (
          <View style={styles.acting}>
            <View style={styles.actingDot} />
            <Text style={styles.actingText}>Acting</Text>
          </View>
        ) : null}

        {badge ? (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{badge}</Text>
          </View>
        ) : null}

        <View style={styles.body}>
          <Monogram name={group.name} size={AVATAR} uri={group.avatarUrl} ring={1.5} ringColor="#FFFFFF" />
          <View style={styles.text}>
            <Text style={styles.name} numberOfLines={2}>
              {group.name}
            </Text>
            <Text style={[styles.meta, waiting !== null && styles.metaWaiting]} numberOfLines={1}>
              {waiting ?? members}
            </Text>
          </View>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tile: {
    flex: 1,
    borderRadius: radius.lg,
    overflow: 'hidden',
    backgroundColor: colors.ink,
    ...shadow.card,
  },
  tileActing: { borderWidth: 2, borderColor: ACTING_ACCENT },
  pressed: { opacity: 0.85, transform: [{ scale: 0.98 }] },
  banner: { width: '100%', aspectRatio: RATIO, justifyContent: 'flex-end' },
  shade: { position: 'absolute', left: 0, right: 0, bottom: 0, height: '60%' },
  acting: {
    position: 'absolute',
    left: space.xs,
    top: space.xs,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    height: 22,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(6,14,22,0.6)',
  },
  actingDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: ACTING_ACCENT },
  actingText: { color: '#FFFFFF', ...typo.semi, fontSize: textSize.caption },
  badge: {
    position: 'absolute',
    right: space.xs,
    top: space.xs,
    minWidth: 22,
    height: 22,
    paddingHorizontal: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { color: '#FFFFFF', ...typo.bold, fontSize: textSize.caption },
  // Squad photo, name and size sit on the photo itself.
  body: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    padding: space.sm,
  },
  text: { flex: 1, minWidth: 0 },
  name: { color: '#FFFFFF', ...typo.bold, fontSize: textSize.base, letterSpacing: -0.2 },
  meta: { color: 'rgba(255,255,255,0.78)', ...typo.medium, fontSize: textSize.caption },
  metaWaiting: { color: '#FFFFFF', ...typo.bold },
});
