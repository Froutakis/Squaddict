import { useEffect, useState, type ReactNode } from 'react';
import { Ionicons } from '@expo/vector-icons';
import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { Group } from '../../services/serviceGroup';
import type { RsvpStatus } from '../../services/serviceEvents';
import { getPareaProfile, type FeedEvent, type PareaProfile } from '../../services/serviceFeed';
import { dateParts, weekdayShort } from '../../lib/datetime';
import { colors, layout, radius, solidFor, space, textSize, typo } from '../../theme';
import Monogram, { initialsFor } from '../general/Monogram';
import EventCard from '../events/EventCard';
import ShowMore, { visibleSlice } from '../general/ShowMore';
import { useSignedImages } from '../home/useSignedImages';
import { pluralWord } from '../../lib/text';

const HERO = 190;
const AVATAR = 76;

type PublicProfileProps = {
  group: Group;
  plans: FeedEvent[];
  savingId: string | null;
  error: string | null;
  followAction?: ReactNode;
  onBack: () => void;
  onAnswer: (plan: FeedEvent, status: RsvpStatus | null) => void;
  onOpenPlan: (plan: FeedEvent) => void;
  // The bottom row of a plan, in place of the card's own I'm in / Pass.
  stubFor?: (plan: FeedEvent) => ReactNode;
};

