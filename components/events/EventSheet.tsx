import { useEffect, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
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
import { getGroupsForUser, getSquadmateIds, type Group } from '../../services/serviceGroup';
import { getActingGroupId } from '../../services/serviceUser';
import { suggestPlan } from '../../services/serviceSuggestions';
import { pickActing } from '../../lib/acting';
import { errorText } from '../../lib/postgres';
import AttendeeStack from './Attendee';
import { friendsLine } from './EventCard';

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
};

export default function EventSheet({
  event,
  livePeople = [],
  currentUserId,
  onClose,
  onChanged,
  onEdit,
  onPhotosChanged,
}: EventSheetProps) {
  const [roster, setRoster] = useState(false);
  const [attendees, setAttendees] = useState<Attendee[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  // Your pareas, the one you act as, and everyone in them: for "From your
  // pareas" and "Suggest to my parea".
  const [myGroups, setMyGroups] = useState<Group[]>([]);
  const [actingId, setActingId] = useState<string | null>(null);
  const [mates, setMates] = useState<Set<string>>(new Set());
  const [suggesting, setSuggesting] = useState(false);
  const [suggestNote, setSuggestNote] = useState<string | null>(null);

  const place = placeLines(event?.location, event?.placeLabel);

  useEffect(() => {
    const open = event;
    if (!open) return;

    let cancelled = false;
    setConfirming(false);
    setSuggestNote(null);

    async function load() {
      setError(null);
      try {
        const rows = await getAttendees(open!.id);
        if (!cancelled) setAttendees(rows);
      }
      catch {
        if (!cancelled) setError('Could not load who is coming.');
      }
    }

    load();
    return () => { cancelled = true; };
  }, [event?.id]);

  // Who you hang out with: read once per person, quietly (it only adds lines).
  useEffect(() => {
    let cancelled = false;
    Promise.all([
      getGroupsForUser(currentUserId),
      getActingGroupId(currentUserId).catch(() => null),
      getSquadmateIds(currentUserId).catch(() => [] as string[]),
    ])
      .then(([groups, acting, ids]) => {
        if (cancelled) return;
        setMyGroups(groups);
        setActingId(acting);
        setMates(new Set(ids));
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [currentUserId]);

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

  // Posts the plan as a card in the parea's chat. Not a vote: everyone there
  // answers it on their own.
  async function handleSuggest(to: Group) {
    if (!event || suggesting) return;

    setSuggesting(true);
    setSuggestNote(null);
    setError(null);
    try {
      const posted = await suggestPlan(to.id, event.id);
      setSuggestNote(posted ? `Suggested in ${to.name}'s chat.` : `Already suggested in ${to.name}.`);
    }
    catch (problem) {
      setError(errorText(problem, 'Could not suggest it. Try again.'));
    }
    finally {
      setSuggesting(false);
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
  const today = keyOf(new Date());
  const started = event !== null && event.date <= today;

  // Another parea's plan: who from your pareas said I'm in.
  const hostIsMine = event?.groupId !== undefined && myGroups.some((group) => group.id === event.groupId);
  const fromPareas = hostIsMine ? [] : going.filter((person) => person.id !== currentUserId && mates.has(person.id));

  // A public plan still ahead can go to a parea of yours that isn't hosting
  // it: the one you act as, or else your first one.
  const canSuggestTo = event?.isPublic === true && event.date >= today
    ? myGroups.filter((group) => group.id !== event.groupId)
    : [];
  const suggestTo = pickActing(canSuggestTo, actingId);

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
                <View style={styles.actions}>
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

              {/* The part under the map scrolls when it is taller than the room left,
                  so photos and Edit/Delete are never cut off on a short phone. */}
              <ScrollView
                style={styles.bodyScroll}
                contentContainerStyle={styles.body}
                bounces={false}
                showsVerticalScrollIndicator={false}
              >
                {event.description ? (
                  <Text style={styles.description}>{event.description}</Text>
                ) : null}

                {error ? <Text style={styles.error}>{error}</Text> : null}

                {fromPareas.length > 0 ? (
                  <View style={styles.squads} accessible accessibilityLabel={`From your pareas: ${friendsLine(fromPareas)}`}>
                    <Text style={styles.squadsTitle}>FROM YOUR PAREAS</Text>
                    <View style={styles.squadsRow}>
                      <AttendeeStack people={fromPareas} size={22} max={4} />
                      <Text style={styles.squadName} numberOfLines={2}>{friendsLine(fromPareas)}</Text>
                    </View>
                  </View>
                ) : null}

                {suggestTo ? (
                  <Pressable
                    onPress={() => handleSuggest(suggestTo)}
                    disabled={suggesting}
                    accessibilityRole="button"
                    accessibilityLabel={`Suggest to ${suggestTo.name}`}
                    accessibilityHint="Posts this plan in the parea's chat. Everyone answers on their own"
                    accessibilityState={{ disabled: suggesting }}
                    style={({ pressed }) => [styles.suggest, (pressed || suggesting) && styles.pressed]}
                  >
                    <Ionicons name="paper-plane-outline" size={17} color={colors.text} />
                    <Text style={styles.suggestText} numberOfLines={1}>
                      {suggesting ? 'Suggesting…' : `Suggest to ${suggestTo.name}`}
                    </Text>
                  </Pressable>
                ) : null}
                {suggestNote ? (
                  <Text style={styles.suggestNote} accessibilityLiveRegion="polite">{suggestNote}</Text>
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
              </ScrollView>
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

  bodyScroll: { flexGrow: 0, flexShrink: 1 },
  body: {
    gap: space.sm,
    paddingHorizontal: space.lg,
    paddingTop: space.sm,
    // Clear of the iPhone home indicator.
    paddingBottom: space.xl,
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
  squads: { gap: space.xs, padding: space.md, borderRadius: radius.lg, backgroundColor: colors.surface },
  squadsTitle: { color: colors.textFaint, ...typo.mono, fontSize: textSize.caption, letterSpacing: 1.2 },
  squadsRow: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  squadName: { flexShrink: 1, color: colors.text, ...typo.semi, fontSize: textSize.small },
  suggest: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.xs,
    paddingHorizontal: space.md,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  suggestText: { flexShrink: 1, color: colors.text, ...typo.semi, fontSize: textSize.base },
  suggestNote: { color: colors.success, ...typo.medium, fontSize: textSize.small, textAlign: 'center' },
});
