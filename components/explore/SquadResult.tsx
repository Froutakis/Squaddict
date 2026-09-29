import { useEffect, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import type { Group } from '../../services/serviceGroup';
import Monogram from '../general/Monogram';
import { colors, radius, space, textSize, typo } from '../../theme';

type SquadResultProps = {
  group: Group;
  first: boolean;
  onPress: () => void;
};

export default function SquadResult({ group, first, onPress }: SquadResultProps) {
  const [bannerBroken, setBannerBroken] = useState(false);

  useEffect(() => {
    setBannerBroken(false);
  }, [group.bannerUrl]);

  const banner = group.bannerUrl && !bannerBroken ? group.bannerUrl : null;
  const members = `${group.memberCount} ${group.memberCount === 1 ? 'member' : 'members'}`;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Open ${group.name}, @${group.handle}, ${members}`}
      style={({ pressed }) => [styles.row, !first && styles.divider, pressed && styles.pressed]}
    >
      <View style={styles.thumb}>
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
        <Monogram name={group.name} size={26} ring={2} uri={group.avatarUrl} style={styles.avatar} />
      </View>

      <View style={styles.text}>
        <Text style={styles.name} numberOfLines={1}>
          {group.name}
        </Text>
        <Text style={styles.meta} numberOfLines={1}>
          @{group.handle} · {members}
        </Text>
      </View>

      <Ionicons name="chevron-forward" size={18} color={colors.textFaint} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingHorizontal: space.md,
    paddingVertical: 11,
  },
  divider: { borderTopWidth: 1, borderTopColor: colors.border },
  pressed: { opacity: 0.6 },
  thumb: { width: 46, height: 46, borderRadius: radius.md, overflow: 'hidden', backgroundColor: '#1B2A44' },
  avatar: { position: 'absolute', left: 3, bottom: 3 },
  text: { flex: 1 },
  name: { color: colors.text, ...typo.bold, fontSize: textSize.base },
  meta: { color: colors.textFaint, ...typo.mono, fontSize: textSize.small },
});
