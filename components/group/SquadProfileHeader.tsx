import { useEffect, useState } from 'react';
import { Image, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import type { Group } from '../../services/serviceGroup';
import { sinceYear } from '../../lib/acting';
import Monogram from '../general/Monogram';
import ImageViewer from '../general/ImageViewer';
import { colors, radius, space, textSize, typo } from '../../theme';

const AVATAR = 64;
// One quiet warm accent, used only to mark the squad you act as.
export const ACTING_ACCENT = '#D97757';
// A bookish serif for the squad's name; the rest stays in the app's sans.
export const SERIF = Platform.select({ ios: 'Georgia', android: 'serif', default: 'Georgia, "Times New Roman", serif' });

export type ProfileStat = { value: number | null; label: string };

type SquadProfileHeaderProps = {
  group: Group;
  stats: ProfileStat[];
  acting: boolean;
};

// Calm profile top: one soft photo, the name in a serif, and the numbers as a
// quiet line of text rather than a panel.
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

      <View style={styles.identity}>
        <Pressable
          onPress={() => (group.avatarUrl ? setViewing('avatar') : undefined)}
          disabled={!group.avatarUrl}
          accessibilityRole={group.avatarUrl ? 'imagebutton' : undefined}
          accessibilityLabel={`${group.name} photo`}
          style={({ pressed }) => pressed && styles.pressed}
        >
          <Monogram name={group.name} size={AVATAR} uri={group.avatarUrl} />
        </Pressable>

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
      </View>

      {group.bio ? <Text style={styles.bio}>{group.bio}</Text> : null}

      <Text style={styles.stats}>
        {stats.map((stat, index) => (
          <Text key={stat.label}>
            {index > 0 ? <Text style={styles.sep}>{'   '}</Text> : null}
            <Text style={styles.statValue}>{stat.value === null ? '–' : stat.value}</Text>
            <Text style={styles.statLabel}> {stat.label}</Text>
          </Text>
        ))}
      </Text>

      <ImageViewer
        uri={viewing === 'banner' ? banner : viewing === 'avatar' ? group.avatarUrl : null}
        label={viewing === 'banner' ? `${group.name} banner` : `${group.name} photo`}
        onClose={() => setViewing(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.md },
  banner: {
    height: 148,
    borderRadius: radius.xl,
    overflow: 'hidden',
    backgroundColor: colors.surfaceAlt,
  },
  pressed: { opacity: 0.8 },
  identity: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  names: { flex: 1, minWidth: 0, gap: 4 },
  name: { color: colors.text, fontFamily: SERIF, fontSize: 26, lineHeight: 31, letterSpacing: -0.3 },
  handleRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, flexWrap: 'wrap' },
  handle: { flexShrink: 1, color: colors.textSoft, ...typo.regular, fontSize: textSize.body },
  acting: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  actingDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: ACTING_ACCENT },
  actingText: { color: ACTING_ACCENT, ...typo.medium, fontSize: textSize.small },
  bio: { color: colors.text, ...typo.regular, fontSize: textSize.base, lineHeight: 21 },
  stats: { lineHeight: 20 },
  sep: { fontSize: textSize.body },
  statValue: { color: colors.text, ...typo.semi, fontSize: textSize.body },
  statLabel: { color: colors.textSoft, ...typo.regular, fontSize: textSize.body },
});
