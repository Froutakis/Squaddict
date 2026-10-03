import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Animated, Modal, Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import type { Group } from '../../services/serviceGroup';
import {
  clearPhotoReaction,
  getPhotoFeed,
  getPhotoReactions,
  setPhotoReaction,
  type FeedPhoto,
} from '../../services/servicePhotoFeed';
import { applyReaction, type PhotoReaction, type Reactor } from '../../lib/photoFeed';
import { parseDateKey, startOfWeek } from '../../lib/datetime';
import type { SignedMap } from '../chat/media';
import Monogram from '../general/Monogram';
import PhotoPost from './PhotoPost';
import PostViewer from './PostViewer';
import { AgainCard, ThrowbackCard } from './FeedCards';
import { DateNode, GroupNode, GroupTitle, TimelineRow } from './Timeline';
import { readJson, writeJson } from '../../lib/store';
import { colors, radius, shadow, space, textSize, typo } from '../../theme';

const PAGE = 10;

type PhotoFeedProps = {
  // The squad you are looking at: its photos, the squads it follows, and the
  // name your reactions go out under.
  group: Group;
  me: { id: string; name: string; avatarUrl: string | null };
  signed: SignedMap;
  signPaths: (paths: string[]) => void;
  onImageError: (path: string) => void;
  // Bump to reload, e.g. after a photo was added.
  reloadKey: number;
  onOpenGroup: (group: Group) => void;
  // Whether a parea's page can be opened at all; when not, its name is just a label.
  canOpenGroup?: (group: Group) => boolean;
  // Shown once the feed has loaded and there is nothing in it.
  empty?: ReactNode;
  // "Plan it again" on a night that went well.
  onPlanAgain?: (item: FeedPhoto) => void;
};

// Between the memories: the first card after the 2nd post, then one every 4.
const FIRST_CARD_AFTER = 2;
const CARD_EVERY = 4;
// A night of yours is worth repeating once it has this many reactions.
const AGAIN_REACTIONS = 3;
// Before the first visit, the last week counts as new.
const FIRST_VISIT_DAYS = 7;
const seenKey = (groupId: string) => `squaddict.memoriesSeen.${groupId}`;
const FLUSH = { marginHorizontal: 0 };

