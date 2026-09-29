import { useEffect, useState, type ReactNode } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import type { Group } from '../../services/serviceGroup';
import { nightsLabel } from '../../lib/squadLook';
import Monogram from '../general/Monogram';
import ImageViewer from '../general/ImageViewer';
import { paper, radius, space, textSize, typo } from '../../theme';

const BANNER_HEIGHT = 170;
const AVATAR = 84;

type SquadHeroProps = {
  group: Group;
  memberCount: number;
  nights: number;
  onBack: () => void;
  action?: ReactNode;
  onMenu?: () => void;
};

function plural(count: number, one: string, many: string) {
  return `${count} ${count === 1 ? one : many}`;
}

export default function SquadHero({ group, memberCount, nights, onBack, action, onMenu }: SquadHeroProps) {
  const [bannerBroken, setBannerBroken] = useState(false);
  const [viewing, setViewing] = useState<'banner' | 'avatar' | null>(null);

  useEffect(() => {
    setBannerBroken(false);
  }, [group.bannerUrl]);

  const banner = group.bannerUrl && !bannerBroken ? group.bannerUrl : null;

  return (
    <View>
      <View style={styles.banner}>
        {banner ? (
          <Pressable
            onPress={function () {
              setViewing('banner');
            }}
            accessibilityRole="imagebutton"
            accessibilityLabel={`${group.name} banner`}
            accessibilityHint="Opens the full image"
            style={StyleSheet.absoluteFill}
          >
            <Image
              source={{ uri: banner }}
              style={StyleSheet.absoluteFill}
              resizeMode="cover"
              onError={function () {
                setBannerBroken(true);
              }}
            />
          </Pressable>
        ) : (
          <LinearGradient colors={['#1B2A44', '#3A2E3F']} style={StyleSheet.absoluteFill} />
        )}

        <Pressable
          onPress={onBack}
          accessibilityRole="button"
          accessibilityLabel="Back"
          style={({ pressed }) => [styles.back, pressed && styles.pressed]}
        >
          <Ionicons name="chevron-back" size={20} color={paper.ink} />
        </Pressable>

        {onMenu ? (
          <Pressable
            onPress={onMenu}
            accessibilityRole="button"
            accessibilityLabel="More options"
            style={({ pressed }) => [styles.back, styles.menu, pressed && styles.pressed]}
          >
            <Ionicons name="ellipsis-horizontal" size={19} color={paper.ink} />
          </Pressable>
        ) : null}

        {nights > 0 ? (
          <View style={styles.tag}>
            <Text style={styles.tagText}>{nightsLabel(nights).toUpperCase()} ON THIS WALL</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.avatarRow}>
        {group.avatarUrl ? (
          <Pressable
            onPress={function () {
              setViewing('avatar');
            }}
            accessibilityRole="imagebutton"
            accessibilityLabel={`${group.name} photo`}
            accessibilityHint="Opens the full image"
            style={({ pressed }) => pressed && styles.pressed}
          >
            <Monogram name={group.name} size={AVATAR} ring={4} uri={group.avatarUrl} />
          </Pressable>
        ) : (
          <Monogram name={group.name} size={AVATAR} ring={4} />
        )}

        {action ? <View style={styles.action}>{action}</View> : null}
      </View>

      <View style={styles.identity}>
        <Text style={styles.name} numberOfLines={2}>
          {group.name}
        </Text>
        <Text style={styles.handle}>
          @{group.handle} · {plural(memberCount, 'member', 'members')}
        </Text>
        {group.bio ? <Text style={styles.bio}>{group.bio}</Text> : null}
      </View>

      <ImageViewer
        uri={viewing === 'banner' ? banner : viewing === 'avatar' ? group.avatarUrl : null}
        label={viewing === 'banner' ? `${group.name} banner` : `${group.name} photo`}
        onClose={function () {
          setViewing(null);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    height: BANNER_HEIGHT,
    borderRadius: radius.lg,
    overflow: 'hidden',
    backgroundColor: paper.mine,
  },
  back: {
    position: 'absolute',
    top: space.sm,
    left: space.sm,
    width: 34,
    height: 34,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255,255,255,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  menu: { left: undefined, right: space.sm },
  pressed: { opacity: 0.6 },
  tag: {
    position: 'absolute',
    right: space.sm,
    bottom: space.sm,
    paddingHorizontal: space.sm,
    paddingVertical: space.xxs,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  tagText: { color: '#FFFFFF', ...typo.bold, fontSize: textSize.caption, letterSpacing: 1 },
  avatarRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: space.sm,
    marginTop: -AVATAR / 2,
    paddingLeft: space.md,
  },
  action: { flexShrink: 1, alignItems: 'flex-end' },
  identity: { gap: 3, paddingTop: space.sm },
  name: { color: paper.ink, ...typo.display, fontSize: textSize.hero },
  handle: { color: paper.inkFaint, ...typo.mono, fontSize: textSize.body },
  bio: { color: paper.inkSoft, ...typo.medium, fontSize: textSize.base, lineHeight: 20, marginTop: space.xxs },
});
