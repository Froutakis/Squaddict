import { useEffect, useRef, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import {
  Animated,
  Image,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  type GestureResponderEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  useWindowDimensions,
  View,
} from 'react-native';
import { getEventPhotos, type EventPhoto } from '../../services/serviceEvents';
import type { FeedPhoto } from '../../services/servicePhotoFeed';
import { QUICK_REACTION, REACTIONS, reactorsLine, tallyReactions, type PhotoReaction } from '../../lib/photoFeed';
import { parseDateKey } from '../../lib/datetime';
import type { Person } from '../../lib/people';
import type { SignedMap } from '../chat/media';
import Monogram from '../general/Monogram';
import ReportSheet from '../general/ReportSheet';
import { isBlocked, type ReportTarget } from '../../services/serviceSafety';
import { REACTION_ICONS, REACTION_NAMES } from '../general/reactionIcons';
import { whyLabel } from './PhotoPost';
import { shortPlace } from './LineTicket';
import { colors, layout, onPhoto, radius, scrim, space, textSize, tint, typo } from '../../theme';

const DOUBLE_TAP_MS = 260;
// The left and right edges of a photo step back and forward.
const TAP_EDGE = 0.35;
const THUMB = 52;
// The thumbnails ride up over the photo by this much.
const THUMB_LIFT = 30;
const FACES_SHOWN = 5;
// Past this many photos the bars on top get too thin to read.
const BARS_MAX = 20;
// The modal draws under Android's status bar and SafeAreaView adds nothing
// there, so the top bar steps down by the bar's height itself.
const STATUS_GAP = Platform.OS === 'android' ? StatusBar.currentHeight ?? 24 : 0;

type PostViewerProps = {
  // The post that is open; null when closed.
  item: FeedPhoto | null;
  reactions: PhotoReaction[];
  userId: string;
  signed: SignedMap;
  signPaths: (paths: string[]) => void;
  onImageError: (path: string) => void;
  onReact: (emoji: string) => void;
  onShare?: () => void;
  onOpenGroup?: () => void;
  onClose: () => void;
};

// A night opened full screen: its photos edge to edge (tap the sides to step,
// swipe, or jump from the thumbnails; double tap for a fire), who took each
// one, and below them what the night was, who went and the reactions.
export default function PostViewer({
  item,
  reactions,
  userId,
  signed,
  signPaths,
  onImageError,
  onReact,
  onShare,
  onOpenGroup,
  onClose,
}: PostViewerProps) {
  const { width: screen } = useWindowDimensions();
  const width = Math.min(screen, layout.column);
  const [photos, setPhotos] = useState<EventPhoto[]>([]);
  const [page, setPage] = useState(0);
  const [stageHeight, setStageHeight] = useState(0);
  // Everyone who reacted, in a sheet inside the viewer (a sheet of the feed
  // behind it would only show once the viewer closed).
  const [reactorsOpen, setReactorsOpen] = useState(false);
  // The photo on screen, being reported (and maybe its author blocked).
  const [reporting, setReporting] = useState<ReportTarget | null>(null);
  // Blocked from the report sheet: the viewer closes once they tap Done.
  const [blockedHere, setBlockedHere] = useState(false);
  const pager = useRef<ScrollView>(null);
  const lastTap = useRef(0);
  const stepTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const burst = useRef(new Animated.Value(0)).current;

  // The post's own photos right away; the whole night once it has loaded,
  // starting from the photo that was on the post.
  useEffect(() => {
    if (!item) return;
    let cancelled = false;
    setPhotos([item.photo, ...item.more]);
    setPage(0);
    setReactorsOpen(false);

    getEventPhotos(item.event.id)
      .then((fetched) => {
        // Photos from people you blocked are left out.
        const all = fetched.filter((photo) => !isBlocked(photo.userId));
        if (cancelled || all.length === 0) return;
        const first = all.findIndex((photo) => photo.id === item.photo.id);
        setPhotos(first > 0 ? [...all.slice(first), ...all.slice(0, first)] : all);
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [item]);

  const paths = photos.map((photo) => photo.path).join('|');
  useEffect(() => {
    if (paths !== '') signPaths(paths.split('|'));
  }, [paths, signPaths]);

  useEffect(
    () => () => {
      if (stepTimer.current) clearTimeout(stepTimer.current);
    },
    [],
  );

  if (!item) return null;

  const tally = tallyReactions(reactions, userId);
  const line = reactorsLine(reactions, userId);
  const why = whyLabel(item.reason, item.via);
  const place = shortPlace(item.event.placeLabel ?? item.event.location);
  const day = dateLabel(item.event.date);
  const meta = [day, item.event.startTime, place].filter(Boolean).join(' · ');
  const went = item.event.going;
  const wentCount = Math.max(item.wentCount, went.length);
  const current = photos[page];
  const takenBy = current ? personOf(went, current.userId, userId) : null;

  function goTo(next: number) {
    const target = Math.max(0, Math.min(photos.length - 1, next));
    setPage(target);
    pager.current?.scrollTo({ x: target * width, animated: true });
  }

  function onScroll(event: NativeSyntheticEvent<NativeScrollEvent>) {
    const next = Math.round(event.nativeEvent.contentOffset.x / width);
    if (next !== page) setPage(next);
  }

  // One tap on an edge steps; two quick taps anywhere leave a fire. The step
  // waits a beat, so a double tap never also steps.
  function tapPhoto(event: GestureResponderEvent) {
    const now = Date.now();
    if (now - lastTap.current < DOUBLE_TAP_MS) {
      lastTap.current = 0;
      if (stepTimer.current) clearTimeout(stepTimer.current);
      burst.setValue(0);
      Animated.sequence([
        Animated.spring(burst, { toValue: 1, friction: 5, tension: 140, useNativeDriver: true }),
        Animated.timing(burst, { toValue: 0, duration: 220, delay: 260, useNativeDriver: true }),
      ]).start();
      if (tally.mine !== QUICK_REACTION) onReact(QUICK_REACTION);
      return;
    }
    lastTap.current = now;
    // Phones give locationX; the web's mouse event has offsetX instead.
    const native = event.nativeEvent as typeof event.nativeEvent & { offsetX?: number };
    const x = native.locationX ?? native.offsetX ?? width / 2;
    if (stepTimer.current) clearTimeout(stepTimer.current);
    stepTimer.current = setTimeout(() => {
      if (x < width * TAP_EDGE) goTo(page - 1);
      else if (x > width * (1 - TAP_EDGE)) goTo(page + 1);
    }, DOUBLE_TAP_MS);
  }

  return (
    <Modal
      visible
      animationType="slide"
      // Back closes the reactions sheet first, then the viewer.
      onRequestClose={() => (reactorsOpen ? setReactorsOpen(false) : onClose())}
      statusBarTranslucent
    >
      <View style={styles.screen}>
        <View style={[styles.column, { width }]}>
          {/* The photos, edge to edge. */}
          <View style={styles.stage} onLayout={(event) => setStageHeight(event.nativeEvent.layout.height)}>
            {stageHeight > 0 ? (
              <ScrollView
                ref={pager}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                onScroll={onScroll}
                scrollEventThrottle={32}
              >
                {photos.map((photo, i) => {
                  const url = signed[photo.path]?.url;
                  return (
                    <Pressable
                      key={photo.id}
                      onPress={tapPhoto}
                      accessibilityRole="image"
                      accessibilityLabel={`Photo ${i + 1} of ${photos.length} from ${item.event.title}`}
                      accessibilityHint="Double tap to leave a fire"
                      style={[styles.photo, { width, height: stageHeight }]}
                    >
                      {url ? (
                        <Image
                          source={{ uri: url }}
                          style={StyleSheet.absoluteFill}
                          resizeMode="cover"
                          onError={() => onImageError(photo.path)}
                        />
                      ) : null}
                    </Pressable>
                  );
                })}
              </ScrollView>
            ) : null}

            {/* The top: where you are in the night, back, what it is, share. */}
            <LinearGradient
              colors={[scrim.photoTop, scrim.photoClear]}
              style={styles.topShade}
              pointerEvents="none"
            />
            <SafeAreaView style={styles.top} pointerEvents="box-none">
              {photos.length > 1 && photos.length <= BARS_MAX ? (
                <View
                  style={styles.bars}
                  accessibilityElementsHidden
                  importantForAccessibility="no-hide-descendants"
                >
                  {photos.map((photo, i) => (
                    <View key={photo.id} style={[styles.barSeg, i <= page && styles.barSegOn]} />
                  ))}
                </View>
              ) : null}
              <View style={styles.topRow}>
                <Pressable
                  onPress={onClose}
                  accessibilityRole="button"
                  accessibilityLabel="Back to the memories"
                  hitSlop={8}
                  style={({ pressed }) => [styles.round, pressed && styles.pressed]}
                >
                  <Ionicons name="chevron-back" size={22} color={colors.onInk} />
                </Pressable>
                <Pressable
                  onPress={onOpenGroup}
                  disabled={!onOpenGroup}
                  accessibilityRole={onOpenGroup ? 'button' : undefined}
                  accessibilityLabel={onOpenGroup ? `Open ${item.group.name}` : undefined}
                  style={({ pressed }) => [styles.topText, pressed && onOpenGroup && styles.pressed]}
                >
                  <Text style={styles.topTitle} numberOfLines={1}>
                    {item.event.title}
                  </Text>
                  <Text style={styles.topSub} numberOfLines={1}>
                    {[item.group.name, shortDate(item.event.date)].filter(Boolean).join(' · ')}
                  </Text>
                </Pressable>
                {onShare ? (
                  <Pressable
                    onPress={onShare}
                    accessibilityRole="button"
                    accessibilityLabel="Share this night as a ticket"
                    hitSlop={8}
                    style={({ pressed }) => [styles.round, pressed && styles.pressed]}
                  >
                    <Ionicons name="share-outline" size={19} color={colors.onInk} />
                  </Pressable>
                ) : null}
                {current && current.userId !== userId ? (
                  <Pressable
                    onPress={() =>
                      setReporting({
                        kind: 'photo',
                        id: current.id,
                        userId: current.userId,
                        userName: takenBy?.name ?? null,
                        label: `${takenBy?.name ? `${takenBy.name}'s photo` : 'A photo'} from ${item.event.title}`,
                      })
                    }
                    accessibilityRole="button"
                    accessibilityLabel="Report this photo"
                    hitSlop={8}
                    style={({ pressed }) => [styles.round, pressed && styles.pressed]}
                  >
                    <Ionicons name="flag-outline" size={18} color={colors.onInk} />
                  </Pressable>
                ) : null}
              </View>
            </SafeAreaView>

            {/* Who took this one, and when. */}
            {takenBy && current ? (
              <View style={styles.by} pointerEvents="none">
                <Monogram name={takenBy.name} uri={takenBy.avatarUrl} size={22} />
                <Text style={styles.byText} numberOfLines={1}>
                  {takenBy.name} · {clock(current.createdAt)}
                </Text>
              </View>
            ) : null}

            <View style={styles.burstWrap} pointerEvents="none">
              <Animated.View
                style={{
                  opacity: burst,
                  transform: [{ scale: burst.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] }) }],
                }}
              >
                <Ionicons name="flame" size={110} color={colors.danger} />
              </Animated.View>
            </View>
          </View>

          {/* What the night was, under the photos. */}
          <SafeAreaView style={styles.panel}>
            {photos.length > 1 ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.thumbs}
                contentContainerStyle={styles.thumbsInner}
              >
                {photos.map((photo, i) => {
                  const url = signed[photo.path]?.url;
                  return (
                    <Pressable
                      key={photo.id}
                      onPress={() => goTo(i)}
                      accessibilityRole="button"
                      accessibilityLabel={`Photo ${i + 1} of ${photos.length}`}
                      accessibilityState={{ selected: i === page }}
                      style={[styles.thumb, i === page && styles.thumbOn]}
                    >
                      {url ? <Image source={{ uri: url }} style={styles.thumbImage} resizeMode="cover" /> : null}
                    </Pressable>
                  );
                })}
              </ScrollView>
            ) : null}

            <ScrollView style={styles.panelScroll} contentContainerStyle={styles.panelBody}>
              <View style={styles.titleRow}>
                <Text style={styles.title}>{item.event.title}</Text>
                {why ? <Text style={styles.why}>{why}</Text> : null}
              </View>
              {meta ? <Text style={styles.meta}>{meta}</Text> : null}

              {wentCount > 0 ? (
                <View style={styles.went}>
                  {went.length > 0 ? (
                    <View style={styles.faces}>
                      {went.slice(0, FACES_SHOWN).map((person, i) => (
                        <View key={person.id} style={[styles.face, i > 0 && styles.faceOver]}>
                          <Monogram name={person.name} uri={person.avatarUrl} size={24} />
                        </View>
                      ))}
                    </View>
                  ) : null}
                  <Text style={styles.wentText} numberOfLines={1}>
                    {wentLine(went, wentCount, userId)}
                  </Text>
                </View>
              ) : null}

              {item.event.description ? <Text style={styles.description}>{item.event.description}</Text> : null}

              <View style={styles.actions}>
                {REACTIONS.map((emoji) => {
                  const count = tally.counts[emoji] ?? 0;
                  const mine = tally.mine === emoji;
                  const [outline, filled] = REACTION_ICONS[emoji];
                  return (
                    <Pressable
                      key={emoji}
                      onPress={() => onReact(emoji)}
                      accessibilityRole="button"
                      accessibilityLabel={`React with ${REACTION_NAMES[emoji]}${count > 0 ? `, ${count}` : ''}${mine ? ', you reacted' : ''}`}
                      accessibilityState={{ selected: mine }}
                      style={({ pressed }) => [
                        styles.pill,
                        count === 0 && styles.pillRound,
                        mine && styles.pillMine,
                        pressed && styles.pillPressed,
                      ]}
                    >
                      <Ionicons name={mine ? filled : outline} size={18} color={mine ? colors.danger : colors.text} />
                      {count > 0 ? <Text style={[styles.count, mine && styles.countMine]}>{count}</Text> : null}
                    </Pressable>
                  );
                })}
              </View>

              {line ? (
                <Pressable
                  onPress={() => setReactorsOpen(true)}
                  accessibilityRole="button"
                  accessibilityLabel={`Reactions from ${line}. See everyone.`}
                  hitSlop={6}
                >
                  <Text style={styles.reactors} numberOfLines={2}>
                    <Text style={styles.strong}>{capitalize(line)}</Text> reacted
                    <Text style={styles.seeAll}> · See all</Text>
                  </Text>
                </Pressable>
              ) : (
                <Text style={styles.quiet}>Double tap a photo to leave the first fire.</Text>
              )}
            </ScrollView>
          </SafeAreaView>
        </View>

        {reactorsOpen ? (
          <View style={styles.sheetLayer}>
            <Pressable
              style={styles.sheetBackdrop}
              onPress={() => setReactorsOpen(false)}
              accessibilityRole="button"
              accessibilityLabel="Close reactions"
            />
            <SafeAreaView style={[styles.sheet, { width }]}>
              {/* Padding inside: an iPhone's SafeAreaView sets its own. */}
              <View style={styles.sheetInner}>
              <View style={styles.grabber} />
              <Text style={styles.sheetTitle}>Reactions</Text>
              <ScrollView contentContainerStyle={styles.sheetList}>
                {[...reactions].reverse().map((one) => {
                  const icons = REACTION_ICONS[one.emoji as keyof typeof REACTION_ICONS];
                  return (
                    <View key={one.userId} style={styles.reactor}>
                      <Monogram name={one.name} uri={one.avatarUrl} size={40} />
                      <View style={styles.reactorText}>
                        <Text style={styles.reactorName} numberOfLines={1}>
                          {one.userId === userId ? 'You' : one.name}
                        </Text>
                        {one.groupName ? (
                          <Text style={styles.reactorSquad} numberOfLines={1}>
                            {one.groupName}
                          </Text>
                        ) : null}
                      </View>
                      {icons ? (
                        <Ionicons name={icons[1]} size={20} color={colors.danger} />
                      ) : (
                        <Text style={styles.reactorEmoji}>{one.emoji}</Text>
                      )}
                    </View>
                  );
                })}
              </ScrollView>
              </View>
            </SafeAreaView>
          </View>
        ) : null}
      </View>
      <ReportSheet
        target={reporting}
        userId={userId}
        onClose={() => {
          setReporting(null);
          if (blockedHere) {
            setBlockedHere(false);
            onClose();
          }
        }}
        onBlocked={() => setBlockedHere(true)}
      />
    </Modal>
  );
}

