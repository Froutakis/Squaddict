import { useEffect, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import type { Group } from '../../services/serviceGroup';
import { colors, paper, radius, space, textSize, typo } from '../../theme';

type FollowRowProps = {
  group: Group;
  mutual: boolean;
  first: boolean;
  onPress: () => void;
};

export default function FollowRow({ group, mutual, first, onPress }: FollowRowProps) {
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
      accessibilityLabel={`Open ${group.name}${mutual ? ', follows you back' : ''}`}
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
      </View>

      <View style={styles.text}>
        <Text style={styles.name} numberOfLines={1}>
          {group.name}
        </Text>
        <Text style={styles.meta} numberOfLines={1}>
          @{group.handle} · {members}
        </Text>
      </View>

      <View style={[styles.chip, mutual && styles.chipMutual]}>
        <Text style={[styles.chipText, mutual && styles.chipTextMutual]}>{mutual ? 'Mutual' : 'Following'}</Text>
      </View>
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
  text: { flex: 1 },
  name: { color: colors.text, ...typo.bold, fontSize: textSize.base },
  meta: { color: colors.textFaint, ...typo.mono, fontSize: textSize.small },
  chip: {
    paddingHorizontal: space.sm,
    paddingVertical: space.xxs,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  chipMutual: { borderColor: paper.accentSoft, backgroundColor: paper.accentSoft },
  chipText: { color: colors.textSoft, ...typo.semi, fontSize: textSize.caption },
  chipTextMutual: { color: colors.primary },
});
