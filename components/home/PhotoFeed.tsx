import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Animated, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
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
  onOpenNight: (item: FeedPhoto) => void;
  onOpenGroup: (group: Group) => void;
  // Whether a parea's page can be opened at all; when not, its name is just a label.
  canOpenGroup?: (group: Group) => boolean;
  // Shown once the feed has loaded and there is nothing in it.
  empty?: ReactNode;
};

// Memories from your squad and the nights around it, newest first: one photo
// for each night that was kept, grouped by when it was.
export default function PhotoFeed({
  group,
  me,
  signed,
  signPaths,
  onImageError,
  reloadKey,
  onOpenNight,
  onOpenGroup,
  empty = null,
  canOpenGroup = () => true,
}: PhotoFeedProps) {
  const [items, setItems] = useState<FeedPhoto[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const [retry, setRetry] = useState(0);
  const [reactions, setReactions] = useState<Record<string, PhotoReaction[]>>({});
  const [shown, setShown] = useState(PAGE);
  const [reactorsOf, setReactorsOf] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const reactionsRef = useRef(reactions);
  reactionsRef.current = reactions;

  useEffect(() => {
    let cancelled = false;
    setFailed(false);

    getPhotoFeed(group.id)
      .then(async function (feed) {
        if (cancelled) return;
        setItems(feed);
        setLoaded(true);

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
  const paths = visible.map((item) => item.photo.path).join('|');

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

  return (
    <View>
      <View style={styles.list}>
        {visible.map((item, index) => {
          const when = whenLabel(item.event.date, today);
          const startsGroup = index === 0 || whenLabel(visible[index - 1].event.date, today) !== when;
          return (
            <View key={item.photo.id} style={styles.entry}>
              {startsGroup ? (
                <View style={styles.when} accessibilityRole="header">
                  <Text style={styles.whenText}>{when}</Text>
                  <View style={styles.whenRule} />
                </View>
              ) : null}
              <PhotoPost
                item={item}
                url={signed[item.photo.path]?.url}
                reactions={reactions[item.photo.id] ?? []}
                userId={me.id}
                onReact={(emoji) => react(item.photo.id, emoji)}
                onOpenNight={() => onOpenNight(item)}
                onOpenGroup={canOpenGroup(item.group) ? () => onOpenGroup(item.group) : undefined}
                onShowReactors={() => setReactorsOf(item.photo.id)}
                onImageError={() => onImageError(item.photo.path)}
              />
            </View>
          );
        })}
      </View>

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
        <Text style={styles.end}>That's every night from the last two months.</Text>
      )}

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

  when: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingHorizontal: space.lg, marginTop: space.xs },
  whenText: { color: colors.text, ...typo.title, fontSize: textSize.lead, letterSpacing: -0.2 },
  whenRule: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: colors.borderStrong },

  end: {
    alignSelf: 'center',
    marginTop: space.lg,
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
    marginTop: space.lg,
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
