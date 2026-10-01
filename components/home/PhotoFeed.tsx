import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { Group } from '../../services/serviceGroup';
import {
  clearPhotoReaction,
  getPhotoFeed,
  getPhotoReactions,
  setPhotoReaction,
  type FeedPhoto,
} from '../../services/servicePhotoFeed';
import { applyReaction, type PhotoReaction, type Reactor } from '../../lib/photoFeed';
import type { SignedMap } from '../chat/media';
import Monogram from '../general/Monogram';
import SectionHead from '../general/SectionHead';
import PhotoPost from './PhotoPost';
import { colors, radius, space, textSize, typo } from '../../theme';

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

// Memories from your squad and the squads it follows, newest first: one
// photo for each night that was kept.
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
  const [reactions, setReactions] = useState<Record<string, PhotoReaction[]>>({});
  const [shown, setShown] = useState(PAGE);
  const [reactorsOf, setReactorsOf] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const reactionsRef = useRef(reactions);
  reactionsRef.current = reactions;

  useEffect(() => {
    let cancelled = false;

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
        setLoaded(true);
      });

    return function cleanup() {
      cancelled = true;
    };
  }, [group.id, reloadKey]);

  useEffect(() => {
    setShown(PAGE);
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

  if (items.length === 0) return loaded ? <>{empty}</> : null;

  const reactors = reactorsOf ? reactions[reactorsOf] ?? [] : [];

  return (
    <View>
      <SectionHead title="Memories" meta="yours and the nights around you" />

      <View style={styles.list}>
        {visible.map((item) => (
          <PhotoPost
            key={item.photo.id}
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
        ))}
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
          accessibilityLabel="Show more memories"
          style={({ pressed }) => [styles.more, pressed && styles.pressed]}
        >
          <Text style={styles.moreText}>Show more</Text>
        </Pressable>
      ) : null}

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

const styles = StyleSheet.create({
  list: { gap: space.md },
  pressed: { opacity: 0.6 },
  error: {
    paddingHorizontal: space.lg,
    paddingTop: space.sm,
    color: colors.danger,
    ...typo.medium,
    fontSize: textSize.body,
  },
  more: { alignSelf: 'center', minHeight: 44, justifyContent: 'center', paddingHorizontal: space.md, marginTop: space.xs },
  moreText: { color: colors.primary, ...typo.semi, fontSize: textSize.base },

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
