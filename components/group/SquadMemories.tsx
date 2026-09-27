import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import type { Group } from '../../services/serviceGroup';
import { getGroupMemories } from '../../services/serviceEvents';
import { signImages } from '../../services/serviceMedia';
import { mergeSigned, pathsToSign, type SignedMap } from '../chat/media';
import { nightsLabel, type SquadMemory } from '../../lib/squadLook';
import { dayMonth } from '../../lib/datetime';
import StoryViewer from '../events/StoryViewer';
import { capture, messageFor, PhotoSourceSheet, type PhotoSource } from '../events/EventPhotos';
import type { MemoryNight } from '../home/memories';
import { paper, radius, solidFor, space, textSize, typo } from '../../theme';

type SquadMemoriesProps = {
  group: Group;
  userId: string;
  member: boolean;
  nights: number;
  onPhotosChanged?: () => void;
};

export default function SquadMemories({
  group,
  userId,
  member,
  nights,
  onPhotosChanged,
}: SquadMemoriesProps) {
  const [memories, setMemories] = useState<SquadMemory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [signed, setSigned] = useState<SignedMap>({});
  const [open, setOpen] = useState<number | null>(null);
  const [adding, setAdding] = useState<MemoryNight | null>(null);
  const [busy, setBusy] = useState(false);
  const [nonce, setNonce] = useState(0);

  const hidden = !member && !group.memoriesPublic;

  useEffect(() => {
    if (hidden) {
      setMemories([]);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    getGroupMemories(group.id, userId)
      .then(function (list) {
        if (cancelled) return;
        setMemories(list);
        setError(null);
      })
      .catch(function () {
        if (!cancelled) setError('Could not load memories.');
      })
      .finally(function () {
        if (!cancelled) setLoading(false);
      });

    return function cleanup() {
      cancelled = true;
    };
  }, [group.id, userId, hidden, nonce]);

  const signPaths = useCallback(
    function signPaths(paths: string[]) {
      const missing = pathsToSign(paths, signed, Date.now());
      if (missing.length === 0) return;

      signImages(missing)
        .then(function (fresh) {
          setSigned(function (prev) {
            return mergeSigned(prev, fresh);
          });
        })
        .catch(function () {});
    },
    [signed],
  );

  useEffect(() => {
    signPaths(memories.map((memory) => memory.cover.path));
  }, [memories, signPaths]);

  const forget = useCallback(function forget(path: string) {
    setSigned(function (prev) {
      if (!prev[path]) return prev;
      const next = { ...prev };
      delete next[path];
      return next;
    });
  }, []);

  async function pick(source: PhotoSource) {
    if (!adding || busy) return;

    setBusy(true);
    setError(null);
    try {
      const result = await capture(source, { id: adding.event.id, groupId: adding.event.groupId });
      setAdding(null);
      if (result) {
        setNonce((n) => n + 1);
        onPhotosChanged?.();
      }
    } catch (problem) {
      setError(messageFor(problem));
      setAdding(null);
    } finally {
      setBusy(false);
    }
  }

  if (hidden) {
    return (
      <View style={styles.section}>
        <Text style={styles.label}>MEMORIES</Text>
        <Text style={styles.quiet}>{nightsLabel(nights)} kept · memories are private</Text>
      </View>
    );
  }

  return (
    <View style={styles.section}>
      <Text style={styles.label}>MEMORIES</Text>

      {loading ? (
        <ActivityIndicator color={paper.accent} style={styles.loader} />
      ) : error && memories.length === 0 ? (
        <Text style={styles.error}>{error}</Text>
      ) : memories.length === 0 ? (
        <Text style={styles.quiet}>No nights on the wall yet.</Text>
      ) : (
        <View style={styles.grid}>
          {memories.map(function (memory, index) {
            const url = signed[memory.cover.path]?.url;

            return (
              <Pressable
                key={memory.event.id}
                onPress={function () {
                  setOpen(index);
                }}
                accessibilityRole="button"
                accessibilityLabel={`${memory.event.title}, ${dayMonth(memory.event.date)}, ${memory.photoCount} photos`}
                style={({ pressed }) => [styles.tile, pressed && styles.pressed]}
              >
                {url ? (
                  <Image
                    source={{ uri: url }}
                    style={styles.cover}
                    resizeMode="cover"
                    onError={function () {
                      forget(memory.cover.path);
                    }}
                  />
                ) : (
                  <View style={[styles.cover, { backgroundColor: solidFor(group.name) }]} />
                )}
                <Text style={styles.title} numberOfLines={1}>
                  {memory.event.title}
                </Text>
                <Text style={styles.meta} numberOfLines={1}>
                  {dayMonth(memory.event.date)} · {memory.photoCount} {memory.photoCount === 1 ? 'photo' : 'photos'}
                </Text>
              </Pressable>
            );
          })}
        </View>
      )}

      {error && memories.length > 0 ? <Text style={styles.error}>{error}</Text> : null}

      <StoryViewer
        key={open ?? 'closed'}
        visible={open !== null}
        nights={memories}
        startIndex={open ?? 0}
        groupSizes={member ? { [group.id]: group.memberCount } : {}}
        signed={signed}
        signPaths={signPaths}
        onImageError={forget}
        onSeen={function () {}}
        onAddYours={function (night) {
          setOpen(null);
          setError(null);
          setAdding(night);
        }}
        onClose={function () {
          setOpen(null);
        }}
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
  section: { gap: space.sm },
  label: { color: paper.inkFaint, ...typo.mono, fontSize: textSize.caption, letterSpacing: 1.2 },
  loader: { alignSelf: 'flex-start', marginVertical: space.sm },
  quiet: { color: paper.inkFaint, ...typo.medium, fontSize: textSize.body },
  error: { color: paper.danger, ...typo.medium, fontSize: textSize.body },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs },
  tile: { width: '32%', gap: 3 },
  pressed: { opacity: 0.7 },
  cover: { width: '100%', aspectRatio: 1, borderRadius: radius.md, backgroundColor: paper.surfaceAlt },
  title: { color: paper.ink, ...typo.semi, fontSize: textSize.small },
  meta: { color: paper.inkFaint, ...typo.mono, fontSize: textSize.micro },
});
