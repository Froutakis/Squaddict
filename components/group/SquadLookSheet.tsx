import { useState } from 'react';
import { ActivityIndicator, Image, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { lookOf, updateSquadLook, type Group } from '../../services/serviceGroup';
import { pickImage, removeSquadImage, uploadSquadImage } from '../../services/serviceMedia';
import { urlOf, withImage, type SquadImageKind, type SquadLook } from '../../lib/squadLook';
import { messageFor } from '../events/EventPhotos';
import SheetHeader from '../general/SheetHeader';
import { colors, radius, space, textSize, typo } from '../../theme';

// The name, photo and public memories are the parea's call: they change by a
// vote (see Votes), so only the banner is edited here.
const ROWS: { kind: SquadImageKind; label: string; hint: string }[] = [
  { kind: 'banner', label: 'Banner', hint: 'The cover across the top of the profile.' },
];

type Busy = SquadImageKind | null;

type SquadLookSheetProps = {
  visible: boolean;
  group: Group;
  onClose: () => void;
  onChange: (group: Group) => void;
  // Name, photo and public memories: start a vote there.
  onOpenVotes: () => void;
};

export default function SquadLookSheet({ visible, group, onClose, onChange, onOpenVotes }: SquadLookSheetProps) {
  const [busy, setBusy] = useState<Busy>(null);
  const [error, setError] = useState<string | null>(null);
  const [brokenUrl, setBrokenUrl] = useState<Partial<Record<SquadImageKind, string>>>({});

  const look = lookOf(group);

  async function save(next: SquadLook, uploaded: string | null, replaced: string | null) {
    let saved: Group;
    try {
      saved = await updateSquadLook(group.id, next);
    } catch (problem) {
      await removeSquadImage(uploaded);
      throw problem;
    }

    onChange(saved);
    await removeSquadImage(replaced);
  }

  async function change(kind: SquadImageKind) {
    if (busy) return;
    setError(null);

    const picked = await pickImage();
    if (!picked) return;

    setBusy(kind);
    try {
      const url = await uploadSquadImage(group.id, kind, picked);
      await save(withImage(look, kind, url), url, urlOf(look, kind));
    } catch (problem) {
      setError(messageFor(problem));
    } finally {
      setBusy(null);
    }
  }

  async function remove(kind: SquadImageKind) {
    if (busy) return;
    setError(null);
    setBusy(kind);
    try {
      await save(withImage(look, kind, null), null, urlOf(look, kind));
    } catch (problem) {
      setError(messageFor(problem));
    } finally {
      setBusy(null);
    }
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={function () {
        if (!busy) onClose();
      }}
    >
      <Pressable
        style={styles.backdrop}
        onPress={function () {
          if (!busy) onClose();
        }}
      >
        <Pressable style={styles.sheet} onPress={() => {}}>
          <SheetHeader title="Edit look" onClose={onClose} closeDisabled={busy !== null} grabber />

          {ROWS.map(function (row) {
            const url = urlOf(look, row.kind);
            const working = busy === row.kind;
            const showImage = url !== null && brokenUrl[row.kind] !== url;

            return (
              <View key={row.kind} style={styles.row}>
                <View style={[styles.thumb, row.kind === 'avatar' && styles.thumbRound]}>
                  {showImage ? (
                    <Image
                      source={{ uri: url }}
                      style={styles.thumbImage}
                      resizeMode="cover"
                      onError={function () {
                        setBrokenUrl(function (prev) {
                          return { ...prev, [row.kind]: url };
                        });
                      }}
                    />
                  ) : null}
                </View>

                <View style={styles.rowText}>
                  <Text style={styles.label}>{row.label}</Text>
                  <Text style={styles.hint}>{row.hint}</Text>
                </View>

                {working ? (
                  <ActivityIndicator color={colors.primary} />
                ) : (
                  <View style={styles.actions}>
                    <Pressable
                      onPress={function () {
                        change(row.kind);
                      }}
                      disabled={busy !== null}
                      accessibilityRole="button"
                      accessibilityLabel={`Change ${row.label.toLowerCase()}`}
                      style={({ pressed }) => [styles.action, pressed && styles.pressed]}
                    >
                      <Text style={styles.actionText}>Change</Text>
                    </Pressable>
                    {url ? (
                      <Pressable
                        onPress={function () {
                          remove(row.kind);
                        }}
                        disabled={busy !== null}
                        accessibilityRole="button"
                        accessibilityLabel={`Remove ${row.label.toLowerCase()}`}
                        style={({ pressed }) => [styles.action, pressed && styles.pressed]}
                      >
                        <Text style={styles.removeText}>Remove</Text>
                      </Pressable>
                    ) : null}
                  </View>
                )}
              </View>
            );
          })}

          <View style={styles.row}>
            <View style={styles.rowText}>
              <Text style={styles.label}>Name, photo, public memories</Text>
              <Text style={styles.hint}>
                Changed by a vote. Memories are {look.memoriesPublic ? 'public' : 'private'} now.
              </Text>
            </View>
            <Pressable
              onPress={onOpenVotes}
              disabled={busy !== null}
              accessibilityRole="button"
              accessibilityLabel="Open Votes"
              accessibilityHint="Start a vote on the name, photo or public memories"
              style={({ pressed }) => [styles.action, pressed && styles.pressed]}
            >
              <Text style={styles.actionText}>Open Votes</Text>
            </Pressable>
          </View>

          {error ? <Text style={styles.error}>{error}</Text> : null}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingHorizontal: space.lg,
    paddingTop: space.sm,
    paddingBottom: space.xl,
    gap: space.sm,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingVertical: space.xs },
  thumb: {
    width: 48,
    height: 48,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceAlt,
    overflow: 'hidden',
  },
  thumbRound: { borderRadius: radius.pill },
  thumbImage: { width: '100%', height: '100%' },
  rowText: { flex: 1, gap: 2 },
  label: { color: colors.text, ...typo.semi, fontSize: textSize.base },
  hint: { color: colors.textFaint, ...typo.medium, fontSize: textSize.small },
  actions: { flexDirection: 'row', gap: space.xs },
  action: { minHeight: 44, justifyContent: 'center', paddingHorizontal: space.xs },
  actionText: { color: colors.primary, ...typo.semi, fontSize: textSize.body },
  removeText: { color: colors.danger, ...typo.semi, fontSize: textSize.body },
  pressed: { opacity: 0.6 },
  error: { color: colors.danger, ...typo.medium, fontSize: textSize.body },
});
