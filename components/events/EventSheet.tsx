import { useEffect, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { ActivityIndicator, Linking, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { Attendee, MyEvent, RsvpStatus } from '../../services/serviceEvents';
import { clearRsvp, deleteEvent, getAttendees, setRsvp } from '../../services/serviceEvents';
import { getMemberNames } from '../../services/serviceGroup';
import { colors, font, gradientFor, radius, space } from '../../theme';
import { formatDateTime } from '../../lib/datetime';
import { placeLines } from '../../lib/place';
import { mapsUrl } from '../../lib/maps';
import GradientAvatar, { initialsFor } from '../general/GradientAvatar';
import RsvpButtons from './RsvpButtons';

type Person = { userId: string; name: string };

async function openMaps(lat: number, lng: number, label?: string): Promise<void> {
  const url = mapsUrl(Platform.OS, lat, lng, label);

  try {
    await Linking.openURL(url);
  } catch {
    await Linking.openURL(mapsUrl('web', lat, lng, label));
  }
}

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

  const place = placeLines(event?.location, event?.placeLabel);

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
              <LinearGradient
                colors={gradientFor(event.groupName)}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.header}
              >
                <View style={styles.grabber} />

                <View style={styles.squadPill}>
                  <View style={styles.squadDot} />
                  <Text style={styles.squadName} numberOfLines={1}>{event.groupName}</Text>
                </View>

                <Text style={styles.title} numberOfLines={3}>{event.title}</Text>
                <Text style={styles.when}>{formatDateTime(event.date, event.startTime)}</Text>
                {place.primary ? (
                  <Text style={styles.where} numberOfLines={1}>{place.primary}</Text>
                ) : null}
                {place.secondary ? (
                  <Text style={styles.whereSub} numberOfLines={2}>{place.secondary}</Text>
                ) : null}
              </LinearGradient>

              <View style={styles.body}>
                {event.description ? (
                  <Text style={styles.description}>{event.description}</Text>
                ) : null}

                {event.lat !== undefined && event.lng !== undefined ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Open in maps"
                    onPress={() => openMaps(event.lat!, event.lng!, place.primary)}
                    style={({ pressed }) => [styles.maps, pressed && styles.mapsPressed]}
                  >
                    <Ionicons name="map-outline" size={17} color={colors.primary} />
                    <Text style={styles.mapsText}>Open in maps</Text>
                  </Pressable>
                ) : null}

                <RsvpButtons status={myStatus} saving={saving} onChange={handleRsvp} />

                {error ? <Text style={styles.error}>{error}</Text> : null}

                {loading ? (
                  <ActivityIndicator color={colors.primary} style={styles.loader} />
                ) : (
                  <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
                    <Section
                      title="Going"
                      people={going}
                      dot={colors.success}
                      empty="Nobody so far"
                    />
                    <Section
                      title="Can't make it"
                      people={notGoing}
                      dot={colors.danger}
                      empty="Nobody so far"
                    />
                    <Section
                      title="Still deciding"
                      people={noAnswer}
                      dot={colors.borderStrong}
                      empty="Everyone answered"
                    />
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
                    <View style={styles.ownerRow}>
                      {onEdit ? (
                        <Pressable
                          onPress={() => onEdit(event)}
                          disabled={saving}
                          accessibilityRole="button"
                          accessibilityLabel="Edit event"
                          style={({ pressed }) => [styles.ownerBtn, pressed && styles.pressed]}
                        >
                          <Ionicons name="create-outline" size={17} color={colors.textSoft} />
                          <Text style={styles.editText}>Edit</Text>
                        </Pressable>
                      ) : null}
                      <Pressable
                        onPress={() => setConfirming(true)}
                        disabled={saving}
                        accessibilityRole="button"
                        accessibilityLabel="Delete event"
                        style={({ pressed }) => [styles.ownerBtn, pressed && styles.pressed]}
                      >
                        <Ionicons name="trash-outline" size={17} color={colors.danger} />
                        <Text style={styles.deleteText}>Delete</Text>
                      </Pressable>
                    </View>
                  )
                ) : null}
              </View>
            </>
          ) : null}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

type SectionProps = {
  title: string;
  people: Person[];
  dot: string;
  empty: string;
};

function Section({ title, people, dot, empty }: SectionProps) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHead}>
        <View style={[styles.sectionDot, { backgroundColor: dot }]} />
        <Text style={styles.sectionTitle}>{title} · {people.length}</Text>
      </View>

      {people.length === 0 ? (
        <Text style={styles.empty}>{empty}</Text>
      ) : (
        <View style={styles.chips}>
          {people.map((person) => (
            <View key={person.userId} style={styles.chip}>
              <GradientAvatar label={person.name || '?'} initials={initialsFor(person.name)} size={26} />
              <Text style={styles.chipName} numberOfLines={1}>{person.name || 'Someone'}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    overflow: 'hidden',
    maxHeight: '85%',
  },
  header: {
    paddingHorizontal: space.lg,
    paddingTop: space.sm,
    paddingBottom: space.lg,
    gap: 3,
  },
  grabber: {
    width: 40,
    height: 4,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255,255,255,0.5)',
    alignSelf: 'center',
    marginBottom: space.md,
  },
  squadPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 7,
    paddingLeft: 7,
    paddingRight: 13,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255,255,255,0.22)',
    marginBottom: space.xs,
  },
  squadDot: { width: 14, height: 14, borderRadius: radius.pill, backgroundColor: '#FFFFFF' },
  squadName: { color: '#FFFFFF', fontFamily: font.bold, fontSize: 12.5, flexShrink: 1 },
  title: { color: '#FFFFFF', fontFamily: font.display, fontSize: 26, lineHeight: 32, letterSpacing: -0.5 },
  when: { color: '#FFFFFF', fontFamily: font.semi, fontSize: 15, marginTop: 4 },
  where: { color: 'rgba(255,255,255,0.82)', fontFamily: font.medium, fontSize: 15 },
  whereSub: { color: 'rgba(255,255,255,0.6)', fontFamily: font.medium, fontSize: 12.5, lineHeight: 17 },
  body: {
    paddingHorizontal: space.lg,
    paddingTop: space.md,
    paddingBottom: space.xl,
    gap: space.sm,
  },
  description: { color: colors.text, fontFamily: font.medium, fontSize: 14, lineHeight: 20 },
  error: { color: colors.danger, fontFamily: font.medium, fontSize: 13 },
  loader: { marginVertical: space.lg },
  maps: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingVertical: space.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
  },
  mapsPressed: { opacity: 0.7 },
  mapsText: { color: colors.primary, fontFamily: font.semi, fontSize: 14 },
  list: { maxHeight: 260 },
  listContent: { gap: space.md, paddingBottom: space.sm },
  section: { gap: space.sm },
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  sectionDot: { width: 8, height: 8, borderRadius: radius.pill },
  sectionTitle: { color: colors.text, fontFamily: font.semi, fontSize: 13.5 },
  empty: { color: colors.textFaint, fontFamily: font.medium, fontSize: 13.5 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingLeft: 5,
    paddingRight: 14,
    paddingVertical: 5,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceAlt,
  },
  chipName: { color: colors.text, fontFamily: font.semi, fontSize: 13.5, flexShrink: 1 },
  ownerRow: { flexDirection: 'row', gap: space.sm },
  ownerBtn: {
    flex: 1,
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
  editText: { color: colors.textSoft, fontFamily: font.semi, fontSize: 14 },
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
