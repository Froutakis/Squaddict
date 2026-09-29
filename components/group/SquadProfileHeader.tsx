import { useEffect, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import type { Group } from '../../services/serviceGroup';
import { sinceYear } from '../../lib/acting';
import Monogram from '../general/Monogram';
import ImageViewer from '../general/ImageViewer';
import { colors, radius, space, textSize, typo } from '../../theme';

const BANNER = 150;
const AVATAR = 92;
const RING = 4;
// The one colour that marks the squad you act as: the red of the logo.
export const ACTING_ACCENT = colors.accent;

export type ProfileStat = { value: number | null; label: string };

type SquadProfileHeaderProps = {
  group: Group;
  stats: ProfileStat[];
  acting: boolean;
};

// iOS-style profile card: banner, the photo centred on its bottom edge, the
// name centred under it, and the numbers in one inset group below.
export default function SquadProfileHeader({ group, stats, acting }: SquadProfileHeaderProps) {
  const [bannerBroken, setBannerBroken] = useState(false);
  const [viewing, setViewing] = useState<'banner' | 'avatar' | null>(null);

  useEffect(() => {
    setBannerBroken(false);
  }, [group.bannerUrl]);

  const banner = group.bannerUrl && !bannerBroken ? group.bannerUrl : null;
  const year = sinceYear(group.createdAt);
  const handleLine = [`@${group.handle}`, year ? `since ${year}` : null].filter(Boolean).join(' · ');

  return (
    <View>
      <Pressable
        onPress={() => (banner ? setViewing('banner') : undefined)}
        disabled={!banner}
        accessibilityRole={banner ? 'imagebutton' : undefined}
        accessibilityLabel={`${group.name} banner`}
        accessibilityHint={banner ? 'Opens the full image' : undefined}
        style={({ pressed }) => [styles.banner, pressed && styles.pressed]}
      >
        {banner ? (
          <Image
            source={{ uri: banner }}
            style={StyleSheet.absoluteFill}
            resizeMode="cover"
            onError={() => setBannerBroken(true)}
          />
        ) : (
          <LinearGradient colors={['#1B2A44', '#3A2E3F']} style={StyleSheet.absoluteFill} />
        )}
      </Pressable>

      <View style={styles.avatarRow}>
        <Pressable
          onPress={() => (group.avatarUrl ? setViewing('avatar') : undefined)}
          disabled={!group.avatarUrl}
          accessibilityRole={group.avatarUrl ? 'imagebutton' : undefined}
          accessibilityLabel={`${group.name} photo`}
          style={({ pressed }) => pressed && styles.pressed}
        >
          <Monogram name={group.name} size={AVATAR} uri={group.avatarUrl} ring={RING} ringColor={colors.bg} />
        </Pressable>
      </View>

      <View style={styles.identity}>
        <Text style={styles.name} numberOfLines={2}>
          {group.name}
        </Text>
        <Text style={styles.handle} numberOfLines={1}>
          {handleLine}
        </Text>
        {acting ? (
          <View style={styles.acting} accessibilityLabel="The squad you act as">
            <View style={styles.actingDot} />
            <Text style={styles.actingText}>Acting as this squad</Text>
          </View>
        ) : null}
        {group.bio ? <Text style={styles.bio}>{group.bio}</Text> : null}
      </View>

      <View style={styles.stats}>
        {stats.map((stat, index) => (
          <View
            key={stat.label}
            style={[styles.stat, index > 0 && styles.statDivider]}
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

      <ImageViewer
        uri={viewing === 'banner' ? banner : viewing === 'avatar' ? group.avatarUrl : null}
        label={viewing === 'banner' ? `${group.name} banner` : `${group.name} photo`}
        onClose={() => setViewing(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    height: BANNER,
    borderRadius: radius.xl,
    overflow: 'hidden',
    backgroundColor: colors.surfaceAlt,
  },
  pressed: { opacity: 0.85 },
  // The photo sits centred on the banner's bottom edge.
  avatarRow: { alignItems: 'center', marginTop: -(AVATAR / 2 + RING) },
  identity: { alignItems: 'center', gap: 3, marginTop: space.sm, paddingHorizontal: space.md },
  name: { color: colors.text, ...typo.display, fontSize: textSize.hero, letterSpacing: -0.5, textAlign: 'center' },
  handle: { color: colors.textSoft, ...typo.medium, fontSize: textSize.body, textAlign: 'center' },
  acting: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: space.xxs,
    paddingHorizontal: 10,
    height: 24,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
  },
  actingDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: ACTING_ACCENT },
  actingText: { color: colors.text, ...typo.semi, fontSize: textSize.small },
  bio: {
    marginTop: space.xs,
    color: colors.text,
    ...typo.regular,
    fontSize: textSize.base,
    lineHeight: 21,
    textAlign: 'center',
  },
  // One inset group, like an iOS settings row, with hairlines between the numbers.
  stats: {
    flexDirection: 'row',
    marginTop: space.md,
    paddingVertical: space.sm,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
  },
  stat: { flex: 1, alignItems: 'center', gap: 1 },
  statDivider: { borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: colors.border },
  statValue: { color: colors.text, ...typo.title, fontSize: textSize.lead + 2, letterSpacing: -0.3 },
  statLabel: { color: colors.textSoft, ...typo.medium, fontSize: textSize.caption },
});
