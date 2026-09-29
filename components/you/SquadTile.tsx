import { useEffect, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import type { Group } from '../../services/serviceGroup';
import Monogram from '../general/Monogram';
import { colors, radius, shadow, space, textSize, typo } from '../../theme';

const BANNER = 76;
const AVATAR = 36;

type SquadTileProps = {
  group: Group;
  onPress: () => void;
};

export default function SquadTile({ group, onPress }: SquadTileProps) {
  const [bannerBroken, setBannerBroken] = useState(false);

  useEffect(() => {
    setBannerBroken(false);
  }, [group.bannerUrl]);

  const banner = group.bannerUrl && !bannerBroken ? group.bannerUrl : null;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Open ${group.name}, @${group.handle}`}
      style={({ pressed }) => [styles.tile, pressed && styles.pressed]}
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
      </View>

      <View style={styles.body}>
        <Monogram name={group.name} size={AVATAR} ring={3} uri={group.avatarUrl} style={styles.avatar} />
        <Text style={styles.name} numberOfLines={1}>
          {group.name}
        </Text>
        <Text style={styles.handle} numberOfLines={1}>
          @{group.handle}
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
  pressed: { opacity: 0.7 },
  banner: { height: BANNER, backgroundColor: '#1B2A44' },
  body: { paddingHorizontal: space.sm, paddingBottom: space.sm, gap: 2 },
  avatar: { marginTop: -AVATAR / 2, marginBottom: space.xs },
  name: { color: colors.text, ...typo.bold, fontSize: textSize.base },
  handle: { color: colors.textFaint, ...typo.mono, fontSize: textSize.caption },
});
