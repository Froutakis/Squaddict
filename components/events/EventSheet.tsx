import type { Person } from '../../lib/people';
import { useEffect, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, Linking, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { Attendee, RsvpStatus } from '../../services/serviceEvents';
import { clearRsvp, deleteEvent, getAttendees, setRsvp } from '../../services/serviceEvents';
import { getMemberNames } from '../../services/serviceGroup';
import { colors, typo, radius, space, textSize } from '../../theme';
import { formatDateTime, keyOf } from '../../lib/datetime';
import { placeLines } from '../../lib/place';
import { mapsUrl } from '../../lib/maps';
import { ticketCode } from '../../lib/ticket';
import CloseButton from '../general/CloseButton';
import GradientAvatar, { initialsFor } from '../general/GradientAvatar';
import Ticket from '../general/Ticket';
import EventPhotos from './EventPhotos';
import RsvpButtons from './RsvpButtons';

async function openMaps(lat: number, lng: number, label?: string): Promise<void> {
  const url = mapsUrl(Platform.OS, lat, lng, label);

  try {
    await Linking.openURL(url);
  } catch {
    await Linking.openURL(mapsUrl('web', lat, lng, label));
  }
}

export type SheetEvent = {
  id: string;
  groupId: string;
  groupName: string;
  title: string;
  date: string;
  startTime?: string;
  location?: string;
  description?: string;
  placeLabel?: string;
  lat?: number;
  lng?: number;
  createdBy?: string;
  isMember?: boolean;
  myStatus?: RsvpStatus;
  going?: Person[];
};

type EventSheetProps = {
  event: SheetEvent | null;
  currentUserId: string;
  onClose: () => void;
  onChanged: () => void | Promise<void>;
  onEdit?: (event: SheetEvent) => void;
  onPhotosChanged?: () => void;
};

export default function EventSheet({ event, currentUserId, onClose, onChanged, onEdit, onPhotosChanged }: EventSheetProps) {
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
          open!.isMember === false
            ? Promise.resolve<Record<string, string>>({})
            : getMemberNames(open!.groupId),
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
  const answered = new Set(attendees.map((a) => a.id));
  const noAnswer: Person[] = Object.entries(memberNames)
    .filter(([id]) => !answered.has(id))
    .map(([id, name]) => ({ id, name }));

  const myStatus = attendees.find((a) => a.id === currentUserId)?.status;
  const canSeeRoster = event?.isMember !== false;
  const isOwner = event?.createdBy !== undefined && event.createdBy === currentUserId;
  const hasHappened = event ? event.date <= keyOf(new Date()) : false;

  return (
    <Modal
      visible={!!event}
      transparent
      animationType="slide"
      onRequestClose={function () {
        if (!saving) onClose();
      }}
    >
      <Pressable
        style={styles.backdrop}
        onPress={function () {
          if (!saving) onClose();
        }}
      >
        <Pressable style={styles.sheet} onPress={() => {}}>
          {event ? (
            <>
              <Ticket
                tone="ink"
                notches={false}
                style={styles.header}
                stub={
                  <RsvpButtons status={myStatus} saving={saving} onChange={handleRsvp} onDark stretch />
                }
              >
                <View style={styles.grabber} />

                <View style={styles.topRow}>
                  <View style={styles.groupPill}>
                    <View style={styles.groupDot} />
                    <Text style={styles.groupName} numberOfLines={1}>{event.groupName}</Text>
                  </View>
                  <View style={styles.spacer} />
                  <Text style={styles.code}>№ {ticketCode(event.id)}</Text>
                  <CloseButton tone="light" onPress={onClose} disabled={saving} />
                </View>

                <Text style={styles.title} numberOfLines={3}>{event.title}</Text>
                <Text style={styles.when}>{formatDateTime(event.date, event.startTime)}</Text>
                {place.primary ? (
                  <Text style={styles.where} numberOfLines={1}>{place.primary}</Text>
                ) : null}
                {place.secondary ? (
                  <Text style={styles.whereSub} numberOfLines={2}>{place.secondary}</Text>
                ) : null}
              </Ticket>

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

                {error ? <Text style={styles.error}>{error}</Text> : null}

                {loading ? (
                  <ActivityIndicator color={colors.primary} style={styles.loader} />
                ) : (
                  <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
                    {hasHappened && canSeeRoster ? (
                      <EventPhotos
                        eventId={event.id}
                        groupId={event.groupId}
                        currentUserId={currentUserId}
                        canAdd={myStatus === 'in'}
                        onChanged={onPhotosChanged}
                      />
                    ) : null}

                    {canSeeRoster ? (
                      <>
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
                      </>
                    ) : (
                      <View style={styles.section}>
                        <View style={styles.sectionHead}>
                          <View style={[styles.sectionDot, { backgroundColor: colors.success }]} />
                          <Text style={styles.sectionTitle}>
                            {going.length} going · {notGoing.length} passed
                          </Text>
                        </View>
                        <Text style={styles.empty}>
                          You are not in this squad. You can still answer.
                        </Text>
                      </View>
                    )}
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
            <View key={person.id} style={styles.chip}>
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
    maxHeight: '85%',
    overflow: 'hidden',
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    backgroundColor: colors.surface,
  },

  header: {
    borderRadius: 0,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
  },
  spacer: { flex: 1 },
  grabber: {
    width: 40,
    height: 4,
    alignSelf: 'center',
    marginBottom: space.md,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255,255,255,0.4)',
  },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  groupPill: {
    flexDirection: 'row',
    alignItems: 'center',
    maxWidth: '52%',
    gap: space.xs,
    paddingHorizontal: space.sm,
    paddingVertical: 4,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  groupDot: { width: 8, height: 8, borderRadius: radius.pill, backgroundColor: '#FFFFFF' },
  groupName: { flexShrink: 1, color: '#FFFFFF', ...typo.semi, fontSize: textSize.caption },
  code: { color: 'rgba(255,255,255,0.5)', ...typo.mono, fontSize: 10, letterSpacing: 1 },
  title: {
    marginTop: space.sm,
    color: '#FFFFFF',
    ...typo.display,
    fontSize: textSize.display,
    lineHeight: 34,
    letterSpacing: -0.6,
  },
  when: { marginTop: space.xs, color: 'rgba(255,255,255,0.78)', ...typo.mono, fontSize: textSize.base },
  where: { marginTop: 3, color: 'rgba(255,255,255,0.78)', ...typo.medium, fontSize: textSize.base },
  whereSub: { color: 'rgba(255,255,255,0.5)', ...typo.medium, fontSize: textSize.small, lineHeight: 17 },

  body: {
    gap: space.sm,
    paddingHorizontal: space.lg,
    paddingTop: space.md,
    paddingBottom: space.xl,
  },
  description: { color: colors.text, ...typo.medium, fontSize: textSize.base, lineHeight: 20 },

  maps: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.xs,
    paddingVertical: space.sm,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bg,
  },
  mapsPressed: { opacity: 0.7 },
  mapsText: { color: colors.primary, ...typo.semi, fontSize: textSize.base },

  error: { color: colors.danger, ...typo.medium, fontSize: textSize.body },
  loader: { marginVertical: space.lg },

  list: { maxHeight: 320 },
  listContent: { gap: space.md, paddingBottom: space.sm },
  section: { gap: space.sm },
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  sectionDot: { width: 8, height: 8, borderRadius: radius.pill },
  sectionTitle: {
    color: colors.textSoft,
    ...typo.mono,
    fontSize: textSize.caption,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  empty: { color: colors.textFaint, ...typo.medium, fontSize: textSize.body },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    paddingLeft: space.xs,
    paddingRight: space.sm,
    paddingVertical: 4,
    borderRadius: radius.sm,
    backgroundColor: colors.bg,
  },
  chipName: { flexShrink: 1, color: colors.text, ...typo.semi, fontSize: textSize.body },

  ownerRow: { flexDirection: 'row', gap: space.sm },
  ownerBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.xs,
    paddingVertical: space.sm,
    borderRadius: radius.sm,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  pressed: { opacity: 0.7 },
  editText: { color: colors.textSoft, ...typo.semi, fontSize: textSize.base },
  deleteText: { color: colors.danger, ...typo.semi, fontSize: textSize.base },
  confirmRow: { flexDirection: 'row', gap: space.sm },
  confirmBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: space.sm,
    borderRadius: radius.sm,
    borderWidth: 1.5,
  },
  cancelBtn: { borderColor: colors.border, backgroundColor: colors.surface },
  cancelText: { color: colors.textSoft, ...typo.semi, fontSize: textSize.base },
  dangerBtn: { borderColor: colors.danger, backgroundColor: colors.danger },
  dangerText: { color: '#FFFFFF', ...typo.semi, fontSize: textSize.base },
});
