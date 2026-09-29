import { useEffect, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import type { Group } from '../../services/serviceGroup';
import { sinceYear } from '../../lib/acting';
import Monogram from '../general/Monogram';
import ImageViewer from '../general/ImageViewer';
import { colors, radius, space, textSize, typo } from '../../theme';

const BANNER = 150;
const AVATAR = 84;
const RING = 4;
// The one colour that marks the squad you act as: the red of the logo.
export const ACTING_ACCENT = colors.accent;

export type ProfileStat = { value: number | null; label: string };

type SquadProfileHeaderProps = {
  group: Group;
  stats: ProfileStat[];
  acting: boolean;
};

// Banner with the squad's photo sitting on its bottom edge, cut out by a ring in
// the page colour, then name, handle, bio and the numbers as a quiet line.
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
        <View style={styles.titleRow}>
          <View style={styles.names}>
            <Text style={styles.name} numberOfLines={2}>
              {group.name}
            </Text>
            <View style={styles.handleRow}>
              <Text style={styles.handle} numberOfLines={1}>
                {handleLine}
              </Text>
              {acting ? (
                <View style={styles.acting} accessibilityLabel="The squad you act as">
                  <View style={styles.actingDot} />
                  <Text style={styles.actingText}>Acting</Text>
                </View>
              ) : null}
            </View>
          </View>

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
  banner: {
    height: BANNER,
    borderRadius: radius.xl,
    overflow: 'hidden',
    backgroundColor: colors.surfaceAlt,
  },
  pressed: { opacity: 0.85 },
  // Half the photo rides on the banner's bottom edge.
  avatarRow: { marginTop: -(AVATAR / 2 + RING), paddingLeft: space.md },
  identity: { gap: space.sm, marginTop: space.sm },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  names: { flex: 1, minWidth: 0, gap: 4 },
  name: { color: colors.text, ...typo.display, fontSize: textSize.hero, letterSpacing: -0.5 },
  handleRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, flexWrap: 'wrap' },
  handle: { flexShrink: 1, color: colors.textSoft, ...typo.medium, fontSize: textSize.body },
  acting: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  actingDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: ACTING_ACCENT },
  actingText: { color: ACTING_ACCENT, ...typo.semi, fontSize: textSize.small },
  bio: { marginTop: space.xxs, color: colors.text, ...typo.regular, fontSize: textSize.base, lineHeight: 21 },
  stats: { flexDirection: 'row', gap: space.md },
  stat: { alignItems: 'center', minWidth: 36 },
  statValue: { color: colors.text, ...typo.title, fontSize: textSize.lead + 2, letterSpacing: -0.3 },
  statLabel: { color: colors.textSoft, ...typo.medium, fontSize: textSize.caption },
});
