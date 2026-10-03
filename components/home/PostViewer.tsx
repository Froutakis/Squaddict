import { useEffect, useRef, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import {
  Animated,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { getEventPhotos, type EventPhoto } from '../../services/serviceEvents';
import type { FeedPhoto } from '../../services/servicePhotoFeed';
import {
  QUICK_REACTION,
  REACTIONS,
  postRatio,
  reactorsLine,
  tallyReactions,
  type PhotoReaction,
} from '../../lib/photoFeed';
import { parseDateKey } from '../../lib/datetime';
import type { SignedMap } from '../chat/media';
import Monogram from '../general/Monogram';
import { REACTION_ICONS, REACTION_NAMES, whyLabel } from './PhotoPost';
import { shortPlace } from './LineTicket';
import { colors, layout, radius, space, textSize, tint, typo } from '../../theme';

const DOUBLE_TAP_MS = 260;

type PostViewerProps = {
  // The post that is open; null when closed.
  item: FeedPhoto | null;
  reactions: PhotoReaction[];
  userId: string;
  signed: SignedMap;
  signPaths: (paths: string[]) => void;
  onImageError: (path: string) => void;
  onReact: (emoji: string) => void;
  onShowReactors: () => void;
  onShare: () => void;
  onOpenGroup?: () => void;
  onClose: () => void;
};

// A night opened like a post: the parea on top, every photo of the night to
// swipe through, then the reactions, and what the night was.
export default function PostViewer({
  item,
  reactions,
  userId,
  signed,
  signPaths,
  onImageError,
  onReact,
  onShowReactors,
  onShare,
  onOpenGroup,
  onClose,
}: PostViewerProps) {
  const { width: screen } = useWindowDimensions();
  const width = Math.min(screen, layout.column);
  const [photos, setPhotos] = useState<EventPhoto[]>([]);
  const [page, setPage] = useState(0);
  const lastTap = useRef(0);
  const burst = useRef(new Animated.Value(0)).current;

  // The post's own photos right away; the whole night once it has loaded,
  // starting from the photo that was on the post.
  useEffect(() => {
    if (!item) return;
    let cancelled = false;
    setPhotos([item.photo, ...item.more]);
    setPage(0);

    getEventPhotos(item.event.id)
      .then((all) => {
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

  if (!item) return null;

  const tally = tallyReactions(reactions, userId);
  const line = reactorsLine(reactions, userId);
  const why = whyLabel(item.reason, item.via);
  const place = shortPlace(item.event.placeLabel ?? item.event.location);
  const height = width / postRatio(item.photo.width, item.photo.height);
  const total = Math.max(item.photoCount, photos.length);
  const meta = [dateLabel(item.event.date), place, item.wentCount > 1 ? `${item.wentCount} went` : null]
    .filter(Boolean)
    .join(' · ');

  function onScroll(event: NativeSyntheticEvent<NativeScrollEvent>) {
    const next = Math.round(event.nativeEvent.contentOffset.x / width);
    if (next !== page) setPage(next);
  }

  function tapPhoto() {
    const now = Date.now();
    if (now - lastTap.current < DOUBLE_TAP_MS) {
      lastTap.current = 0;
      burst.setValue(0);
      Animated.sequence([
        Animated.spring(burst, { toValue: 1, friction: 5, tension: 140, useNativeDriver: true }),
        Animated.timing(burst, { toValue: 0, duration: 220, delay: 260, useNativeDriver: true }),
      ]).start();
      if (tally.mine !== QUICK_REACTION) onReact(QUICK_REACTION);
      return;
    }
    lastTap.current = now;
  }

  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <View style={styles.screen}>
        <View style={[styles.column, { width }]}>
          <View style={styles.bar}>
            <Pressable
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Back to the memories"
              hitSlop={10}
              style={({ pressed }) => [styles.back, pressed && styles.pressed]}
            >
              <Ionicons name="chevron-back" size={24} color={colors.text} />
            </Pressable>
            <Pressable
              onPress={onOpenGroup}
              disabled={!onOpenGroup}
              accessibilityRole={onOpenGroup ? 'button' : undefined}
              accessibilityLabel={onOpenGroup ? `Open ${item.group.name}` : undefined}
              style={({ pressed }) => [styles.who, pressed && onOpenGroup && styles.pressed]}
            >
              <Monogram name={item.group.name} uri={item.group.avatarUrl} size={34} style={styles.avatar} />
              <View style={styles.whoText}>
                <Text style={styles.groupName} numberOfLines={1}>
                  {item.group.name}
                </Text>
                {place ? (
                  <Text style={styles.place} numberOfLines={1}>
                    {place}
                  </Text>
                ) : null}
              </View>
            </Pressable>
          </View>

          <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollBody}>
            <View style={{ width, height }}>
              <ScrollView
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
                      style={[styles.photo, { width, height }]}
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

              {photos.length > 1 ? (
                <Text style={styles.counter}>
                  {page + 1}/{photos.length}
                </Text>
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

            {photos.length > 1 ? (
              <View style={styles.dots} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
                {photos.slice(0, 12).map((photo, i) => (
                  <View key={photo.id} style={[styles.dot, i === page && styles.dotOn]} />
                ))}
              </View>
            ) : null}

            <View style={styles.body}>
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
                <Pressable
                  onPress={onShare}
                  accessibilityRole="button"
                  accessibilityLabel="Share this night as a ticket"
                  style={({ pressed }) => [styles.share, pressed && styles.pillPressed]}
                >
                  <Ionicons name="share-outline" size={16} color={colors.onInk} />
                  <Text style={styles.shareText}>Share</Text>
                </Pressable>
              </View>

              {line ? (
                <Pressable
                  onPress={onShowReactors}
                  accessibilityRole="button"
                  accessibilityLabel={`Reactions from ${line}. See everyone.`}
                  hitSlop={6}
                >
                  <Text style={styles.reactors} numberOfLines={2}>
                    Reactions from <Text style={styles.strong}>{line}</Text>
                  </Text>
                </Pressable>
              ) : (
                <Text style={styles.quiet}>Double tap a photo to leave the first fire.</Text>
              )}

              <View style={styles.titleRow}>
                <Text style={styles.title}>{item.event.title}</Text>
                {why ? <Text style={styles.why}>{why}</Text> : null}
              </View>
              <Text style={styles.meta}>{meta}</Text>
              {item.event.description ? <Text style={styles.description}>{item.event.description}</Text> : null}
              <Text style={styles.count2}>
                {total} {total === 1 ? 'photo' : 'photos'} from the night
              </Text>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

// "Friday 2 October"
function dateLabel(dateStr: string): string | null {
  const d = parseDateKey(dateStr);
  if (!d) return null;
  return d.toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long' }).replace(',', '');
}

const styles = StyleSheet.create({
  screen: { flex: 1, alignItems: 'center', backgroundColor: colors.surface },
  column: { flex: 1 },
  pressed: { opacity: 0.6 },

  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    minHeight: 56,
    paddingHorizontal: space.xs,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  back: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  who: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: 44 },
  avatar: { borderRadius: 11 },
  whoText: { flex: 1, minWidth: 0 },
  groupName: { color: colors.text, ...typo.display, fontSize: textSize.base },
  place: { color: colors.textSoft, ...typo.medium, fontSize: textSize.small },

  scroll: { flex: 1 },
  scrollBody: { paddingBottom: space.xl },
  photo: { backgroundColor: colors.surfaceAlt, overflow: 'hidden' },
  counter: {
    position: 'absolute',
    top: 12,
    right: 12,
    overflow: 'hidden',
    color: '#FFFFFF',
    backgroundColor: 'rgba(12,25,38,0.55)',
    ...typo.semi,
    fontSize: textSize.small,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: radius.pill,
  },
  burstWrap: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 4, paddingTop: space.sm },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.borderStrong },
  dotOn: { backgroundColor: colors.primary },

  body: { paddingHorizontal: space.md, paddingTop: space.sm, gap: space.xs },
  actions: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
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
  share: {
    marginLeft: 'auto',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 40,
    paddingHorizontal: 14,
    borderRadius: radius.pill,
    backgroundColor: colors.ink,
  },
  shareText: { color: colors.onInk, ...typo.bold, fontSize: textSize.body },
  reactors: { color: colors.text, ...typo.regular, fontSize: textSize.body },
  strong: { ...typo.display },
  quiet: { color: colors.textSoft, ...typo.medium, fontSize: textSize.body },

  titleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: space.xs, marginTop: space.xs },
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
  description: { color: colors.text, ...typo.regular, fontSize: textSize.base, lineHeight: 20, marginTop: space.xxs },
  count2: { color: colors.textFaint, ...typo.medium, fontSize: textSize.small, marginTop: space.xxs },
});