// Memories from your squad and the nights around it, newest first: one photo
// for each night that was kept, grouped by when it was.
export default function PhotoFeed({
  group,
  me,
  signed,
  signPaths,
  onImageError,
  reloadKey,
  onOpenGroup,
  empty = null,
  canOpenGroup = () => true,
  onPlanAgain,
}: PhotoFeedProps) {
  const [items, setItems] = useState<FeedPhoto[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const [retry, setRetry] = useState(0);
  const [reactions, setReactions] = useState<Record<string, PhotoReaction[]>>({});
  const [shown, setShown] = useState(PAGE);
  const [reactorsOf, setReactorsOf] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // The post opened full screen.
  const [openPost, setOpenPost] = useState<FeedPhoto | null>(null);
  // Photos added after this were not on screen the last time you looked.
  const [seenUntil, setSeenUntil] = useState<string | null>(null);
  const reactionsRef = useRef(reactions);
  reactionsRef.current = reactions;

  useEffect(() => {
    let cancelled = false;
    setFailed(false);

    Promise.all([getPhotoFeed(group.id), readJson<string>(seenKey(group.id))])
      .then(async function ([feed, seen]) {
        if (cancelled) return;
        const firstVisit = new Date(Date.now() - FIRST_VISIT_DAYS * 24 * 60 * 60 * 1000).toISOString();
        setSeenUntil(seen ?? firstVisit);
        setItems(feed);
        setLoaded(true);
        const newest = feed.reduce((max, item) => (item.photo.createdAt > max ? item.photo.createdAt : max), seen ?? '');
        if (newest !== '') writeJson(seenKey(group.id), newest);

        const byPhoto = await getPhotoReactions(feed.map((item) => item.photo.id)).catch(() => ({}));
        if (!cancelled) setReactions(byPhoto);
      })
      .catch(function () {
        if (cancelled) return;
        setItems([]);
        setFailed(true);
        setLoaded(true);
      });

    return function cleanup() {
      cancelled = true;
    };
  }, [group.id, reloadKey, retry]);

  useEffect(() => {
    setShown(PAGE);
    setLoaded(false);
  }, [group.id]);

  const visible = items.slice(0, shown);

  // The nudges between the memories.
  const now = new Date();
  const again = onPlanAgain
    ? items
        .filter((item) => item.reason === 'yours' && between(daysAgo(item.event.date, now), 1, 45))
        .map((item) => ({ item, count: (reactions[item.photo.id] ?? []).length }))
        .filter((one) => one.count >= AGAIN_REACTIONS)
        .sort((a, b) => b.count - a.count)[0]
    : undefined;
  const throwback = pickThrowback(items, now, again?.item.photo.id);
  // Each card, with what it puts on the line (a throwback sits on its date).
  const cards: { key: string; node?: ReactNode; card: ReactNode }[] = [];
  if (again) {
    cards.push({
      key: 'again',
      card: (
      <AgainCard
        item={again.item}
        url={signed[again.item.photo.path]?.url}
        reactions={again.count}
        onPlanAgain={() => onPlanAgain?.(again.item)}
        style={FLUSH}
      />
      ),
    });
  }
  if (throwback) {
    cards.push({
      key: 'throwback',
      node: <DateNode date={throwback.item.event.date} kind="seen" />,
      card: (
        <ThrowbackCard
          item={throwback.item}
          url={signed[throwback.item.photo.path]?.url}
          ago={throwback.ago}
          fires={(reactions[throwback.item.photo.id] ?? []).length}
          onOpen={() => setOpenPost(throwback.item)}
          style={FLUSH}
        />
      ),
    });
  }
  const cardAfter = (index: number) =>
    index + 1 >= FIRST_CARD_AFTER && (index + 1 - FIRST_CARD_AFTER) % CARD_EVERY === 0
      ? cards[(index + 1 - FIRST_CARD_AFTER) / CARD_EVERY] ?? null
      : null;
  const placed = visible.filter((_, index) => cardAfter(index) !== null).length;
  // A short feed still gets its cards, at the end.
  const leftover = items.length > shown ? [] : cards.slice(placed);
  const cardRow = (one: (typeof cards)[number], enterIndex?: number) => (
    <TimelineRow solid key={one.key} node={one.node} enterIndex={enterIndex}>
      {one.card}
    </TimelineRow>
  );

  const paths = [
    ...visible.flatMap((item) => [item.photo.path, ...item.more.map((photo) => photo.path)]),
    ...(again ? [again.item.photo.path] : []),
    ...(throwback ? [throwback.item.photo.path] : []),
  ].join('|');

  useEffect(() => {
    if (paths !== '') signPaths(paths.split('|'));
  }, [paths, signed, signPaths]);

  async function react(photoId: string, emoji: string) {
    const before = reactionsRef.current[photoId] ?? [];
    const reactor: Reactor = {
      userId: me.id,
      name: me.name,
      avatarUrl: me.avatarUrl,
      groupId: group.id,
      groupName: group.name,
    };
    const after = applyReaction(before, photoId, reactor, emoji);
    const removing = after.length < before.length;

    setError(null);
    setReactions((all) => ({ ...all, [photoId]: after }));

    try {
      if (removing) await clearPhotoReaction(photoId);
      else await setPhotoReaction(photoId, group.id, emoji);
    } catch {
      setReactions((all) => ({ ...all, [photoId]: before }));
      setError('Could not save your reaction. Try again.');
    }
  }

  if (!loaded) return <FeedSkeleton />;

  if (failed) {
    return (
      <View style={styles.problem}>
        <Text style={styles.problemTitle}>Couldn't load your memories</Text>
        <Text style={styles.problemBody}>Check the connection and try again. Nothing was lost.</Text>
        <Pressable
          onPress={() => setRetry((n) => n + 1)}
          accessibilityRole="button"
          accessibilityLabel="Try loading the memories again"
          style={({ pressed }) => [styles.retry, pressed && styles.pressedDown]}
        >
          <Text style={styles.retryText}>Try again</Text>
        </Pressable>
      </View>
    );
  }

  if (items.length === 0) return <>{empty}</>;

  const reactors = reactorsOf ? reactions[reactorsOf] ?? [] : [];
  const today = new Date();

  // How many nights, and how many fires, in each stretch of time.
  const groups = new Map<string, { nights: number; fires: number }>();
  for (const item of visible) {
    const when = whenLabel(item.event.date, today);
    const one = groups.get(when) ?? { nights: 0, fires: 0 };
    one.nights += 1;
    one.fires += (reactions[item.photo.id] ?? []).length;
    groups.set(when, one);
  }

  return (
    <View>
      {visible.map((item, index) => {
        const when = whenLabel(item.event.date, today);
        const startsGroup = index === 0 || whenLabel(visible[index - 1].event.date, today) !== when;
        const counts = groups.get(when);
        const enterIndex = index % PAGE;
        const card = cardAfter(index);
        const other = item.group.id !== group.id;
        const fresh = seenUntil !== null && item.photo.createdAt > seenUntil;
        return (
          <View key={item.photo.id}>
            {startsGroup ? (
              <TimelineRow solid node={<GroupNode />} enterIndex={enterIndex}>
                <GroupTitle
                  kicker={when}
                  title={counts && counts.nights === 1 ? 'One night out' : `${counts?.nights ?? 0} nights out`}
                  meta={counts && counts.fires > 0 ? `${counts.fires} ${counts.fires === 1 ? 'fire' : 'fires'}` : undefined}
                />
              </TimelineRow>
            ) : null}
            <TimelineRow
              enterIndex={enterIndex}
              node={
                <DateNode
                  date={item.event.date}
                  kind={other ? 'parea' : fresh ? 'new' : 'seen'}
                  parea={other ? { name: item.group.name, avatarUrl: item.group.avatarUrl } : undefined}
                />
              }
            >
              <PhotoPost
                item={item}
                url={signed[item.photo.path]?.url}
                reactions={reactions[item.photo.id] ?? []}
                userId={me.id}
                onReact={(emoji) => react(item.photo.id, emoji)}
                onOpenNight={() => setOpenPost(item)}
                onOpenGroup={canOpenGroup(item.group) ? () => onOpenGroup(item.group) : undefined}
                onShowReactors={() => setReactorsOf(item.photo.id)}
                onImageError={() => onImageError(item.photo.path)}
                moreUrls={item.more.map((photo) => signed[photo.path]?.url)}
                fresh={fresh}
                onShare={() => shareNight(item)}
                style={FLUSH}
              />
            </TimelineRow>
            {card ? cardRow(card, enterIndex) : null}
          </View>
        );
      })}
      {leftover.map((card) => cardRow(card))}

      {error ? (
        <Text style={styles.error} accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : null}

      {items.length > shown ? (
        <Pressable
          onPress={() => setShown(shown + PAGE)}
          accessibilityRole="button"
          accessibilityLabel="Show earlier memories"
          style={({ pressed }) => [styles.more, pressed && styles.pressedDown]}
        >
          <Text style={styles.moreText}>Show earlier nights</Text>
        </Pressable>
      ) : (
        <TimelineRow solid node={<View style={styles.endDot} />}>
          <Text style={styles.end}>That's every night from the last two months. Keep the line going.</Text>
        </TimelineRow>
      )}

      <PostViewer
        item={openPost}
        reactions={openPost ? reactions[openPost.photo.id] ?? [] : []}
        userId={me.id}
        signed={signed}
        signPaths={signPaths}
        onImageError={onImageError}
        onReact={(emoji) => openPost && react(openPost.photo.id, emoji)}
        onShowReactors={() => openPost && setReactorsOf(openPost.photo.id)}
        onShare={() => openPost && shareNight(openPost)}
        onOpenGroup={
          openPost && canOpenGroup(openPost.group)
            ? () => {
                const target = openPost.group;
                setOpenPost(null);
                onOpenGroup(target);
              }
            : undefined
        }
        onClose={() => setOpenPost(null)}
      />

      <Modal
        visible={reactorsOf !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setReactorsOf(null)}
      >
        <Pressable
          style={styles.backdrop}
          onPress={() => setReactorsOf(null)}
          accessibilityLabel="Close reactions"
        >
          <Pressable style={styles.sheet} onPress={() => {}}>
            <View style={styles.grabber} />
            <Text style={styles.sheetTitle}>Reactions</Text>

            <ScrollView>
              {[...reactors].reverse().map((one) => (
                <View key={one.userId} style={styles.row}>
                  <Monogram name={one.name} uri={one.avatarUrl} size={40} />
                  <View style={styles.rowText}>
                    <Text style={styles.rowName} numberOfLines={1}>
                      {one.userId === me.id ? 'You' : one.name}
                    </Text>
                    {one.groupName ? (
                      <Text style={styles.rowSquad} numberOfLines={1}>
                        {one.groupName}
                      </Text>
                    ) : null}
                  </View>
                  <Text style={styles.rowEmoji}>{one.emoji}</Text>
                </View>
              ))}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

// The night as a ticket in words, for the share sheet.
function shareNight(item: FeedPhoto) {
  const d = parseDateKey(item.event.date);
  const when = d ? d.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short' }) : '';
  const place = item.event.placeLabel ?? item.event.location;
  Share.share({
    message: `${item.event.title}
${[item.group.name, place, when].filter(Boolean).join(' · ')}
One of our nights on Squaddict.`,
  }).catch(() => {});
}

function daysAgo(dateStr: string, now: Date): number {
  const d = parseDateKey(dateStr);
  if (!d) return -1;
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((today.getTime() - d.getTime()) / (24 * 60 * 60 * 1000));
}

function between(value: number, low: number, high: number) {
  return value >= low && value <= high;
}

// A night that comes back on its day: a year ago if there is one, else a month.
function pickThrowback(items: FeedPhoto[], now: Date, skipPhotoId?: string) {
  const mine = items.filter((item) => item.reason === 'yours' && item.photo.id !== skipPhotoId);
  const year = mine.find((item) => between(daysAgo(item.event.date, now), 362, 368));
  if (year) return { item: year, ago: onTheDay(year, now) ? 'One year ago today' : 'One year ago' };
  const month = mine.find((item) => between(daysAgo(item.event.date, now), 27, 34));
  if (month) return { item: month, ago: onTheDay(month, now) ? 'One month ago today' : 'One month ago' };
  return null;
}

function onTheDay(item: FeedPhoto, now: Date) {
  return parseDateKey(item.event.date)?.getDate() === now.getDate();
}

// "This week", "Last week", then the month: "September".
function whenLabel(dateStr: string, today: Date): string {
  const d = parseDateKey(dateStr);
  if (!d) return 'Earlier';
  const week = startOfWeek(today).getTime();
  if (d.getTime() >= week) return 'This week';
  if (d.getTime() >= week - 7 * 24 * 60 * 60 * 1000) return 'Last week';
  const month = d.toLocaleDateString('en-US', { month: 'long' });
  return d.getFullYear() === today.getFullYear() ? month : `${month} ${d.getFullYear()}`;
}

// Two quiet cards in the shape of a post, while the feed loads.
function FeedSkeleton() {
  const pulse = useRef(new Animated.Value(0.55)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.55, duration: 700, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  return (
    <View style={styles.list} accessibilityLabel="Loading memories" accessibilityRole="progressbar">
      {[0, 1].map((key) => (
        <Animated.View key={key} style={[styles.ghost, { opacity: pulse }]}>
          <View style={styles.ghostHead}>
            <View style={styles.ghostAvatar} />
            <View style={styles.ghostLines}>
              <View style={[styles.ghostLine, { width: '45%' }]} />
              <View style={[styles.ghostLine, { width: '70%' }]} />
            </View>
          </View>
          <View style={styles.ghostPhoto} />
          <View style={styles.ghostPills}>
            {[0, 1, 2, 3].map((pill) => (
              <View key={pill} style={styles.ghostPill} />
            ))}
          </View>
        </Animated.View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: space.lg, paddingTop: space.xs },
  entry: { gap: space.sm },
  pressed: { opacity: 0.6 },
  pressedDown: { transform: [{ scale: 0.97 }] },

  endDot: { width: 10, height: 10, marginTop: 4, borderRadius: 5, backgroundColor: colors.borderStrong },
  end: {
    paddingTop: 1,
    color: colors.textSoft,
    ...typo.medium,
    fontSize: textSize.body,
  },

  problem: { marginHorizontal: space.md, padding: space.lg, gap: space.xs, borderRadius: radius.xl, backgroundColor: colors.surface, ...shadow.card },
  problemTitle: { color: colors.text, ...typo.title, fontSize: textSize.lead },
  problemBody: { color: colors.textSoft, ...typo.medium, fontSize: textSize.body, lineHeight: 19 },
  retry: {
    alignSelf: 'flex-start',
    marginTop: space.sm,
    minHeight: 44,
    paddingHorizontal: space.md,
    justifyContent: 'center',
    borderRadius: radius.md,
    backgroundColor: colors.ink,
  },
  retryText: { color: colors.onInk, ...typo.semi, fontSize: textSize.base },

  ghost: { marginHorizontal: space.md, borderRadius: radius.xl, backgroundColor: colors.surface, overflow: 'hidden' },
  ghostHead: { flexDirection: 'row', alignItems: 'center', gap: space.sm, padding: 14 },
  ghostAvatar: { width: 36, height: 36, borderRadius: 12, backgroundColor: colors.surfaceAlt },
  ghostLines: { flex: 1, gap: 6 },
  ghostLine: { height: 10, borderRadius: 5, backgroundColor: colors.surfaceAlt },
  ghostPhoto: { aspectRatio: 0.8, backgroundColor: colors.surfaceAlt },
  ghostPills: { flexDirection: 'row', gap: space.xs, padding: 12 },
  ghostPill: { width: 38, height: 38, borderRadius: radius.pill, backgroundColor: colors.surfaceAlt },
  error: {
    paddingHorizontal: space.lg,
    paddingTop: space.sm,
    color: colors.danger,
    ...typo.medium,
    fontSize: textSize.body,
  },
  more: {
    marginHorizontal: space.md,
    marginTop: space.xs,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    ...shadow.card,
  },
  moreText: { color: colors.text, ...typo.semi, fontSize: textSize.base },

  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: {
    maxHeight: '70%',
    paddingHorizontal: space.lg,
    paddingTop: space.sm,
    paddingBottom: space.xl,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    backgroundColor: colors.surface,
  },
  grabber: {
    width: 40,
    height: 4,
    alignSelf: 'center',
    marginBottom: space.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.borderStrong,
  },
  sheetTitle: {
    color: colors.text,
    ...typo.semi,
    fontSize: textSize.lead,
    textAlign: 'center',
    marginBottom: space.sm,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: 56 },
  rowText: { flex: 1, minWidth: 0 },
  rowName: { color: colors.text, ...typo.semi, fontSize: textSize.base },
  rowSquad: { color: colors.textSoft, ...typo.regular, fontSize: textSize.small },
  rowEmoji: { fontSize: 22 },
});
