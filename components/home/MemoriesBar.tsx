import { useCallback, useEffect, useRef, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { SignedMap } from '../chat/media';
import { readJson, writeJson } from '../../lib/store';
import { dayMonth } from '../../lib/datetime';
import { colors, font, radius, solidFor, space, textSize } from '../../theme';
import { initialsFor } from '../general/GradientAvatar';
import SectionLabel from '../general/SectionLabel';
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
  nights: MemoryNight[];
  groupSizes: Record<string, number>;
  signed: SignedMap;
  signPaths: (paths: string[]) => void;
  onImageError: (path: string) => void;
  onPhotosChanged: () => void;
};

export default function MemoriesBar({
  userId,
  nights,
  groupSizes,
  signed,
  signPaths,
  onImageError,
  onPhotosChanged,
}: MemoriesBarProps) {
  const [seen, setSeen] = useState<SeenNights>({});
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

    readJson<SeenNights>(seenNightsKey(userId)).then(function (stored) {
      if (!cancelled && stored) setSeen(stored);
    });

    return function cleanup() {
      cancelled = true;
    };
  }, [userId]);

  const handleSeen = useCallback(function handleSeen(eventId: string) {
    setSeen(function (prev) {
      return markSeen(prev, eventId);
    });
  }, []);

  const closeViewer = useCallback(
    function closeViewer() {
      setOpen(null);
      writeJson(seenNightsKey(userId), pruneSeen(seenRef.current, nightsRef.current));
    },
    [userId],
  );

  const handleAddYours = useCallback(
    function handleAddYours(night: MemoryNight) {
      closeViewer();
      setError(null);
      setAdding(night);
    },
    [closeViewer],
  );

  async function pick(source: PhotoSource) {
    if (!adding || busy) return;

    setBusy(true);
    setError(null);

    try {
      const result = await capture(source, {
        id: adding.event.id,
        groupId: adding.event.groupId,
      });
      setAdding(null);
      if (result) onPhotosChanged();
    } catch (problem) {
      setError(messageFor(problem));
      setAdding(null);
    } finally {
      setBusy(false);
    }
  }

  if (nights.length === 0) return null;

  return (
    <View>
      <View style={styles.head}>
        <SectionLabel>Nights filed</SectionLabel>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
      >
        {nights.map(function (night, index) {
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
        nights={nights}
        startIndex={open ?? 0}
        groupSizes={groupSizes}
        signed={signed}
        signPaths={signPaths}
        onImageError={onImageError}
        onSeen={handleSeen}
        onAddYours={handleAddYours}
        onClose={closeViewer}
      />

      <PhotoSourceSheet
        visible={adding !== null}
        onClose={function () {
          if (!busy) setAdding(null);
        }}
        onPick={pick}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  head: { paddingHorizontal: space.lg },
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
  blankText: { color: '#FFFFFF', fontFamily: font.semi, fontSize: textSize.base },
  name: { maxWidth: 74, color: colors.text, fontFamily: font.semi, fontSize: textSize.caption },
  nameSeen: { color: colors.textSoft, fontFamily: font.medium },
  stamp: { color: colors.textFaint, fontFamily: font.mono, fontSize: textSize.micro },
  error: {
    paddingHorizontal: space.lg,
    paddingTop: space.xs,
    color: colors.danger,
    fontFamily: font.medium,
    fontSize: textSize.small,
  },
});
