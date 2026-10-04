import { useEffect, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import type { Attendee, RsvpStatus } from '../../services/serviceEvents';
import { clearRsvp, deleteEvent, getAttendees, setRsvp } from '../../services/serviceEvents';
import { colors, solidFor, typo, radius, space, textSize } from '../../theme';
import { formatDateTime, keyOf } from '../../lib/datetime';
import { placeLines } from '../../lib/place';
import { ticketCode } from '../../lib/ticket';
import AttendeeSheet from './AttendeeSheet';
import EventPhotos from './EventPhotos';
import Map from '../general/Map';
import type { LivePerson } from '../../services/serviceLiveLocation';
import { getGoingSquads, type GoingSquad } from '../../services/serviceVotes';
import { useSquadPlans } from './useSquadPlans';
import Monogram from '../general/Monogram';

export type SheetEvent = {
  id: string;
  groupId?: string;
  isPublic?: boolean;
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
};

type EventSheetProps = {
  event: SheetEvent | null;
  livePeople?: LivePerson[];
  currentUserId: string;
  onClose: () => void;
  onChanged: () => void | Promise<void>;
  onEdit?: (event: SheetEvent) => void;
  onPhotosChanged?: () => void;
  // Votes start only on the Votes page: the sheet closes and that opens.
  onOpenVotes: (groupId?: string) => void;
};

export default function EventSheet({
  event,
  livePeople = [],
  currentUserId,
  onClose,
  onChanged,
  onEdit,
  onPhotosChanged,
  onOpenVotes,
}: EventSheetProps) {
  const [roster, setRoster] = useState(false);
  const [attendees, setAttendees] = useState<Attendee[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [goingSquads, setGoingSquads] = useState<GoingSquad[]>([]);
  const squad = useSquadPlans(
    currentUserId,
    event?.groupId ? [{ id: event.id, groupId: event.groupId }] : [],
    (groupId) => {
      onClose();
      onOpenVotes(groupId);
    },
  );
  const stance = event?.groupId
    ? squad.stanceFor({ id: event.id, groupId: event.groupId })
    : { kind: 'rsvp' as const, via: null, skipLabel: null, skipWaiting: false };
  const canAnswer = stance !== null && stance.kind === 'rsvp';

  const place = placeLines(event?.location, event?.placeLabel);

  useEffect(() => {
    const open = event;
    if (!open) return;

    let cancelled = false;
    setConfirming(false);
    setGoingSquads([]);

    async function load() {
      setError(null);
      try {
        const [rows, squads] = await Promise.all([
          getAttendees(open!.id),
          getGoingSquads(open!.id).catch(() => [] as GoingSquad[]),
        ]);
        if (cancelled) return;
        setAttendees(rows);
        setGoingSquads(squads);
      }
      catch {
        if (!cancelled) setError('Could not load who is coming.');
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
    catch {
      setError('Could not save your answer. Try again.');
    }
    finally {
      setSaving(false);
    }
  }

  // Says yes to the acting squad's vote to go, or to skip; with none open to
  // answer, the Votes page.
  async function handleSquad(which: 'go' | 'skip') {
    if (!event?.groupId) return;
    const plan = { id: event.id, groupId: event.groupId };
    const ok = which === 'go' ? await squad.act(plan) : await squad.skip(plan);
    if (!ok) return;
    setGoingSquads(await getGoingSquads(event.id).catch(() => goingSquads));
    await onChanged();
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
    catch {
      setError('Could not delete the event.');
    }
    finally {
      setSaving(false);
    }
  }

  const going = attendees.filter((a) => a.status === 'in');

  const myStatus = attendees.find((a) => a.id === currentUserId)?.status;
  const isOwner = event?.createdBy !== undefined && event.createdBy === currentUserId;
  const started = event !== null && event.date <= keyOf(new Date());

  return (
    <Modal
      visible={!!event}
      transparent
      animationType="slide"
      onRequestClose={function () {
        if (!saving) onClose();
      }}
    >
      <View style={styles.backdrop}>
        <Pressable
          style={styles.dismiss}
          onPress={function () {
            if (!saving) onClose();
          }}
          accessibilityRole="button"
          accessibilityLabel="Close"
        />

        <View style={styles.sheet}>
          {event ? (
            <>
              {event.lat !== undefined && event.lng !== undefined ? (
                  <Map
                    pins={[
                      {
                        id: event.id,
                        lat: event.lat,
                        lng: event.lng,
                        label: place.primary || event.title,
                      },
                      ...livePeople.map((person) => ({
                        id: `person-${person.id}`,
                        lat: person.lat,
                        lng: person.lng,
                        label: person.name,
                        color: solidFor(person.name),
                        badge: person.name.trim().charAt(0).toUpperCase() || '?',
                      })),
                    ]}
                    showsUserLocation
                    interactive
                    spanKm={0.9}
                    style={styles.canvas}
                  />
              ) : null}

              <View style={styles.header}>
                <LinearGradient
                  colors={['rgba(8,16,28,0.86)', 'rgba(8,16,28,0.62)', 'rgba(8,16,28,0)']}
                  locations={[0, 0.65, 1]}
                  style={StyleSheet.absoluteFill}
                  pointerEvents="none"
                />
                <View style={styles.grabber} />

                <View style={styles.topRow}>
                  <View style={styles.groupPill}>
                    <View style={styles.groupDot} />
                    <Text style={styles.groupName} numberOfLines={1}>{event.groupName}</Text>
                  </View>
                  <View style={styles.spacer} />
                  <Text style={styles.code}>№ {ticketCode(event.id)}</Text>

                  <Pressable
                    onPress={onClose}
                    disabled={saving}
                    accessibilityRole="button"
                    accessibilityLabel="Close"
                    style={({ pressed }) => [styles.round, pressed && styles.pressed]}
                  >
                    <Ionicons name="close" size={18} color="#FFFFFF" />
                  </Pressable>
                </View>

                <Text style={styles.title} numberOfLines={3}>{event.title}</Text>
                <Text style={styles.when}>{formatDateTime(event.date, event.startTime)}</Text>
                {place.primary ? (
                  <Text style={styles.where} numberOfLines={1}>{place.primary}</Text>
                ) : null}
                {place.secondary ? (
                  <Text style={styles.whereSub} numberOfLines={2}>{place.secondary}</Text>
                ) : null}
                {stance && stance.kind === 'rsvp' && stance.via ? (
                  <View style={styles.via}>
                    <Text style={styles.viaText} numberOfLines={1}>{stance.via} is going</Text>
                  </View>
                ) : null}

                <View style={styles.actions}>
                  {canAnswer ? (<>
                  <Pressable
                    onPress={() => handleRsvp(myStatus === 'in' ? null : 'in')}
                    disabled={saving}
                    accessibilityRole="button"
                    accessibilityLabel="I'm in"
                    accessibilityState={{ selected: myStatus === 'in', disabled: saving }}
                    style={({ pressed }) => [
                      styles.round,
                      styles.roundBig,
                      myStatus === 'in' && styles.roundUp,
                      pressed && styles.pressed,
                    ]}
                  >
                    <Ionicons
                      name={myStatus === 'in' ? 'thumbs-up' : 'thumbs-up-outline'}
                      size={20}
                      color="#FFFFFF"
                    />
                  </Pressable>

                  <Pressable
                    onPress={() => handleRsvp(myStatus === 'out' ? null : 'out')}
                    disabled={saving}
                    accessibilityRole="button"
                    accessibilityLabel="Pass"
                    accessibilityState={{ selected: myStatus === 'out', disabled: saving }}
                    style={({ pressed }) => [
                      styles.round,
                      styles.roundBig,
                      myStatus === 'out' && styles.roundDown,
                      pressed && styles.pressed,
                    ]}
                  >
                    <Ionicons
                      name={myStatus === 'out' ? 'thumbs-down' : 'thumbs-down-outline'}
                      size={20}
                      color="#FFFFFF"
                    />
                  </Pressable>
                  </>) : null}
                  {stance && stance.kind !== 'rsvp' ? (
                    stance.kind === 'no-squad' ? (
                      <Text style={styles.squadNote}>{stance.text}</Text>
                    ) : (
                      <Pressable
                        onPress={() => handleSquad('go')}
                        disabled={squad.busyId !== null}
                        accessibilityRole="button"
                        accessibilityLabel={stance.label}
                        accessibilityHint={stance.kind === 'propose' || stance.waiting ? 'Opens Votes' : undefined}
                        style={({ pressed }) => [styles.squadButton, pressed && styles.pressed]}
                      >
                        <Ionicons
                          name={stance.kind === 'propose' ? 'people-outline' : stance.waiting ? 'time-outline' : 'thumbs-up-outline'}
                          size={17}
                          color="#FFFFFF"
                        />
                        <Text style={styles.squadButtonText} numberOfLines={1}>{stance.label}</Text>
                      </Pressable>
                    )
                  ) : null}

                  <Pressable
                    onPress={() => setRoster(true)}
                    accessibilityRole="button"
                    accessibilityLabel="See who is coming"
                    style={({ pressed }) => [styles.round, styles.roundBig, pressed && styles.pressed]}
                  >
                    <Ionicons name="people-outline" size={20} color="#FFFFFF" />
                    {going.length > 0 ? (
                      <View style={styles.badge}>
                        <Text style={styles.badgeText}>{going.length}</Text>
                      </View>
                    ) : null}
                  </Pressable>
                </View>
              </View>

              <View style={styles.gap} pointerEvents="none" />

              <View style={styles.body}>
                {event.description ? (
                  <Text style={styles.description}>{event.description}</Text>
                ) : null}

                {error ? <Text style={styles.error}>{error}</Text> : null}
                {squad.error ? <Text style={styles.error}>{squad.error}</Text> : null}

                {goingSquads.length > 0 ? (
                  <View style={styles.squads}>
                    <Text style={styles.squadsTitle}>SQUADS GOING</Text>
                    <View style={styles.squadsRow}>
                      {goingSquads.map((one) => (
                        <View key={one.id} style={styles.squadChip}>
                          <Monogram name={one.name} uri={one.avatarUrl} size={22} />
                          <Text style={styles.squadName} numberOfLines={1}>{one.name}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                ) : null}

                {stance && stance.kind === 'rsvp' && stance.skipLabel ? (
                  <Pressable
                    onPress={() => handleSquad('skip')}
                    disabled={squad.busyId !== null}
                    accessibilityRole="button"
                    accessibilityLabel={stance.skipLabel}
                    accessibilityHint={stance.skipWaiting || stance.skipLabel === 'Vote to skip' ? 'Opens Votes' : undefined}
                    style={({ pressed }) => [styles.skip, pressed && styles.pressed]}
                  >
                    <Text style={styles.skipText}>{stance.skipLabel}</Text>
                  </Pressable>
                ) : null}

                {started && event.groupId ? (
                  <View style={styles.photos}>
                    <EventPhotos
                      key={event.id}
                      eventId={event.id}
                      groupId={event.groupId}
                      currentUserId={currentUserId}
                      canAdd={myStatus === 'in'}
                      shareable={event.isPublic === true}
                      onChanged={onPhotosChanged}
                    />
                  </View>
                ) : null}

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
        </View>
      </View>

      <AttendeeSheet visible={roster} attendees={attendees} onClose={() => setRoster(false)} />

    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' },
  dismiss: { flex: 1 },
  sheet: {
    height: '94%',
    overflow: 'hidden',
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    backgroundColor: colors.bg,
  },

  header: { paddingHorizontal: space.md, paddingTop: space.md, paddingBottom: space.xl },
  canvas: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    height: undefined,
  },
  gap: { flex: 1 },
  actions: { flexDirection: 'row', gap: space.sm, marginTop: space.md },
  round: {
    width: 32,
    height: 32,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
  roundBig: { width: 42, height: 42 },
  roundUp: { backgroundColor: colors.success },
  roundDown: { backgroundColor: colors.danger },
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 16,
    height: 16,
    paddingHorizontal: 3,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
  },
  badgeText: { color: '#FFFFFF', ...typo.semi, fontSize: 9.5 },
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
    flexShrink: 1,
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
    paddingTop: space.sm,
    paddingBottom: space.lg,
  },
  photos: {
    padding: space.md,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
  },
  description: { color: colors.text, ...typo.medium, fontSize: textSize.base, lineHeight: 20 },

  error: { color: colors.danger, ...typo.medium, fontSize: textSize.body },

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
  via: {
    alignSelf: 'flex-start',
    marginTop: space.xs,
    paddingHorizontal: space.sm,
    paddingVertical: 3,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
  viaText: { color: '#FFFFFF', ...typo.semi, fontSize: textSize.caption },
  squadButton: {
    flexShrink: 1,
    height: 42,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    paddingHorizontal: space.md,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
  },
  squadButtonText: { flexShrink: 1, color: '#FFFFFF', ...typo.semi, fontSize: textSize.base },
  squadNote: { alignSelf: 'center', color: 'rgba(255,255,255,0.78)', ...typo.medium, fontSize: textSize.small },
  squads: { gap: space.xs, padding: space.md, borderRadius: radius.lg, backgroundColor: colors.surface },
  squadsTitle: { color: colors.textFaint, ...typo.mono, fontSize: textSize.caption, letterSpacing: 1.2 },
  squadsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs },
  squadChip: { flexDirection: 'row', alignItems: 'center', gap: space.xxs, maxWidth: '100%' },
  squadName: { color: colors.text, ...typo.semi, fontSize: textSize.small },
  skip: {
    alignSelf: 'center',
    minHeight: 36,
    justifyContent: 'center',
    paddingHorizontal: space.md,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  skipText: { color: colors.textSoft, ...typo.semi, fontSize: textSize.small },
});
