import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { Group } from '../../services/serviceGroup';
import { getGroupMemories } from '../../services/serviceEvents';
import { signImages } from '../../services/serviceMedia';
import { mergeSigned, pathsToSign, type SignedMap } from '../chat/media';
import { nightsLabel, type SquadMemory } from '../../lib/squadLook';
import { dayMonth } from '../../lib/datetime';
import StoryViewer from '../events/StoryViewer';
import { capture, messageFor, PhotoSourceSheet, type PhotoSource } from '../events/EventPhotos';
import type { MemoryNight } from '../home/memories';
import { paper, radius, space, textSize, typo } from '../../theme';

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
      <View style={styles.empty}>
        <Ionicons name="lock-closed-outline" size={22} color={paper.inkSoft} />
        <Text style={styles.emptyTitle}>{nightsLabel(nights)} kept</Text>
        <Text style={styles.quiet}>Their memories are private.</Text>
      </View>
    );
  }

  return (
    <View style={styles.section}>
      {loading ? (
        <ActivityIndicator color={paper.accent} style={styles.loader} />
      ) : error && memories.length === 0 ? (
        <Text style={styles.error}>{error}</Text>
      ) : memories.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="camera-outline" size={22} color={paper.inkSoft} />
          <Text style={styles.emptyTitle}>No nights on the wall yet</Text>
          <Text style={styles.quiet}>Photos from your plans land here the night after.</Text>
        </View>
      ) : (
        <View style={styles.grid}>
          {rowsOf(memories, 3).map(function (row, r) {
            return (
              <View key={r} style={styles.row}>
                {row.map(function (memory, c) {
                  const index = r * 3 + c;
                  const url = signed[memory.cover.path]?.url;

                  return (
                    <View key={memory.event.id} style={styles.tile}>
                      <Pressable
                        onPress={function () {
                          setOpen(index);
                        }}
                        accessibilityRole="button"
                        accessibilityLabel={`${memory.event.title}, ${dayMonth(memory.event.date)}, ${memory.photoCount} photos`}
                        style={({ pressed }) => [styles.photo, pressed && styles.pressed]}
                      >
                        {url ? (
                          <Image
                            source={{ uri: url }}
                            style={StyleSheet.absoluteFill}
                            resizeMode="cover"
                            onError={function () {
                              forget(memory.cover.path);
                            }}
                          />
                        ) : (
                          <View style={[StyleSheet.absoluteFill, styles.blank]} />
                        )}
                      </Pressable>
                      <Text style={styles.title} numberOfLines={1}>
                        {memory.event.title}
                      </Text>
                      <Text style={styles.meta} numberOfLines={1}>
                        {dayMonth(memory.event.date)} · {memory.photoCount} {memory.photoCount === 1 ? 'photo' : 'photos'}
                      </Text>
                    </View>
                  );
                })}
                {Array.from({ length: 3 - row.length }).map(function (_, i) {
                  return <View key={'pad' + i} style={styles.pad} />;
                })}
              </View>
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

function rowsOf<T>(list: T[], size: number): T[][] {
  const rows: T[][] = [];
  for (let i = 0; i < list.length; i += size) rows.push(list.slice(i, i + size));
  return rows;
}

const styles = StyleSheet.create({
  section: { gap: space.sm },
  loader: { alignSelf: 'center', marginVertical: space.lg },
  quiet: { color: paper.inkFaint, ...typo.medium, fontSize: textSize.body, textAlign: 'center' },
  error: { color: paper.danger, ...typo.medium, fontSize: textSize.body },
  empty: { alignItems: 'center', gap: space.xxs, paddingVertical: space.xl },
  emptyTitle: { color: paper.ink, ...typo.bold, fontSize: textSize.base, marginTop: space.xxs },
  grid: { gap: space.md },
  row: { flexDirection: 'row', gap: space.sm },
  pad: { flex: 1 },
  tile: { flex: 1, gap: 2 },
  photo: {
    width: '100%',
    aspectRatio: 3 / 4,
    borderRadius: radius.md,
    overflow: 'hidden',
    backgroundColor: paper.surfaceAlt,
    marginBottom: 4,
  },
  blank: { backgroundColor: paper.surfaceAlt },
  pressed: { opacity: 0.8 },
  title: { color: paper.ink, ...typo.medium, fontSize: textSize.small },
  meta: { color: paper.inkFaint, ...typo.regular, fontSize: textSize.caption },
});
