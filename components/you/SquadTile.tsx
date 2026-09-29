import { useEffect, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import type { Group } from '../../services/serviceGroup';
import { unreadLabel } from '../chat/unread';
import Monogram from '../general/Monogram';
import { colors, radius, shadow, space, sun, textSize, typo } from '../../theme';

const AVATAR = 24;
// Cards take the banner's own shape so the whole photo shows, within reason.
const DEFAULT_RATIO = 16 / 10;
const MIN_RATIO = 1;
const MAX_RATIO = 2.2;

type SquadTileProps = {
  group: Group;
  acting?: boolean;
  unread?: number;
  onPress: () => void;
};

export default function SquadTile({ group, acting = false, unread = 0, onPress }: SquadTileProps) {
  const [bannerBroken, setBannerBroken] = useState(false);
  const [ratio, setRatio] = useState(DEFAULT_RATIO);

  const banner = group.bannerUrl && !bannerBroken ? group.bannerUrl : null;

  useEffect(() => {
    setBannerBroken(false);
    setRatio(DEFAULT_RATIO);
    if (!group.bannerUrl) return;

    let cancelled = false;
    Image.getSize(
      group.bannerUrl,
      function (width, height) {
        if (cancelled || !width || !height) return;
        setRatio(Math.min(MAX_RATIO, Math.max(MIN_RATIO, width / height)));
      },
      function () {},
    );
    return function cleanup() {
      cancelled = true;
    };
  }, [group.bannerUrl]);
  const badge = unreadLabel(unread);
  const members = `${group.memberCount} ${group.memberCount === 1 ? 'member' : 'members'}`;
  const label = [group.name, members, acting ? 'acting squad' : null, badge ? `${badge} unread` : null]
    .filter(Boolean)
    .join(', ');

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [styles.tile, acting && styles.tileActing, pressed && styles.pressed]}
    >
      <View style={[styles.banner, { aspectRatio: ratio }]}>
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
      </View>

      <View style={styles.body}>
        <Monogram name={group.name} size={AVATAR} uri={group.avatarUrl} />
        <View style={styles.text}>
          <Text style={styles.name} numberOfLines={1}>
            {group.name}
          </Text>
          <Text style={styles.meta} numberOfLines={1}>
            {members}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

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
  banner: { width: '100%', backgroundColor: '#1B2A44' },
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
  // The white strip under the photo: small squad photo, name and size.
  body: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    paddingHorizontal: space.sm,
    paddingVertical: space.xs,
  },
  text: { flex: 1, minWidth: 0 },
  name: { color: colors.text, ...typo.bold, fontSize: textSize.body },
  meta: { color: colors.textFaint, ...typo.mono, fontSize: textSize.caption },
});
