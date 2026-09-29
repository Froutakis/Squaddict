import { useEffect, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import type { Group } from '../../services/serviceGroup';
import Monogram from '../general/Monogram';
import ImageViewer from '../general/ImageViewer';
import { colors, radius, space, textSize, typo } from '../../theme';

const BANNER = 200;
// Where to keep the crop when a photo is taller than the frame: 0 = its top,
// 0.5 = its middle. People's faces usually sit in the upper part of a group shot.
const FOCUS_Y = 0.3;
const AVATAR = 112;
const RING = 4;
// The one colour that marks the squad you act as: the red of the logo.
export const ACTING_ACCENT = colors.accent;

export type ProfileStat = { value: number | null; label: string };

type SquadProfileHeaderProps = {
  group: Group;
  stats: ProfileStat[];
};

// Banner with the squad's photo sitting on its bottom edge, cut out by a ring in
// the page colour, then the name, the numbers as one line of text, and the bio.
export default function SquadProfileHeader({ group, stats }: SquadProfileHeaderProps) {
  const [bannerBroken, setBannerBroken] = useState(false);
  const [viewing, setViewing] = useState<'banner' | 'avatar' | null>(null);

  const [frame, setFrame] = useState<{ width: number; height: number } | null>(null);
  const [photoSize, setPhotoSize] = useState<{ width: number; height: number } | null>(null);

  useEffect(() => {
    setBannerBroken(false);
    setPhotoSize(null);
    if (!group.bannerUrl) return;

    let cancelled = false;
    Image.getSize(
      group.bannerUrl,
      function (width, height) {
        if (!cancelled && width && height) setPhotoSize({ width, height });
      },
      function () {},
    );
    return function cleanup() {
      cancelled = true;
    };
  }, [group.bannerUrl]);

  // Fill the frame (like "cover"), but choose which part stays: centred across,
  // biased towards the top down the height.
  const placement =
    frame && photoSize
      ? (() => {
          const scale = Math.max(frame.width / photoSize.width, frame.height / photoSize.height);
          const width = photoSize.width * scale;
          const height = photoSize.height * scale;
          return {
            position: 'absolute' as const,
            width,
            height,
            left: (frame.width - width) / 2,
            top: (frame.height - height) * FOCUS_Y,
          };
        })()
      : null;

  const banner = group.bannerUrl && !bannerBroken ? group.bannerUrl : null;

  return (
    <View>
      <Pressable
        onPress={() => (banner ? setViewing('banner') : undefined)}
        disabled={!banner}
        accessibilityRole={banner ? 'imagebutton' : undefined}
        accessibilityLabel={`${group.name} banner`}
        accessibilityHint={banner ? 'Opens the full image' : undefined}
        onLayout={(event) => {
          const { width, height } = event.nativeEvent.layout;
          setFrame({ width, height });
        }}
        style={({ pressed }) => [styles.banner, pressed && styles.pressed]}
      >
        {banner ? (
          <Image
            source={{ uri: banner }}
            style={placement ?? StyleSheet.absoluteFill}
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

        <View style={styles.stats}>
          {stats.map((stat) => (
            <Text key={stat.label} style={styles.stat}>
              <Text style={styles.statValue}>{stat.value === null ? '–' : stat.value}</Text> {stat.label}
            </Text>
          ))}
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
  identity: { gap: space.xs, marginTop: space.sm },
  name: { color: colors.text, ...typo.display, fontSize: textSize.display, letterSpacing: -0.6 },
  // The numbers read as a sentence, like a profile on Instagram's web page.
  stats: { flexDirection: 'row', flexWrap: 'wrap', columnGap: space.lg, rowGap: 2 },
  stat: { color: colors.textSoft, ...typo.regular, fontSize: textSize.base },
  statValue: { color: colors.text, ...typo.bold },
  bio: { marginTop: space.xxs, color: colors.text, ...typo.regular, fontSize: textSize.base, lineHeight: 21 },
});