// A squad as people outside it see it: who they are, where they go,
// what's next and the nights they chose to share.
export default function PublicProfile({
  group,
  plans,
  savingId,
  error,
  followAction,
  onBack,
  onAnswer,
  onOpenPlan,
  stubFor,
}: PublicProfileProps) {
  const [profile, setProfile] = useState<PareaProfile | null>(null);
  const [viewing, setViewing] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const { signed, signPaths, dropSigned } = useSignedImages();

  useEffect(() => {
    let cancelled = false;

    getPareaProfile(group.id)
      .then((found) => {
        if (cancelled) return;
        setProfile(found);
        signPaths(found.photos.map((photo) => photo.path));
      })
      .catch(() => {
        if (!cancelled) setProfile({ nightsOut: 0, places: [], covers: [], photos: [] });
      });

    return () => {
      cancelled = true;
    };
  }, [group.id, signPaths]);

  const photoUrls = (profile?.photos ?? [])
    .map((photo) => signed[photo.path]?.url)
    .filter((url): url is string => Boolean(url));
  // The squad's own banner wins; without one, their latest covers and photos.
  const hero = group.bannerUrl
    ? [group.bannerUrl]
    : [...(profile?.covers ?? []), ...photoUrls].slice(0, 3);
  const [next, ...later] = plans;
  const laterSlice = visibleSlice(later, 3, showAll);
  const tint = solidFor(group.name);

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={[styles.hero, { backgroundColor: tint }]}>
          {hero.length > 0 ? (
            <View style={styles.collage}>
              <Image source={{ uri: hero[0] }} style={styles.collageMain} resizeMode="cover" />
              {hero.length > 1 ? (
                <View style={styles.collageSide}>
                  {hero.slice(1).map((uri) => (
                    <Image key={uri} source={{ uri }} style={styles.collageSmall} resizeMode="cover" />
                  ))}
                </View>
              ) : null}
            </View>
          ) : null}
          <View style={styles.heroShade} pointerEvents="none" />

          <Pressable
            onPress={onBack}
            accessibilityRole="button"
            accessibilityLabel="Back"
            style={({ pressed }) => [styles.round, pressed && styles.pressed]}
          >
            <Ionicons name="chevron-back" size={20} color={colors.text} />
          </Pressable>
        </View>

        <View style={styles.body}>
          <View style={styles.identityRow}>
            <View style={styles.avatar}>
              <Monogram
                name={group.name}
                uri={group.avatarUrl}
                initials={initialsFor(group.name)}
                size={AVATAR}
              />
            </View>
            <View style={styles.spacer} />
            {followAction ? <View style={styles.followAction}>{followAction}</View> : null}
          </View>

          <Text style={styles.name} numberOfLines={2}>
            {group.name}
          </Text>
          <Text style={styles.handle} numberOfLines={2}>
            @{group.handle}
            {group.bio ? ` · ${group.bio}` : ''}
          </Text>

          <View style={styles.stats}>
            <Text style={styles.stat}>
              <Text style={styles.statValue}>{group.memberCount}</Text>{' '}
              {pluralWord(group.memberCount, 'member', 'members')}
            </Text>
            <Text style={styles.stat}>
              <Text style={styles.statValue}>{group.followerCount ?? 0}</Text>{' '}
              {pluralWord(group.followerCount ?? 0, 'follower', 'followers')}
            </Text>
            {profile ? (
              <Text style={styles.stat}>
                <Text style={styles.statValue}>{profile.nightsOut}</Text>{' '}
                {pluralWord(profile.nightsOut, 'night out', 'nights out')}
              </Text>
            ) : null}
          </View>

          {profile && profile.places.length > 0 ? (
            <View style={styles.places}>
              <Text style={styles.placesLabel}>Usually at</Text>
              {profile.places.map((place) => (
                <View key={place} style={styles.place}>
                  <Text style={styles.placeText} numberOfLines={1}>
                    {place}
                  </Text>
                </View>
              ))}
            </View>
          ) : null}

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Text style={styles.section}>Next up</Text>
          {next ? (
            <EventCard
              event={{
                id: next.id,
                title: next.title,
                date: next.date,
                startTime: next.startTime,
                location: next.location,
                placeLabel: next.placeLabel,
                groupName: next.groupName,
                myStatus: next.myStatus,
                going: [],
                goingCount: next.goingCount,
                coverUrl: next.coverUrl,
              }}
              action="rsvp"
              saving={savingId === next.id}
              onPress={() => onOpenPlan(next)}
              stub={stubFor?.(next)}
              onRsvp={(status) => onAnswer(next, status)}
            />
          ) : (
            <Text style={styles.quiet}>
              Nothing open right now. Follow them to catch their next plan in Explore.
            </Text>
          )}

          {later.length > 0 ? (
            <>
              <Text style={styles.section}>Coming up</Text>
              <View style={styles.list}>
                {laterSlice.shown.map((plan, i) => {
                  const { day } = dateParts(plan.date);
                  const isIn = plan.myStatus === 'in';

                  return (
                    <Pressable
                      key={plan.id}
                      onPress={() => onOpenPlan(plan)}
                      accessibilityRole="button"
                      accessibilityLabel={plan.title}
                      style={({ pressed }) => [
                        styles.row,
                        i > 0 && styles.rowDivided,
                        pressed && styles.pressed,
                      ]}
                    >
                      <View style={styles.rowDate}>
                        <Text style={styles.rowWeekday}>{weekdayShort(plan.date)}</Text>
                        <Text style={styles.rowDay}>{String(day).padStart(2, '0')}</Text>
                      </View>
                      <View style={styles.rowText}>
                        <Text style={styles.rowTitle} numberOfLines={1}>
                          {plan.title}
                        </Text>
                        <Text style={styles.rowMeta} numberOfLines={1}>
                          {[plan.startTime, plan.location ?? plan.placeLabel, `${plan.goingCount} in`]
                            .filter(Boolean)
                            .join(' · ')}
                        </Text>
                      </View>
                      <Pressable
                        onPress={() => onAnswer(plan, isIn ? null : 'in')}
                        disabled={savingId === plan.id}
                        hitSlop={6}
                        accessibilityRole="button"
                        accessibilityLabel={isIn ? `Leave ${plan.title}` : `Join ${plan.title}`}
                        accessibilityState={{ selected: isIn }}
                        style={({ pressed }) => [
                          styles.join,
                          isIn && styles.joined,
                          pressed && styles.pressed,
                        ]}
                      >
                        <Text style={[styles.joinText, isIn && styles.joinedText]}>
                          {isIn ? 'In' : 'Join'}
                        </Text>
                      </Pressable>
                    </Pressable>
                  );
                })}
              </View>
              <ShowMore
                hidden={laterSlice.hidden}
                expanded={showAll}
                onToggle={() => setShowAll(!showAll)}
              />
            </>
          ) : null}

          {profile === null ? (
            <ActivityIndicator color={colors.primary} style={styles.loader} />
          ) : profile.photos.length > 0 ? (
            <>
              <Text style={styles.section}>Memories</Text>
              <View style={styles.grid}>
                {profile.photos.map((photo) => {
                  const url = signed[photo.path]?.url;

                  return (
                    <Pressable
                      key={photo.id}
                      onPress={() => url && setViewing(url)}
                      accessibilityRole="imagebutton"
                      accessibilityLabel={`Photo from ${group.name}`}
                      style={({ pressed }) => [styles.tile, pressed && styles.pressed]}
                    >
                      {url ? (
                        <Image
                          source={{ uri: url }}
                          style={styles.tileImage}
                          resizeMode="cover"
                          onError={() => dropSigned(photo.path)}
                        />
                      ) : null}
                    </Pressable>
                  );
                })}
              </View>
            </>
          ) : null}
        </View>
      </ScrollView>

      <Modal visible={viewing !== null} transparent animationType="fade" onRequestClose={() => setViewing(null)}>
        <Pressable
          style={styles.viewer}
          onPress={() => setViewing(null)}
          accessibilityRole="button"
          accessibilityLabel="Close photo"
        >
          {viewing ? <Image source={{ uri: viewing }} style={styles.viewerImage} resizeMode="contain" /> : null}
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { width: '100%', maxWidth: layout.column, alignSelf: 'center', paddingBottom: 130 },
  pressed: { opacity: 0.7 },
  spacer: { flex: 1 },

  hero: { height: HERO, overflow: 'hidden' },
  collage: { ...StyleSheet.absoluteFill, flexDirection: 'row', gap: 2 },
  collageMain: { flex: 2, height: '100%' },
  collageSide: { flex: 1, gap: 2 },
  collageSmall: { flex: 1, width: '100%' },
  heroShade: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(12,25,38,0.25)' },
  round: {
    position: 'absolute',
    top: space.sm,
    left: space.md,
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.92)',
  },

  body: { paddingHorizontal: space.lg },
  identityRow: { flexDirection: 'row', alignItems: 'flex-end', marginTop: -AVATAR / 2 },
  avatar: {
    padding: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.bg,
  },
  followAction: { flexShrink: 1, alignItems: 'flex-end', marginLeft: space.sm },

  name: {
    marginTop: space.sm,
    color: colors.text,
    ...typo.display,
    fontSize: textSize.display,
    letterSpacing: -0.6,
  },
  handle: { marginTop: 2, color: colors.textSoft, ...typo.medium, fontSize: textSize.body },

  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md, marginTop: space.md },
  stat: { color: colors.textSoft, ...typo.medium, fontSize: textSize.body },
  statValue: { color: colors.text, ...typo.semi },

  places: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6, marginTop: space.sm },
  placesLabel: { color: colors.textFaint, ...typo.medium, fontSize: textSize.caption },
  place: {
    maxWidth: 180,
    paddingHorizontal: space.sm,
    paddingVertical: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
  },
  placeText: { color: colors.text, ...typo.medium, fontSize: textSize.caption },

  error: { marginTop: space.sm, color: colors.danger, ...typo.medium, fontSize: textSize.body },
  section: {
    marginTop: space.lg,
    marginBottom: space.sm,
    color: colors.text,
    ...typo.title,
    fontSize: textSize.heading,
  },
  quiet: { color: colors.textFaint, ...typo.medium, fontSize: textSize.body },

  list: { borderRadius: radius.lg, backgroundColor: colors.surface, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm, padding: space.sm },
  rowDivided: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  rowDate: { width: 44, alignItems: 'center' },
  rowWeekday: { color: colors.accent, ...typo.semi, fontSize: 10, letterSpacing: 0.5 },
  rowDay: { color: colors.text, ...typo.title, fontSize: 19 },
  rowText: { flex: 1, minWidth: 0, gap: 2 },
  rowTitle: { color: colors.text, ...typo.semi, fontSize: textSize.base },
  rowMeta: { color: colors.textSoft, ...typo.mono, fontSize: textSize.small },
  join: {
    height: 30,
    paddingHorizontal: 14,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  joined: { backgroundColor: colors.ink, borderColor: colors.ink },
  joinText: { color: colors.text, ...typo.semi, fontSize: textSize.small },
  joinedText: { color: colors.textOnBrand },

  loader: { marginTop: space.lg },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  tile: {
    width: '32%',
    aspectRatio: 1,
    borderRadius: radius.sm,
    overflow: 'hidden',
    backgroundColor: colors.surfaceAlt,
  },
  tileImage: { width: '100%', height: '100%' },

  viewer: {
    flex: 1,
    backgroundColor: 'rgba(12,25,38,0.94)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: space.md,
  },
  viewerImage: { width: '100%', height: '100%' },
});
