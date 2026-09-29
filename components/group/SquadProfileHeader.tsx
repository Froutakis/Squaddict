import { useEffect, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import type { Group } from '../../services/serviceGroup';
import { sinceYear } from '../../lib/acting';
import Monogram from '../general/Monogram';
import ImageViewer from '../general/ImageViewer';
import { colors, radius, space, sun, textSize, typo } from '../../theme';

const AVATAR = 84;
const RING = 3;
// The acting squad wears a story-style ring, like an Instagram profile with something new.
const ACTING_RING = [sun, '#F0663A', colors.primary] as const;

export type ProfileStat = { value: number | null; label: string };

type SquadProfileHeaderProps = {
  group: Group;
  stats: ProfileStat[];
  acting: boolean;
};

// Instagram-style profile top: the squad's photo with its numbers beside it,
// then name, handle and bio. The banner sits above as one clean, rounded photo.
export default function SquadProfileHeader({ group, stats, acting }: SquadProfileHeaderProps) {
  const [bannerBroken, setBannerBroken] = useState(false);
  const [viewing, setViewing] = useState<'banner' | 'avatar' | null>(null);

  useEffect(() => {
    setBannerBroken(false);
  }, [group.bannerUrl]);

  const banner = group.bannerUrl && !bannerBroken ? group.bannerUrl : null;
  const year = sinceYear(group.createdAt);
  const handleLine = [`@${group.handle}`, year ? `since ${year}` : null].filter(Boolean).join(' · ');

  const avatar = (
    <Monogram name={group.name} size={AVATAR} uri={group.avatarUrl} ring={RING} ringColor={colors.bg} />
  );

  return (
    <View style={styles.wrap}>
      {banner ? (
        <Pressable
          onPress={() => setViewing('banner')}
          accessibilityRole="imagebutton"
          accessibilityLabel={`${group.name} banner`}
          accessibilityHint="Opens the full image"
          style={({ pressed }) => [styles.banner, pressed && styles.pressed]}
        >
          <Image
            source={{ uri: banner }}
            style={StyleSheet.absoluteFill}
            resizeMode="cover"
            onError={() => setBannerBroken(true)}
          />
        </Pressable>
      ) : null}

      <View style={styles.row}>
        <Pressable
          onPress={() => (group.avatarUrl ? setViewing('avatar') : undefined)}
          disabled={!group.avatarUrl}
          accessibilityRole={group.avatarUrl ? 'imagebutton' : undefined}
          accessibilityLabel={`${group.name} photo${acting ? ', acting squad' : ''}`}
          style={({ pressed }) => pressed && styles.pressed}
        >
          {acting ? (
            <LinearGradient colors={ACTING_RING} start={{ x: 0, y: 1 }} end={{ x: 1, y: 0 }} style={styles.ring}>
              {avatar}
            </LinearGradient>
          ) : (
            <View style={[styles.ring, styles.ringPlain]}>{avatar}</View>
          )}
        </Pressable>

        <View style={styles.stats}>
          {stats.map((stat) => (
            <View
              key={stat.label}
              style={styles.stat}
              accessible
              accessibilityLabel={`${stat.value ?? 'unknown'} ${stat.label}`}
            >
              <Text style={styles.statValue}>{stat.value === null ? '–' : stat.value}</Text>
              <Text style={styles.statLabel} numberOfLines={1}>
                {stat.label}
              </Text>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.identity}>
        <Text style={styles.name} numberOfLines={2}>
          {group.name}
        </Text>
        <Text style={styles.handle} numberOfLines={1}>
          {handleLine}
        </Text>
        {group.bio ? <Text style={styles.bio}>{group.bio}</Text> : null}
      </View>

      <ImageViewer
        uri={viewing === 'banner' ? banner : viewing === 'avatar' ? group.avatarUrl : null}
        label={viewing === 'banner' ? `${group.name} banner` : `${group.name} photo`}
        onClose={() => setViewing(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.sm },
  banner: {
    height: 150,
    borderRadius: radius.lg,
    overflow: 'hidden',
    backgroundColor: colors.surfaceAlt,
  },
  pressed: { opacity: 0.8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, marginTop: space.xs },
  ring: { padding: 3, borderRadius: radius.pill },
  ringPlain: { backgroundColor: colors.border },
  stats: { flex: 1, flexDirection: 'row', justifyContent: 'space-between' },
  stat: { alignItems: 'center', minWidth: 52 },
  statValue: { color: colors.text, ...typo.bold, fontSize: textSize.lead + 2, letterSpacing: -0.3 },
  statLabel: { color: colors.textSoft, ...typo.medium, fontSize: textSize.small },
  identity: { gap: 1 },
  name: { color: colors.text, ...typo.bold, fontSize: textSize.lead },
  handle: { color: colors.textFaint, ...typo.medium, fontSize: textSize.body },
  bio: { marginTop: space.xxs, color: colors.text, ...typo.regular, fontSize: textSize.body, lineHeight: 19 },
});
