import { useEffect, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { Attendee, MyEvent, RsvpStatus } from '../../services/serviceEvents';
import { clearRsvp, deleteEvent, getAttendees, setRsvp } from '../../services/serviceEvents';
import { getMemberNames } from '../../services/serviceGroup';
import { colors, font, radius, space } from '../../theme';
import { formatDateTime } from '../../lib/datetime';
import GradientAvatar, { initialsFor } from '../general/GradientAvatar';
import RsvpButtons from './RsvpButtons';

type Person = { userId: string; name: string };

type EventSheetProps = {
  event: MyEvent | null;
  currentUserId: string;
  onClose: () => void;
  onChanged: () => void | Promise<void>;
  onEdit?: (event: MyEvent) => void;
};

export default function EventSheet({ event, currentUserId, onClose, onChanged, onEdit }: EventSheetProps) {
  const [attendees, setAttendees] = useState<Attendee[]>([]);
  const [memberNames, setMemberNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    const open = event;
    if (!open) return;

    let cancelled = false;
    setConfirming(false);

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const [rows, names] = await Promise.all([
          getAttendees(open!.id),
          getMemberNames(open!.groupId),
        ]);
        if (cancelled) return;
        setAttendees(rows);
        setMemberNames(names);
      }
      catch (e) {
        if (!cancelled) setError('Could not load who is coming.');
      }
      finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [event?.id]);

  async function handleRsvp(status: RsvpStatus | null) {
    if (!event) return;

    setSaving(true);
    setError(null);
    try {
      if (status) await setRsvp(event.id, status);
      else await clearRsvp(event.id);

      setAttendees(await getAttendees(event.id));
      await onChanged();
    }
    catch (e) {
      setError('Could not save your answer. Try again.');
    }
    finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!event) return;

    setSaving(true);
    setError(null);
    try {
      await deleteEvent(event.id);
      await onChanged();
      onClose();
    }
    catch (e) {
      setError('Could not delete the event.');
    }
    finally {
      setSaving(false);
    }
  }

  const going = attendees.filter((a) => a.status === 'in');
  const notGoing = attendees.filter((a) => a.status === 'out');
  const answered = new Set(attendees.map((a) => a.userId));
  const noAnswer: Person[] = Object.entries(memberNames)
    .filter(([id]) => !answered.has(id))
    .map(([id, name]) => ({ userId: id, name }));

  const myStatus = attendees.find((a) => a.userId === currentUserId)?.status;
  const isOwner = event?.createdBy === currentUserId;

  return (
    <Modal visible={!!event} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          {event ? (
            <>
              <View style={styles.grabber} />

              <View style={styles.headRow}>
                <View style={styles.head}>
                  <Text style={styles.title} numberOfLines={2}>{event.title}</Text>
                  <Text style={styles.group}>{event.groupName}</Text>
                </View>

                {isOwner && onEdit ? (
                  <Pressable
                    onPress={() => onEdit(event)}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel="Edit event"
                    style={({ pressed }) => [styles.editBtn, pressed && styles.pressed]}
                  >
                    <Ionicons name="create-outline" size={20} color={colors.textSoft} />
                  </Pressable>
                ) : null}
              </View>

              <View style={styles.metaRow}>
                <Ionicons name="time-outline" size={16} color={colors.textSoft} />
                <Text style={styles.metaText}>{formatDateTime(event.date, event.startTime)}</Text>
              </View>

              {event.location ? (
                <View style={styles.metaRow}>
                  <Ionicons name="location-outline" size={16} color={colors.textSoft} />
                  <Text style={styles.metaText} numberOfLines={1}>{event.location}</Text>
                </View>
              ) : null}

              {event.description ? (
                <Text style={styles.description}>{event.description}</Text>
              ) : null}

              <RsvpButtons status={myStatus} saving={saving} onChange={handleRsvp} />

              {error ? <Text style={styles.error}>{error}</Text> : null}

              {loading ? (
                <ActivityIndicator color={colors.primary} style={styles.loader} />
              ) : (
                <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
                  <Section title="Going" people={going} />
                  <Section title="Not going" people={notGoing} />
                  <Section title="No answer" people={noAnswer} />
                </ScrollView>
              )}

              {isOwner ? (
                confirming ? (
                  <View style={styles.confirmRow}>
                    <Pressable
                      onPress={() => setConfirming(false)}
                      disabled={saving}
                      accessibilityRole="button"
                      accessibilityLabel="Cancel"
                      style={({ pressed }) => [styles.confirmBtn, styles.cancelBtn, pressed && styles.pressed]}
                    >
                      <Text style={styles.cancelText}>Cancel</Text>
                    </Pressable>
                    <Pressable
                      onPress={handleDelete}
                      disabled={saving}
                      accessibilityRole="button"
                      accessibilityLabel="Confirm delete"
                      style={({ pressed }) => [styles.confirmBtn, styles.dangerBtn, pressed && styles.pressed]}
                    >
                      <Text style={styles.dangerText}>{saving ? 'Deleting…' : 'Yes, delete'}</Text>
                    </Pressable>
                  </View>
                ) : (
                  <Pressable
                    onPress={() => setConfirming(true)}
                    disabled={saving}
                    accessibilityRole="button"
                    accessibilityLabel="Delete event"
                    style={({ pressed }) => [styles.delete, pressed && styles.pressed]}
                  >
                    <Ionicons name="trash-outline" size={17} color={colors.danger} />
                    <Text style={styles.deleteText}>Delete event</Text>
                  </Pressable>
                )
              ) : null}
            </>
          ) : null}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function Section({ title, people }: { title: string; people: Person[] }) {
  if (people.length === 0) return null;

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title} · {people.length}</Text>
      {people.map((person) => (
        <View key={person.userId} style={styles.person}>
          <GradientAvatar label={person.name || '?'} initials={initialsFor(person.name)} size={30} />
          <Text style={styles.personName} numberOfLines={1}>{person.name || 'Someone'}</Text>
        </View>
      ))}
    </View>
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
    maxHeight: '85%',
  },
  grabber: {
    width: 40,
    height: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.border,
    alignSelf: 'center',
    marginBottom: space.sm,
  },
  headRow: { flexDirection: 'row', alignItems: 'flex-start', gap: space.sm },
  head: { flex: 1, gap: 2 },
  editBtn: {
    width: 38,
    height: 38,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { color: colors.text, fontFamily: font.bold, fontSize: 22, lineHeight: 27 },
  group: { color: colors.primary, fontFamily: font.semi, fontSize: 13 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  metaText: { color: colors.textSoft, fontFamily: font.medium, fontSize: 14, flexShrink: 1 },
  description: { color: colors.text, fontFamily: font.medium, fontSize: 14, lineHeight: 20, marginTop: space.xs },
  error: { color: colors.danger, fontFamily: font.medium, fontSize: 13 },
  loader: { marginVertical: space.lg },
  list: { maxHeight: 260 },
  listContent: { gap: space.md, paddingBottom: space.sm },
  section: { gap: space.sm },
  sectionTitle: {
    color: colors.textFaint,
    fontFamily: font.semi,
    fontSize: 11,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  person: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  personName: { color: colors.text, fontFamily: font.medium, fontSize: 14, flexShrink: 1 },
  delete: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingVertical: 12,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  pressed: { opacity: 0.7 },
  deleteText: { color: colors.danger, fontFamily: font.semi, fontSize: 14 },
  confirmRow: { flexDirection: 'row', gap: space.sm },
  confirmBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: radius.md,
    borderWidth: 1.5,
  },
  cancelBtn: { borderColor: colors.border, backgroundColor: colors.surface },
  cancelText: { color: colors.textSoft, fontFamily: font.semi, fontSize: 14 },
  dangerBtn: { borderColor: colors.danger, backgroundColor: colors.danger },
  dangerText: { color: '#FFFFFF', fontFamily: font.semi, fontSize: 14 },
});
