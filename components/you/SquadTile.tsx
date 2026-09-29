import { useEffect, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import type { Group } from '../../services/serviceGroup';
import { unreadLabel } from '../chat/unread';
import Monogram from '../general/Monogram';
import { colors, radius, shadow, space, sun, textSize, typo } from '../../theme';

const BANNER = 56;
const AVATAR = 36;

type SquadTileProps = {
  group: Group;
  acting?: boolean;
  unread?: number;
  onPress: () => void;
};

export default function SquadTile({ group, acting = false, unread = 0, onPress }: SquadTileProps) {
  const [bannerBroken, setBannerBroken] = useState(false);

  useEffect(() => {
    setBannerBroken(false);
  }, [group.bannerUrl]);

  const banner = group.bannerUrl && !bannerBroken ? group.bannerUrl : null;
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
        <Monogram name={group.name} size={AVATAR} ring={3} uri={group.avatarUrl} style={styles.avatar} />
        <Text style={styles.name} numberOfLines={1}>
          {group.name}
        </Text>
        <Text style={styles.meta} numberOfLines={1}>
          {members}
        </Text>
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
  banner: { height: BANNER, backgroundColor: '#1B2A44' },
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
  body: { paddingHorizontal: space.sm, paddingBottom: space.sm, gap: 1 },
  avatar: { marginTop: -AVATAR / 2, marginBottom: space.xs },
  name: { color: colors.text, ...typo.bold, fontSize: textSize.body },
  meta: { color: colors.textFaint, ...typo.mono, fontSize: textSize.caption },
});
