import { useEffect, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import type { Group } from '../../services/serviceGroup';
import { nightsLabel } from '../../lib/squadLook';
import { sinceYear } from '../../lib/acting';
import Monogram from '../general/Monogram';
import Punch from '../general/Punch';
import { colors, radius, shadow, space, textSize, typo } from '../../theme';

const BANNER = 110;
const AVATAR = 64;

type ActingCardProps = {
  group: Group;
  nights: number;
  onOpenProfile: () => void;
};

export default function ActingCard({ group, nights, onOpenProfile }: ActingCardProps) {
  const [bannerBroken, setBannerBroken] = useState(false);

  useEffect(() => {
    setBannerBroken(false);
  }, [group.bannerUrl]);

  const banner = group.bannerUrl && !bannerBroken ? group.bannerUrl : null;
  const year = sinceYear(group.createdAt);
  const members = `${group.memberCount} ${group.memberCount === 1 ? 'member' : 'members'}`;
  const meta = [`@${group.handle}`, members, year ? `since ${year}` : null].filter(Boolean).join(' · ');

  return (
    <View style={styles.card}>
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

        {nights > 0 ? (
          <View style={styles.tag}>
            <Text style={styles.tagText}>{nightsLabel(nights).toUpperCase()} ON THIS WALL</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.body}>
        <View style={styles.avatarRow}>
          <Monogram name={group.name} size={AVATAR} ring={4} uri={group.avatarUrl} />
          <Punch state="in" size={28} holeColor={colors.surface} />
        </View>

        <Text style={styles.name} numberOfLines={1}>
          {group.name}
        </Text>
        <Text style={styles.meta} numberOfLines={1}>
          {meta}
        </Text>

        <View style={styles.actions}>
          <Pressable
            onPress={onOpenProfile}
            accessibilityRole="button"
            accessibilityLabel={`Open ${group.name} profile`}
            style={({ pressed }) => [styles.primary, pressed && styles.pressed]}
          >
            <Text style={styles.primaryText}>Open profile</Text>
          </Pressable>

          <View
            accessible
            accessibilityRole="button"
            accessibilityLabel="Who we follow, coming soon"
            accessibilityState={{ disabled: true }}
            style={styles.secondary}
          >
            <Ionicons name="people-outline" size={16} color={colors.textFaint} />
            <Text style={styles.secondaryText}>Who we follow</Text>
            <Text style={styles.soon}>soon</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    overflow: 'hidden',
    ...shadow.card,
  },
  banner: { height: BANNER, backgroundColor: '#1B2A44' },
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
  body: { paddingHorizontal: space.md, paddingBottom: space.md, gap: 2 },
  avatarRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginTop: -AVATAR / 2,
    marginBottom: space.xs,
  },
  name: { color: colors.text, ...typo.display, fontSize: textSize.heading + 4 },
  meta: { color: colors.textFaint, ...typo.mono, fontSize: textSize.small },
  actions: { flexDirection: 'row', gap: space.sm, marginTop: space.md },
  primary: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: radius.md,
    backgroundColor: colors.text,
  },
  primaryText: { color: '#FFFFFF', ...typo.semi, fontSize: textSize.base },
  secondary: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.xs,
    paddingVertical: 12,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    opacity: 0.6,
  },
  secondaryText: { color: colors.textFaint, ...typo.semi, fontSize: textSize.base },
  soon: { color: colors.textFaint, ...typo.mono, fontSize: textSize.micro },
  pressed: { opacity: 0.7 },
});
