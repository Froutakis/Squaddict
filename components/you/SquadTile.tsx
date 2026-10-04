import { useEffect, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import type { Group } from '../../services/serviceGroup';
import { unreadLabel } from '../chat/unread';
import Monogram from '../general/Monogram';
import { colors, radius, shadow, space, sun, textSize, typo } from '../../theme';

const AVATAR = 24;
// Every card is the same shape; the banner fills it and is cropped to fit.
const RATIO = 5 / 4;

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

  const banner = group.bannerUrl && !bannerBroken ? group.bannerUrl : null;

  useEffect(() => {
    setBannerBroken(false);
  }, [group.bannerUrl]);
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
          <LinearGradient colors={['#1B2A44', '#3A2E3F']} style={StyleSheet.absoluteFill} />
        )}

        <LinearGradient colors={['rgba(6,14,22,0)', 'rgba(6,14,22,0.8)']} style={styles.scrim} />

        {acting ? (
          <View style={styles.acting}>
            <View style={styles.actingDot} />
            <Text style={styles.actingText}>ACTING</Text>
          </View>
        ) : null}

        {badge ? (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{badge}</Text>
          </View>
        ) : null}

        <View style={styles.body}>
          <Monogram name={group.name} size={AVATAR} uri={group.avatarUrl} ring={1.5} />
          <View style={styles.text}>
            <Text style={styles.name} numberOfLines={1}>
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

const textShadow = {
  textShadowColor: 'rgba(0,0,0,0.45)',
  textShadowOffset: { width: 0, height: 1 },
  textShadowRadius: 3,
};

const styles = StyleSheet.create({
  tile: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    overflow: 'hidden',
    ...shadow.card,
  },
  tileActing: { borderWidth: 2, borderColor: sun },
  pressed: { opacity: 0.75, transform: [{ scale: 0.98 }] },
  banner: { width: '100%', aspectRatio: RATIO, backgroundColor: '#1B2A44' },
  // Darkens the bottom of the photo so the white name always reads.
  scrim: { position: 'absolute', left: 0, right: 0, bottom: 0, height: '60%' },
  acting: {
    position: 'absolute',
    left: space.xs,
    top: space.xs,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    height: 20,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(6,14,22,0.6)',
  },
  actingDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: sun },
  actingText: { color: '#FFFFFF', ...typo.mono, fontSize: textSize.micro, letterSpacing: 1 },
  badge: {
    position: 'absolute',
    right: space.xs,
    top: space.xs,
    minWidth: 20,
    height: 20,
    paddingHorizontal: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { color: '#FFFFFF', ...typo.bold, fontSize: textSize.caption },
  // Over the bottom of the photo: small squad photo, name and size.
  body: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    paddingHorizontal: space.sm,
    paddingVertical: space.xs,
  },
  text: { flex: 1, minWidth: 0 },
  name: { color: '#FFFFFF', ...typo.bold, fontSize: textSize.body, ...textShadow },
  meta: { color: 'rgba(255,255,255,0.8)', ...typo.mono, fontSize: textSize.caption, ...textShadow },
  metaWaiting: { color: sun },
});
