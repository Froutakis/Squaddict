import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Image, PanResponder, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { getBannerFocus, setBannerFocus, type Group } from '../../services/serviceGroup';
import { clampFocus, coverPlacement, DEFAULT_FOCUS, focusAfterDrag } from '../../lib/bannerCrop';
import Monogram from '../general/Monogram';
import ImageViewer from '../general/ImageViewer';
import { colors, radius, shadow, solidFor, space, sun, textSize, tint, typo } from '../../theme';

const BANNER = 210;
const AVATAR = 104;
const RING = 4;
// The one colour that marks the squad you act as, the same on You and here.
// Not red: red already means unread.
export const ACTING_ACCENT = sun;

export type ProfileStat = { value: number | null; label: string };

type Size = { width: number; height: number };

type SquadProfileHeaderProps = {
  group: Group;
  stats: ProfileStat[];
  // Members can drag the banner to choose what shows, like a Facebook cover.
  canReposition?: boolean;
  // Shows the "acting as" chip under the name.
  acting?: boolean;
};

// Banner with the squad's photo sitting on its bottom edge, cut out by a ring in
// the page colour, then the name, the numbers as one line of text, and the bio.
export default function SquadProfileHeader({
  group,
  stats,
  canReposition = false,
  acting = false,
}: SquadProfileHeaderProps) {
  const [bannerBroken, setBannerBroken] = useState(false);
  const [viewing, setViewing] = useState<'banner' | 'avatar' | null>(null);
  const [frame, setFrame] = useState<Size | null>(null);
  const [photoSize, setPhotoSize] = useState<Size | null>(null);
  const [focus, setFocus] = useState(DEFAULT_FOCUS);
  const [draft, setDraft] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const banner = group.bannerUrl && !bannerBroken ? group.bannerUrl : null;
  const repositioning = draft !== null;
  const shownFocus = draft ?? focus;

  useEffect(() => {
    setBannerBroken(false);
    setPhotoSize(null);
    setDraft(null);
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

  useEffect(() => {
    let cancelled = false;
    getBannerFocus(group.id)
      .then(function (value) {
        if (!cancelled) setFocus(clampFocus(value));
      })
      .catch(function () {});
    return function cleanup() {
      cancelled = true;
    };
  }, [group.id]);

  const placement = frame && photoSize ? coverPlacement(frame, photoSize, shownFocus) : null;
  const canMove = canReposition && banner !== null && placement !== null && placement.overflowY > 0;

  // The pan handler reads the latest numbers through a ref, so it is built once.
  const live = useRef({ start: DEFAULT_FOCUS, current: DEFAULT_FOCUS, overflow: 0 });
  live.current.current = shownFocus;
  live.current.overflow = placement?.overflowY ?? 0;

  const pan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: () => {
          live.current.start = live.current.current;
        },
        onPanResponderMove: (_event, gesture) => {
          setDraft(focusAfterDrag(live.current.start, gesture.dy, live.current.overflow));
        },
        onPanResponderTerminationRequest: () => false,
      }),
    [],
  );

  async function save() {
    if (draft === null) return;
    setSaving(true);
    setError(null);
    try {
      await setBannerFocus(group.id, draft);
      setFocus(draft);
      setDraft(null);
    } catch {
      setError('Could not save the position. Try again.');
    } finally {
      setSaving(false);
    }
  }

  const photo = banner ? (
    <Image
      source={{ uri: banner }}
      style={
        placement
          ? { position: 'absolute', width: placement.width, height: placement.height, left: placement.left, top: placement.top }
          : StyleSheet.absoluteFill
      }
      resizeMode="cover"
      onError={() => setBannerBroken(true)}
    />
  ) : (
    <LinearGradient colors={[solidFor(group.name), colors.ink]} style={StyleSheet.absoluteFill} />
  );

  return (
    <View>
      <View
        style={styles.banner}
        onLayout={(event) => {
          const { width, height } = event.nativeEvent.layout;
          setFrame({ width, height });
        }}
      >
        {repositioning ? (
          <View style={StyleSheet.absoluteFill} {...pan.panHandlers}>
            {photo}
            <View style={styles.hint} pointerEvents="none">
              <Ionicons name="move" size={16} color="#FFFFFF" />
              <Text style={styles.hintText}>Drag to reposition</Text>
            </View>
          </View>
        ) : (
          <Pressable
            onPress={() => (banner ? setViewing('banner') : undefined)}
            disabled={!banner}
            accessibilityRole={banner ? 'imagebutton' : undefined}
            accessibilityLabel={`${group.name} banner`}
            accessibilityHint={banner ? 'Opens the full image' : undefined}
            style={({ pressed }) => [StyleSheet.absoluteFill, pressed && styles.pressed]}
          >
            {photo}
          </Pressable>
        )}

        {repositioning ? (
          <View style={styles.editBar}>
            <Pressable
              onPress={() => {
                setDraft(null);
                setError(null);
              }}
              disabled={saving}
              accessibilityRole="button"
              accessibilityLabel="Cancel"
              style={({ pressed }) => [styles.glass, pressed && styles.pressed]}
            >
              <Text style={styles.glassText}>Cancel</Text>
            </Pressable>
            <Pressable
              onPress={save}
              disabled={saving}
              accessibilityRole="button"
              accessibilityLabel="Save position"
              style={({ pressed }) => [styles.glass, styles.save, pressed && styles.pressed]}
            >
              {saving ? (
                <ActivityIndicator size="small" color={colors.text} />
              ) : (
                <Text style={styles.saveText}>Save</Text>
              )}
            </Pressable>
          </View>
        ) : canMove ? (
          <Pressable
            onPress={() => setDraft(focus)}
            accessibilityRole="button"
            accessibilityLabel="Reposition the banner"
            style={({ pressed }) => [styles.glass, styles.reposition, pressed && styles.pressed]}
          >
            <Ionicons name="move" size={14} color="#FFFFFF" />
            <Text style={styles.glassText}>Reposition</Text>
          </Pressable>
        ) : null}
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <View style={styles.avatarRow} pointerEvents="box-none">
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
        {group.handle || acting ? (
          <View style={styles.subline}>
            {group.handle ? <Text style={styles.handle}>@{group.handle}</Text> : null}
            {acting ? (
              <View style={styles.actingChip} accessibilityLabel="You are acting as this squad">
                <View style={styles.actingDot} />
                <Text style={styles.actingText}>Acting as this squad</Text>
              </View>
            ) : null}
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
            accessibilityLabel={`${stat.value ?? 'No'} ${stat.label}`}
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
  // Edge to edge, like a cover photo: the page's side padding is cancelled out.
  banner: {
    height: BANNER,
    marginHorizontal: -space.lg,
    overflow: 'hidden',
    backgroundColor: colors.surfaceAlt,
  },
  pressed: { opacity: 0.85 },
  glass: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    height: 30,
    paddingHorizontal: 12,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(12,25,38,0.55)',
  },
  glassText: { color: '#FFFFFF', ...typo.semi, fontSize: textSize.small },
  reposition: { position: 'absolute', right: space.sm, bottom: space.sm },
  editBar: { position: 'absolute', right: space.sm, bottom: space.sm, flexDirection: 'row', gap: space.xs },
  save: { backgroundColor: '#FFFFFF', minWidth: 64, justifyContent: 'center' },
  saveText: { color: colors.text, ...typo.semi, fontSize: textSize.small },
  hint: {
    position: 'absolute',
    alignSelf: 'center',
    top: space.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 28,
    paddingHorizontal: 12,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(12,25,38,0.55)',
  },
  hintText: { color: '#FFFFFF', ...typo.semi, fontSize: textSize.small },
  error: { marginTop: space.xs, color: colors.danger, ...typo.medium, fontSize: textSize.body },
  // Half the photo rides on the banner's bottom edge.
  avatarRow: { marginTop: -(AVATAR / 2 + RING), paddingLeft: space.md, alignSelf: 'flex-start' },
  identity: { gap: space.xxs, marginTop: space.sm },
  name: { color: colors.text, ...typo.display, fontSize: textSize.display, letterSpacing: -0.6 },
  subline: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space.xs },
  handle: { color: colors.textSoft, ...typo.medium, fontSize: textSize.base },
  actingChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 24,
    paddingHorizontal: 10,
    borderRadius: radius.pill,
    backgroundColor: tint.sun,
  },
  actingDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: sun },
  actingText: { color: colors.text, ...typo.semi, fontSize: textSize.small },
  bio: { marginTop: space.xxs, color: colors.text, ...typo.regular, fontSize: textSize.base, lineHeight: 21 },
  // Four equal cells, so the numbers never wrap onto a second line.
  stats: {
    flexDirection: 'row',
    marginTop: space.md,
    paddingVertical: space.sm,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    ...shadow.card,
  },
  stat: { flex: 1, alignItems: 'center', gap: 1 },
  statDivider: { borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: colors.border },
  statValue: { color: colors.text, ...typo.bold, fontSize: textSize.heading, letterSpacing: -0.4 },
  statLabel: { color: colors.textFaint, ...typo.medium, fontSize: textSize.small },
});
