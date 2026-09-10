import { useEffect, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, Image, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import {
  addEventPhoto,
  getEventPhotos,
  removeEventPhoto,
  type EventPhoto,
} from '../../services/serviceEvents';
import { pickImage, prepareImage, signImages, takePhoto } from '../../services/serviceMedia';
import type { SignedMap } from '../chat/media';
import { colors, font, radius, space, textSize } from '../../theme';

const TILE = 72;

export type PhotoSource = 'camera' | 'library';

export async function capture(source: PhotoSource, event: { id: string; groupId: string }) {
  const picked = source === 'camera' ? await takePhoto() : await pickImage();
  if (!picked) return null;

  const ready = await prepareImage(picked);
  const photo = await addEventPhoto(event, ready);
  const fresh = await signImages([photo.path]);

  return { photo, signed: fresh };
}

export function messageFor(problem: unknown) {
  if (typeof problem === 'string' && problem.length > 0) return problem;

  if (problem !== null && typeof problem === 'object') {
    const shape = problem as { message?: unknown; code?: unknown; statusCode?: unknown };
    const code = shape.code ?? shape.statusCode;

    if (typeof shape.message === 'string' && shape.message.length > 0) {
      return code ? `${shape.message} (${String(code)})` : shape.message;
    }
  }

  return 'Could not add that photo.';
}

type PhotoSourceSheetProps = {
  visible: boolean;
  onClose: () => void;
  onPick: (source: PhotoSource) => void;
};

export function PhotoSourceSheet({ visible, onClose, onPick }: PhotoSourceSheetProps) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          <View style={styles.grabber} />
          <Text style={styles.sheetTitle}>Add a photo</Text>

          <Pressable
            onPress={() => onPick('camera')}
            accessibilityRole="button"
            accessibilityLabel="Take a photo"
            style={({ pressed }) => [styles.option, pressed && styles.pressed]}
          >
            <View style={styles.optionIcon}>
              <Ionicons name="camera-outline" size={20} color={colors.text} />
            </View>
            <View style={styles.optionText}>
              <Text style={styles.optionTitle}>Take a photo</Text>
              <Text style={styles.optionBody}>Straight from the camera</Text>
            </View>
            <Ionicons name="chevron-forward" size={17} color={colors.textFaint} />
          </Pressable>

          <Pressable
            onPress={() => onPick('library')}
            accessibilityRole="button"
            accessibilityLabel="Choose from library"
            style={({ pressed }) => [styles.option, pressed && styles.pressed]}
          >
            <View style={styles.optionIcon}>
              <Ionicons name="images-outline" size={20} color={colors.text} />
            </View>
            <View style={styles.optionText}>
              <Text style={styles.optionTitle}>Choose from library</Text>
              <Text style={styles.optionBody}>One you already took</Text>
            </View>
            <Ionicons name="chevron-forward" size={17} color={colors.textFaint} />
          </Pressable>

          <Pressable
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Cancel"
            style={({ pressed }) => [styles.cancel, pressed && styles.pressed]}
          >
            <Text style={styles.cancelText}>Cancel</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

type EventPhotosProps = {
  eventId: string;
  groupId: string;
  currentUserId: string;
  canAdd: boolean;
  onChanged?: () => void;
};

export default function EventPhotos({
  eventId,
  groupId,
  currentUserId,
  canAdd,
  onChanged,
}: EventPhotosProps) {
  const [photos, setPhotos] = useState<EventPhoto[]>([]);
  const [signed, setSigned] = useState<SignedMap>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [asking, setAsking] = useState(false);
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

  async function handleAdd(source: PhotoSource) {
    setAsking(false);
    setError(null);
    setBusy(true);

    try {
      const added = await capture(source, { id: eventId, groupId });
      if (!added) return;

      setPhotos((current) => [...current, added.photo]);
      setSigned((current) => ({ ...current, ...added.signed }));
      onChanged?.();
    } catch (problem) {
      setError(messageFor(problem));
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
            onPress={() => setAsking(true)}
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

      <PhotoSourceSheet visible={asking} onClose={() => setAsking(false)} onPick={handleAdd} />
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


  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: {
    gap: space.xs,
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
    fontFamily: font.display,
    fontSize: textSize.heading,
    letterSpacing: -0.3,
    marginBottom: space.xs,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingVertical: space.sm,
    paddingHorizontal: space.sm,
    borderRadius: radius.md,
    backgroundColor: colors.bg,
  },
  optionIcon: {
    width: 38,
    height: 38,
    borderRadius: radius.sm,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionText: { flex: 1, minWidth: 0, gap: 1 },
  optionTitle: { color: colors.text, fontFamily: font.semi, fontSize: textSize.base },
  optionBody: { color: colors.textFaint, fontFamily: font.medium, fontSize: textSize.small },
  cancel: {
    marginTop: space.xs,
    paddingVertical: space.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelText: { color: colors.textSoft, fontFamily: font.semi, fontSize: textSize.base },
});
