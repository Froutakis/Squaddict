import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { SignedMap } from '../chat/media';
import { readJson, writeJson } from '../../lib/store';
import { dayMonth } from '../../lib/datetime';
import { colors, typo, radius, solidFor, space, textSize } from '../../theme';
import { initialsFor } from '../general/Monogram';
import SectionHead from '../general/SectionHead';
import StoryViewer from '../events/StoryViewer';
import { capture, messageFor, PhotoSourceSheet, type PhotoSource } from '../events/EventPhotos';
import {
  markSeen,
  nightLabel,
  pruneSeen,
  ringFor,
  seenNightsKey,
  type MemoryNight,
  type SeenNights,
} from './memories';

const BUBBLE = 66;

type MemoriesBarProps = {
  userId: string;
  title?: string;
  meta?: string;
  scope?: 'home' | 'explore';
  nights: MemoryNight[];
  groupSizes: Record<string, number>;
  signed: SignedMap;
  signPaths: (paths: string[]) => void;
  onImageError: (path: string) => void;
  onPhotosChanged?: () => void;
  onOpenGroup?: (night: MemoryNight) => void;
};

export default function MemoriesBar({
  userId,
  title = 'Nights filed',
  meta,
  scope = 'home',
  nights,
  groupSizes,
  signed,
  signPaths,
  onImageError,
  onPhotosChanged,
  onOpenGroup,
}: MemoriesBarProps) {
  const [seen, setSeen] = useState<SeenNights>({});
  const [loadedSeen, setLoadedSeen] = useState(false);
  // What the row hides. It only catches up with `seen` when the viewer closes,
  // so the list the viewer is walking through never shrinks under it.
  const [hidden, setHidden] = useState<SeenNights>({});
  const [open, setOpen] = useState<number | null>(null);
  const [adding, setAdding] = useState<MemoryNight | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const seenRef = useRef<SeenNights>({});
  seenRef.current = seen;
  const nightsRef = useRef<MemoryNight[]>(nights);
  nightsRef.current = nights;

  useEffect(() => {
    let cancelled = false;

    readJson<SeenNights>(seenNightsKey(userId, scope)).then(function (stored) {
      if (cancelled) return;
      if (stored) {
        setSeen(stored);
        setHidden(stored);
      }
      setLoadedSeen(true);
    });

    return function cleanup() {
      cancelled = true;
    };
  }, [userId, scope]);

  const handleSeen = useCallback(function handleSeen(eventId: string) {
    setSeen(function (prev) {
      return markSeen(prev, eventId);
    });
  }, []);

  const closeViewer = useCallback(
    function closeViewer() {
      const kept = pruneSeen(seenRef.current, nightsRef.current);
      setOpen(null);
      setHidden(kept);
      writeJson(seenNightsKey(userId, scope), kept);
    },
    [userId, scope],
  );

  const handleAddYours = useCallback(
    function handleAddYours(night: MemoryNight) {
      closeViewer();
      setError(null);
      setAdding(night);
    },
    [closeViewer],
  );

  const handleOpenGroup = useCallback(
    function handleOpenGroup(night: MemoryNight) {
      closeViewer();
      onOpenGroup?.(night);
    },
    [closeViewer, onOpenGroup],
  );

  async function pick(source: PhotoSource, inExplore: boolean) {
    if (!adding || busy) return;

    setBusy(true);
    setError(null);

    try {
      const result = await capture(source, {
        id: adding.event.id,
        groupId: adding.event.groupId,
      }, inExplore);
      setAdding(null);
      if (result) onPhotosChanged?.();
    } catch (problem) {
      setError(messageFor(problem));
      setAdding(null);
    } finally {
      setBusy(false);
    }
  }

  const unseen = useMemo(
    () => nights.filter((night) => !hidden[night.event.id]),
    [nights, hidden],
  );

  if (!loadedSeen || unseen.length === 0) return null;

  return (
    <View>
      <SectionHead title={title} meta={meta} />

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
      >
        {unseen.map(function (night, index) {
          const url = signed[night.cover.path]?.url;
          const watched = Boolean(seen[night.event.id]);

          return (
            <Pressable
              key={night.event.id}
              onPress={function () {
                setOpen(index);
              }}
              accessibilityRole="button"
              accessibilityLabel={nightLabel(night, watched)}
              accessibilityHint="Opens the photos from that night"
              style={({ pressed }) => [styles.bubble, pressed && styles.pressed]}
            >
              <View style={[styles.ring, { borderColor: ringFor(night, watched) }]}>
                {url ? (
                  <Image
                    source={{ uri: url }}
                    style={styles.cover}
                    resizeMode="cover"
                    onError={function () {
                      onImageError(night.cover.path);
                    }}
                  />
                ) : (
                  <View style={[styles.cover, styles.blank, { backgroundColor: solidFor(night.event.groupName) }]}>
                    <Text style={styles.blankText}>{initialsFor(night.event.groupName)}</Text>
                  </View>
                )}
              </View>

              <Text style={[styles.name, watched && styles.nameSeen]} numberOfLines={1}>
                {night.event.groupName}
              </Text>
              <Text style={styles.stamp}>{dayMonth(night.event.date)}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <StoryViewer
        key={open ?? 'closed'}
        visible={open !== null}
        nights={unseen}
        startIndex={open ?? 0}
        groupSizes={groupSizes}
        signed={signed}
        signPaths={signPaths}
        onImageError={onImageError}
        onSeen={handleSeen}
        onAddYours={handleAddYours}
        onOpenGroup={onOpenGroup ? handleOpenGroup : undefined}
        onClose={closeViewer}
      />

      <PhotoSourceSheet
        visible={adding !== null}
        shareable={adding?.event.isPublic === true}
        onClose={function () {
          if (!busy) setAdding(null);
        }}
        onPick={pick}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { gap: space.sm, paddingHorizontal: space.lg, paddingVertical: 2 },
  bubble: { width: 74, alignItems: 'center', gap: 5 },
  pressed: { opacity: 0.7 },
  ring: {
    width: BUBBLE,
    height: BUBBLE,
    borderRadius: radius.pill,
    borderWidth: 2.5,
    padding: 2.5,
  },
  cover: { flex: 1, borderRadius: radius.pill },
  blank: { alignItems: 'center', justifyContent: 'center' },
  blankText: { color: '#FFFFFF', ...typo.semi, fontSize: textSize.base },
  name: { maxWidth: 74, color: colors.text, ...typo.semi, fontSize: textSize.caption },
  nameSeen: { color: colors.textSoft, ...typo.medium },
  stamp: { color: colors.textFaint, ...typo.mono, fontSize: textSize.micro },
  error: {
    paddingHorizontal: space.lg,
    paddingTop: space.xs,
    color: colors.danger,
    ...typo.medium,
    fontSize: textSize.small,
  },
});