// The member who took a photo, when they are among those who went.
function personOf(people: Person[], id: string, userId: string): Person | null {
  const found = people.find((person) => person.id === id);
  if (!found) return null;
  return id === userId ? { ...found, name: 'You' } : { ...found, name: firstName(found.name) };
}

// "Μαρία, Νίκος +3 went"
function wentLine(people: Person[], count: number, userId: string): string {
  const named = people.slice(0, 2).map((person) => (person.id === userId ? 'You' : firstName(person.name)));
  if (named.length === 0) return `${count} went`;
  const rest = count - named.length;
  return `${named.join(', ')}${rest > 0 ? ` +${rest}` : ''} went`;
}

function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] || name;
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

// "22:14"
function clock(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

// "Friday 2 October"
function dateLabel(dateStr: string): string | null {
  const d = parseDateKey(dateStr);
  if (!d) return null;
  return d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' }).replace(',', '');
}

// "Sun 27 Sep"
function shortDate(dateStr: string): string | null {
  const d = parseDateKey(dateStr);
  if (!d) return null;
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }).replace(',', '');
}

const styles = StyleSheet.create({
  screen: { flex: 1, alignItems: 'center', backgroundColor: onPhoto.black },
  column: { flex: 1 },
  pressed: { opacity: 0.6 },

  stage: { flex: 1, backgroundColor: onPhoto.black },
  photo: { backgroundColor: colors.ink, overflow: 'hidden' },
  topShade: { position: 'absolute', top: 0, left: 0, right: 0, height: 150 },
  top: { position: 'absolute', top: 0, left: 0, right: 0, paddingTop: STATUS_GAP },
  bars: { flexDirection: 'row', gap: 4, paddingHorizontal: space.md, paddingTop: space.sm },
  barSeg: { flex: 1, height: 3, borderRadius: 2, backgroundColor: onPhoto.track },
  barSegOn: { backgroundColor: onPhoto.text },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingHorizontal: space.sm + 2,
    paddingTop: space.sm,
  },
  round: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: onPhoto.glass },
  topText: { flex: 1, minWidth: 0, minHeight: 44, justifyContent: 'center' },
  topTitle: { color: colors.onInk, ...typo.display, fontSize: textSize.base },
  topSub: { color: onPhoto.soft, ...typo.medium, fontSize: textSize.small },
  by: {
    position: 'absolute',
    left: space.md,
    bottom: THUMB_LIFT + space.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    maxWidth: '70%',
    paddingVertical: 4,
    paddingLeft: 4,
    paddingRight: space.sm,
    borderRadius: radius.pill,
    backgroundColor: scrim.inkStrong,
  },
  byText: { flexShrink: 1, color: colors.onInk, ...typo.semi, fontSize: textSize.small },
  burstWrap: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },

  panel: {
    marginTop: -22,
    maxHeight: '46%',
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
    backgroundColor: colors.surface,
  },
  thumbs: { flexGrow: 0, marginTop: -THUMB_LIFT },
  thumbsInner: { gap: space.xs, paddingHorizontal: space.md },
  thumb: {
    width: THUMB,
    height: THUMB,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: colors.surface,
    backgroundColor: colors.surfaceAlt,
  },
  thumbOn: { borderColor: colors.primary },
  thumbImage: { width: '100%', height: '100%' },
  panelScroll: { flexGrow: 0 },
  panelBody: { paddingHorizontal: space.md, paddingTop: space.sm, paddingBottom: space.lg, gap: space.xs },

  titleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: space.xs },
  title: { flex: 1, color: colors.text, ...typo.display, fontSize: textSize.heading, letterSpacing: -0.3 },
  why: {
    overflow: 'hidden',
    marginTop: 3,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
    backgroundColor: '#E8EDFD',
    color: colors.primary,
    ...typo.bold,
    fontSize: textSize.caption,
  },
  meta: { color: colors.textSoft, ...typo.semi, fontSize: textSize.body },
  went: { flexDirection: 'row', alignItems: 'center', gap: space.xs, marginTop: space.xxs },
  faces: { flexDirection: 'row' },
  face: { borderRadius: 14, borderWidth: 2, borderColor: colors.surface },
  faceOver: { marginLeft: -8 },
  wentText: { flexShrink: 1, color: colors.textSoft, ...typo.medium, fontSize: textSize.body },
  description: { color: colors.text, ...typo.regular, fontSize: textSize.base, lineHeight: 20 },

  actions: { flexDirection: 'row', alignItems: 'center', gap: space.xs, marginTop: space.sm },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    height: 40,
    paddingHorizontal: 12,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  pillRound: { width: 40, paddingHorizontal: 0 },
  pillMine: { borderWidth: 1.5, borderColor: colors.danger, backgroundColor: tint.danger },
  pillPressed: { transform: [{ scale: 0.94 }] },
  count: { color: colors.text, ...typo.bold, fontSize: textSize.body },
  countMine: { color: colors.danger, ...typo.display },
  reactors: { color: colors.textSoft, ...typo.regular, fontSize: textSize.body, marginTop: space.xxs },
  strong: { color: colors.text, ...typo.display },
  seeAll: { color: colors.primary, ...typo.bold },
  quiet: { color: colors.textSoft, ...typo.medium, fontSize: textSize.body, marginTop: space.xxs },

  sheetLayer: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, alignItems: 'center', justifyContent: 'flex-end' },
  sheetBackdrop: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: scrim.sheet },
  sheet: {
    maxHeight: '70%',
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
    backgroundColor: colors.surface,
  },
  sheetInner: { flexShrink: 1, paddingHorizontal: space.md, paddingTop: space.sm },
  grabber: { alignSelf: 'center', width: 40, height: 5, borderRadius: 3, backgroundColor: colors.borderStrong },
  sheetTitle: { color: colors.text, ...typo.display, fontSize: textSize.lead, marginTop: space.sm, marginBottom: space.xs },
  sheetList: { paddingBottom: space.lg },
  reactor: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingVertical: space.xs + 2 },
  reactorText: { flex: 1, minWidth: 0 },
  reactorName: { color: colors.text, ...typo.bold, fontSize: textSize.base },
  reactorSquad: { color: colors.textSoft, ...typo.medium, fontSize: textSize.small },
  reactorEmoji: { fontSize: 20 },
});
