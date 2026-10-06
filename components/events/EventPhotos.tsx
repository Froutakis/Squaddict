import { useEffect, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, Image, Modal, Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import {
  addEventPhoto,
  getEventPhotos,
  removeEventPhoto,
  setPhotoInExplore,
  type EventPhoto,
} from '../../services/serviceEvents';
import { pickImage, prepareImage, signImages, takePhoto } from '../../services/serviceMedia';
import { isBlocked } from '../../services/serviceSafety';
import type { SignedMap } from '../chat/media';
import { readJson, writeJson } from '../../lib/store';
import { colors, typo, radius, space, textSize } from '../../theme';

const TILE = 72;

export type PhotoSource = 'camera' | 'library';

// Last answer to "Show in Explore", so people who share keep sharing.
const EXPLORE_SHARE_KEY = 'squaddict:photos:explore';

export async function getExploreDefault(): Promise<boolean> {
  return (await readJson<boolean>(EXPLORE_SHARE_KEY)) === true;
}

export function setExploreDefault(share: boolean): Promise<void> {
  return writeJson(EXPLORE_SHARE_KEY, share);
}

export async function capture(
  source: PhotoSource,
  event: { id: string; groupId: string },
  inExplore = false,
) {
  const picked = source === 'camera' ? await takePhoto() : await pickImage();
  if (!picked) return null;

  const ready = await prepareImage(picked);
  const photo = await addEventPhoto(event, ready, inExplore);
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
  title?: string;
  shareable?: boolean;
  onClose: () => void;
  onPick: (source: PhotoSource, inExplore: boolean) => void;
  onRemove?: () => void;
};

export function PhotoSourceSheet({
  visible,
  title = 'Add a photo',
  shareable = false,
  onClose,
  onPick,
  onRemove,
}: PhotoSourceSheetProps) {
  const [share, setShare] = useState(false);

  useEffect(() => {
    if (!visible || !shareable) return;

    let cancelled = false;
    readJson<boolean>(EXPLORE_SHARE_KEY).then((stored) => {
      if (!cancelled) setShare(stored === true);
    });

    return () => {
      cancelled = true;
    };
  }, [visible, shareable]);

  function toggleShare(next: boolean) {
    setShare(next);
    writeJson(EXPLORE_SHARE_KEY, next);
  }

  const inExplore = shareable && share;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          <View style={styles.grabber} />
          <Text style={styles.sheetTitle}>{title}</Text>

          <Pressable
            onPress={() => onPick('camera', inExplore)}
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
            onPress={() => onPick('library', inExplore)}
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

          {shareable ? (
            <View style={styles.shareRow}>
              <View style={styles.optionText}>
                <Text style={styles.optionTitle}>Show in Explore</Text>
                <Text style={styles.optionBody}>
                  Anyone nearby can see it. You can hide it again anytime.
                </Text>
              </View>
              <Switch
                value={share}
                onValueChange={toggleShare}
                accessibilityLabel="Show this photo in Explore"
                trackColor={{ true: colors.primary, false: colors.border }}
              />
            </View>
          ) : null}

          {onRemove ? (
            <Pressable
              onPress={onRemove}
              accessibilityRole="button"
              accessibilityLabel="Remove photo"
              style={({ pressed }) => [styles.option, pressed && styles.pressed]}
            >
              <View style={styles.optionIcon}>
                <Ionicons name="trash-outline" size={20} color={colors.danger} />
              </View>
              <View style={styles.optionText}>
                <Text style={[styles.optionTitle, styles.removeText]}>Remove photo</Text>
                <Text style={styles.optionBody}>Show your initials instead</Text>
              </View>
            </Pressable>
          ) : null}

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
  shareable?: boolean;
  onChanged?: () => void;
};

export default function EventPhotos({
  eventId,
  groupId,
  currentUserId,
  canAdd,
  shareable = false,
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
        // Photos from people you blocked are left out.
        const rows = (await getEventPhotos(eventId)).filter((photo) => !isBlocked(photo.userId));
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

  async function handleAdd(source: PhotoSource, inExplore: boolean) {
    setAsking(false);
    setError(null);
    setBusy(true);

    try {
      const added = await capture(source, { id: eventId, groupId }, inExplore);
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

  async function toggleExplore(photo: EventPhoto) {
    const shown = !photo.inExplore;
    const flip = (row: EventPhoto) => (row.id === photo.id ? { ...row, inExplore: shown } : row);

    setError(null);
    setPhotos((current) => current.map(flip));

    try {
      await setPhotoInExplore(photo.id, shown);
    } catch {
      setPhotos((current) => current.map((row) => (row.id === photo.id ? photo : row)));
      setError('Could not change that photo.');
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

              {photo.userId === currentUserId && shareable ? (
                <Pressable
                  onPress={() => toggleExplore(photo)}
                  disabled={busy}
                  accessibilityRole="switch"
                  accessibilityLabel="Show in Explore"
                  accessibilityState={{ checked: photo.inExplore, disabled: busy }}
                  style={({ pressed }) => [
                    styles.globe,
                    photo.inExplore && styles.globeOn,
                    pressed && styles.pressed,
                  ]}
                >
                  <Ionicons
                    name={photo.inExplore ? 'globe' : 'globe-outline'}
                    size={12}
                    color="#FFFFFF"
                  />
                </Pressable>
              ) : null}

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

      {shareable && photos.some((photo) => photo.userId === currentUserId) ? (
        <Text style={styles.hint}>Tap the globe on your photos to show them in Explore.</Text>
      ) : null}

      <PhotoSourceSheet
        visible={asking}
        shareable={shareable}
        onClose={() => setAsking(false)}
        onPick={handleAdd}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.sm },
  loader: { marginVertical: space.md },

  label: {
    color: colors.textSoft,
    ...typo.mono,
    fontSize: textSize.caption,
    letterSpacing: 0.2,
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

  globe: {
    position: 'absolute',
    bottom: 4,
    left: 4,
    width: 20,
    height: 20,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(12,25,38,0.62)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  globeOn: { backgroundColor: colors.primary },
  hint: { color: colors.textFaint, ...typo.medium, fontSize: textSize.caption },
  shareRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingVertical: space.sm,
    paddingHorizontal: space.sm,
    borderRadius: radius.md,
    backgroundColor: colors.bg,
  },
  empty: { color: colors.textFaint, ...typo.medium, fontSize: textSize.body },
  error: { color: colors.danger, ...typo.medium, fontSize: textSize.body },

  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: {
    gap: space.xs,
    paddingHorizontal: space.lg,
    paddingTop: space.sm,
    paddingBottom: space.xl,
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
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
    ...typo.display,
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
  optionTitle: { color: colors.text, ...typo.semi, fontSize: textSize.base },
  optionBody: { color: colors.textFaint, ...typo.medium, fontSize: textSize.small },
  removeText: { color: colors.danger },
  cancel: {
    marginTop: space.xs,
    paddingVertical: space.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelText: { color: colors.textSoft, ...typo.semi, fontSize: textSize.base },
});
