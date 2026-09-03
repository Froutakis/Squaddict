import { useEffect, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import {
  addEventPhoto,
  getEventPhotos,
  removeEventPhoto,
  type EventPhoto,
} from '../../services/serviceEvents';
import { pickImage, prepareImage, signImages } from '../../services/serviceMedia';
import type { SignedMap } from '../chat/media';
import { colors, font, radius, space, textSize } from '../../theme';

const TILE = 72;

type EventPhotosProps = {
  eventId: string;
  groupId: string;
  currentUserId: string;
  canAdd: boolean;
  onChanged?: () => void;
};

export default function EventPhotos({ eventId, groupId, currentUserId, canAdd, onChanged }: EventPhotosProps) {
  const [photos, setPhotos] = useState<EventPhoto[]>([]);
  const [signed, setSigned] = useState<SignedMap>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);

      try {
        const rows = await getEventPhotos(eventId);
        if (cancelled) return;
        setPhotos(rows);

        const fresh = await signImages(rows.map((photo) => photo.path));
        if (cancelled) return;
        setSigned(fresh);
      } catch {
        if (!cancelled) setError('Could not load the photos.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [eventId]);

  async function handleAdd() {
    setError(null);

    try {
      const picked = await pickImage();
      if (!picked) return;

      setBusy(true);
      const ready = await prepareImage(picked);
      const saved = await addEventPhoto({ id: eventId, groupId }, ready);
      const fresh = await signImages([saved.path]);

      setPhotos((current) => [...current, saved]);
      setSigned((current) => ({ ...current, ...fresh }));
      onChanged?.();
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : 'Could not add that photo.');
    } finally {
      setBusy(false);
    }
  }

  async function handleRemove(photo: EventPhoto) {
    setError(null);
    setBusy(true);

    try {
      await removeEventPhoto(photo);
      setPhotos((current) => current.filter((row) => row.id !== photo.id));
      onChanged?.();
    } catch {
      setError('Could not remove that photo.');
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return <ActivityIndicator color={colors.primary} style={styles.loader} />;
  }

  if (photos.length === 0 && !canAdd) return null;

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>Memories</Text>

      <View style={styles.grid}>
        {canAdd ? (
          <Pressable
            onPress={handleAdd}
            disabled={busy}
            accessibilityRole="button"
            accessibilityLabel="Add a photo"
            accessibilityState={{ disabled: busy }}
            style={({ pressed }) => [styles.tile, styles.add, pressed && styles.pressed]}
          >
            {busy ? (
              <ActivityIndicator color={colors.textSoft} />
            ) : (
              <Ionicons name="add" size={22} color={colors.textSoft} />
            )}
          </Pressable>
        ) : null}

        {photos.map(function (photo) {
          const url = signed[photo.path]?.url;

          return (
            <View key={photo.id} style={styles.tile}>
              {url ? (
                <Image source={{ uri: url }} style={styles.image} resizeMode="cover" />
              ) : (
                <View style={styles.image} />
              )}

              {photo.userId === currentUserId ? (
                <Pressable
                  onPress={() => handleRemove(photo)}
                  disabled={busy}
                  accessibilityRole="button"
                  accessibilityLabel="Remove photo"
                  accessibilityState={{ disabled: busy }}
                  style={({ pressed }) => [styles.remove, pressed && styles.pressed]}
                >
                  <Ionicons name="close" size={12} color="#FFFFFF" />
                </Pressable>
              ) : null}
            </View>
          );
        })}
      </View>

      {photos.length === 0 ? (
        <Text style={styles.empty}>Nothing yet. Add the first one.</Text>
      ) : null}

      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.sm },
  loader: { marginVertical: space.md },

  label: {
    color: colors.textSoft,
    fontFamily: font.mono,
    fontSize: textSize.caption,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs },

  tile: {
    width: TILE,
    height: TILE,
    borderRadius: radius.sm,
    overflow: 'hidden',
    backgroundColor: colors.bg,
  },
  add: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  image: { width: '100%', height: '100%', backgroundColor: colors.surfaceAlt },
  pressed: { opacity: 0.7 },

  remove: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 20,
    height: 20,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(12,25,38,0.62)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  empty: { color: colors.textFaint, fontFamily: font.medium, fontSize: textSize.body },
  error: { color: colors.danger, fontFamily: font.medium, fontSize: textSize.body },
});
