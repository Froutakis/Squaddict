import { useEffect, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Linking, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { Attendee, RsvpStatus } from '../../services/serviceEvents';
import { clearRsvp, deleteEvent, getAttendees, setRsvp } from '../../services/serviceEvents';
import { colors, scrim, solidFor, typo, radius, space, textSize } from '../../theme';
import { formatDateTime, isHappeningNow, keyOf } from '../../lib/datetime';
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
import AnswerSeg, { toStatus, type Answer } from '../general/AnswerSeg';
import { OnNow } from '../home/PlanTicket';
import ReportSheet from '../general/ReportSheet';
import type { ReportTarget } from '../../services/serviceSafety';

export type SheetEvent = {
  id: string;
  groupId?: string;
  isPublic?: boolean;
  groupName: string;
  title: string;
  date: string;
  startTime?: string;
  endTime?: string;
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
  // A plan from outside your pareas, being reported.
  const [reporting, setReporting] = useState<ReportTarget | null>(null);
  const [actingId, setActingId] = useState<string | null>(null);
  const [mates, setMates] = useState<Set<string>>(new Set());
  const [suggesting, setSuggesting] = useState(false);
  const [suggestNote, setSuggestNote] = useState<string | null>(null);
  // Maybe is not saved (only in and out are); it is remembered while the sheet is open.

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
      setError('Could not delete the plan.');
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

  const live = event !== null && isHappeningNow(event.date, event.startTime, event.endTime);
  const answerValue: Answer | null = myStatus ?? null;
  const hasMap = event?.lat !== undefined && event?.lng !== undefined;
  const subtitle = event?.description?.trim() || (live && event ? `Hosted by ${event.groupName}` : null);

  // The facts that are known, two to a row.
  // lines: how many lines the value may take before it ends in "…".
  const facts: { label: string; value: string; mono?: boolean; lines?: number }[] = [];
  if (event) {
    facts.push({ label: 'When', value: formatDateTime(event.date, event.startTime), mono: true });
    if (place.primary) facts.push({ label: 'Where', value: place.primary, lines: 1 });
    facts.push({ label: 'Going', value: going.length === 0 ? 'Nobody yet' : going.length === 1 ? '1 person' : `${going.length} people` });
    if (fromPareas.length > 0) facts.push({ label: 'From your pareas', value: friendsLine(fromPareas) });
  }

  function answer(choice: Answer) {
    const status = toStatus(choice);
    if (status === (myStatus ?? null)) return;
    handleRsvp(status);
  }

  function directions() {
    if (!event) return;
    const where = hasMap ? `${event.lat},${event.lng}` : place.primary ?? '';
    if (!where) return;
    Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(where)}`).catch(() => {
      setError('Could not open the map.');
    });
  }

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
            <ScrollView
              style={styles.bodyScroll}
              contentContainerStyle={styles.body}
              bounces={false}
              showsVerticalScrollIndicator={false}
            >
              <Pressable
                onPress={function () {
                  if (!saving) onClose();
                }}
                accessibilityRole="button"
                accessibilityLabel="Close the plan"
                hitSlop={10}
                style={styles.grabWrap}
              >
                <View style={styles.grabber} />
              </Pressable>

              <View style={styles.topRow}>
                {live ? (
                  <OnNow big />
                ) : (
                  <Text style={styles.groupName} numberOfLines={1}>{event.groupName}</Text>
                )}
                <View style={styles.spacer} />
                <Text style={styles.kind}>{event.isPublic ? 'Public plan' : 'Plan'}</Text>
                <Text style={styles.code}>№ {ticketCode(event.id)}</Text>
              </View>

              <Text style={styles.title} numberOfLines={3}>{event.title}</Text>
              {subtitle ? <Text style={styles.subtitle} numberOfLines={2}>{subtitle}</Text> : null}

              <View style={styles.facts}>
                {facts.map((fact) => (
                  <View key={fact.label} style={styles.fact} accessible accessibilityLabel={`${fact.label}: ${fact.value}`}>
                    <Text style={styles.factLabel}>{fact.label}</Text>
                    <Text style={[styles.factValue, fact.mono && styles.factMono]} numberOfLines={fact.lines ?? 2} ellipsizeMode="tail">{fact.value}</Text>
                  </View>
                ))}
              </View>
              {place.secondary ? <Text style={styles.whereSub} numberOfLines={2}>{place.secondary}</Text> : null}

              <View style={styles.answer}>
                <AnswerSeg tone="sheet" value={answerValue} onChange={answer} disabled={saving} />
              </View>

              <Pressable
                onPress={() => setRoster(true)}
                accessibilityRole="button"
                accessibilityLabel="See who is coming"
                style={({ pressed }) => [styles.who, pressed && styles.pressed]}
              >
                {going.length > 0 ? <AttendeeStack people={going} size={24} max={3} /> : null}
                <Text style={styles.whoText} numberOfLines={1}>
                  {going.length === 0
                    ? 'Nobody in yet'
                    : fromPareas.length > 0
                      ? `${fromPareas.length} from your pareas going`
                      : `${going.length} going`}
                </Text>
                <Ionicons name="chevron-forward" size={15} color={colors.textFaint} />
              </Pressable>

              {error ? <Text style={styles.error}>{error}</Text> : null}

              <View style={styles.acts}>
                {hasMap || place.primary ? (
                  <Pressable
                    onPress={directions}
                    accessibilityRole="button"
                    accessibilityLabel="Directions"
                    accessibilityHint="Opens the place in your map app"
                    style={({ pressed }) => [styles.btn, styles.btnSoft, pressed && styles.btnPressed]}
                  >
                    <Ionicons name="navigate-outline" size={17} color={colors.text} />
                    <Text style={styles.btnSoftText}>Directions</Text>
                  </Pressable>
                ) : null}
                {suggestTo ? (
                  <Pressable
                    onPress={() => handleSuggest(suggestTo)}
                    disabled={suggesting}
                    accessibilityRole="button"
                    accessibilityLabel={`Suggest to ${suggestTo.name}`}
                    accessibilityHint="Posts this plan in the parea's chat. Everyone answers on their own"
                    accessibilityState={{ disabled: suggesting }}
                    style={({ pressed }) => [styles.btn, styles.btnAccent, (pressed || suggesting) && styles.btnPressed]}
                  >
                    <Ionicons name="paper-plane-outline" size={17} color={colors.onInk} />
                    <Text style={styles.btnAccentText} numberOfLines={1}>
                      {suggesting ? 'Suggesting…' : 'Suggest'}
                    </Text>
                  </Pressable>
                ) : (
                  <Pressable
                    onPress={() => setRoster(true)}
                    accessibilityRole="button"
                    accessibilityLabel="Who's going"
                    style={({ pressed }) => [styles.btn, styles.btnAccent, pressed && styles.btnPressed]}
                  >
                    <Ionicons name="people-outline" size={17} color={colors.onInk} />
                    <Text style={styles.btnAccentText} numberOfLines={1}>Who's going</Text>
                  </Pressable>
                )}
              </View>
              {suggestNote ? (
                <Text style={styles.suggestNote} accessibilityLiveRegion="polite">{suggestNote}</Text>
              ) : null}

              {hasMap ? (
                <View style={styles.mapCard}>
                  <Map
                    pins={[
                      {
                        id: event.id,
                        lat: event.lat!,
                        lng: event.lng!,
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
                </View>
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

              {/* A plan from outside your pareas can be reported. */}
              {!isOwner && !hostIsMine ? (
                <Pressable
                  onPress={() =>
                    setReporting({
                      kind: 'plan',
                      id: event.id,
                      userId: event.createdBy ?? null,
                      userName: attendees.find((a) => a.id === event.createdBy)?.name ?? null,
                      label: `${event.title}, ${event.groupName}`,
                    })
                  }
                  accessibilityRole="button"
                  accessibilityLabel="Report this plan"
                  hitSlop={6}
                  style={({ pressed }) => [styles.report, pressed && styles.pressed]}
                >
                  <Ionicons name="flag-outline" size={15} color={colors.textSoft} />
                  <Text style={styles.reportText}>Report this plan</Text>
                </Pressable>
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
                        accessibilityLabel="Edit plan"
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
                      accessibilityLabel="Delete plan"
                      style={({ pressed }) => [styles.ownerBtn, pressed && styles.pressed]}
                    >
                      <Ionicons name="trash-outline" size={17} color={colors.danger} />
                      <Text style={styles.deleteText}>Delete</Text>
                    </Pressable>
                  </View>
                )
              ) : null}
            </ScrollView>
          ) : null}
        </View>
      </View>

      <AttendeeSheet visible={roster} attendees={attendees} onClose={() => setRoster(false)} />

      <ReportSheet target={reporting} userId={currentUserId} onClose={() => setReporting(null)} />
    </Modal>
  );
}

const styles = StyleSheet.create({
  report: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, minHeight: 44, marginTop: space.sm },
  reportText: { color: colors.textSoft, ...typo.semi, fontSize: textSize.body },
  backdrop: { flex: 1, backgroundColor: scrim.sheet },
  dismiss: { flex: 1 },
  sheet: {
    maxHeight: '92%',
    overflow: 'hidden',
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
    backgroundColor: colors.surface,
  },
  bodyScroll: { flexGrow: 0, flexShrink: 1 },
  body: {
    paddingHorizontal: 20,
    paddingTop: space.sm,
    // Clear of the iPhone home indicator.
    paddingBottom: 34,
  },
  grabWrap: { alignSelf: 'center', paddingVertical: 6, marginBottom: 8 },
  grabber: { width: 40, height: 5, borderRadius: 3, backgroundColor: colors.border },

  topRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: 24 },
  spacer: { flex: 1 },
  groupName: { flexShrink: 1, color: colors.textSoft, ...typo.medium, fontSize: 13.5 },
  kind: { color: colors.textSoft, ...typo.medium, fontSize: 13.5 },
  code: { color: colors.textFaint, ...typo.mono, fontSize: 10, letterSpacing: 1 },
  title: { marginTop: space.sm, color: colors.text, ...typo.display, fontSize: 24, lineHeight: 27, letterSpacing: -0.8 },
  subtitle: { marginTop: 4, color: colors.textSoft, ...typo.medium, fontSize: 13.5, lineHeight: 19 },

  facts: { marginTop: 14, flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  // minWidth 0 lets a long value shrink and end in "…" instead of spilling off the left.
  fact: { flexGrow: 1, flexBasis: '45%', minWidth: 0, overflow: 'hidden', paddingVertical: 10, paddingHorizontal: 12, borderRadius: 12, backgroundColor: colors.bg },
  factLabel: { color: colors.textFaint, ...typo.medium, fontSize: 11.5 },
  factValue: { marginTop: 1, color: colors.text, ...typo.semi, fontSize: 14.5, textAlign: 'left', writingDirection: 'ltr' },
  factMono: { ...typo.mono, fontWeight: '600' },
  whereSub: { marginTop: 6, color: colors.textFaint, ...typo.medium, fontSize: textSize.small, lineHeight: 17 },

  answer: { marginTop: space.md },
  who: { marginTop: space.md, flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: 32 },
  whoText: { flex: 1, color: colors.textSoft, ...typo.medium, fontSize: 13.5 },

  acts: { marginTop: space.md, flexDirection: 'row', gap: 8 },
  btn: {
    flex: 1,
    height: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingHorizontal: space.md,
    borderRadius: radius.pill,
  },
  btnSoft: { backgroundColor: colors.sunk },
  btnAccent: { backgroundColor: colors.primary },
  btnPressed: { transform: [{ scale: 0.97 }], opacity: 0.9 },
  btnSoftText: { color: colors.text, ...typo.semi, fontSize: 14.5 },
  btnAccentText: { flexShrink: 1, color: colors.onInk, ...typo.semi, fontSize: 14.5 },
  suggestNote: { marginTop: space.xs, color: colors.success, ...typo.medium, fontSize: textSize.small, textAlign: 'center' },

  mapCard: { marginTop: space.md, height: 220, borderRadius: 14, overflow: 'hidden', backgroundColor: colors.bg },
  canvas: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    height: undefined,
  },
  photos: {
    marginTop: space.md,
    padding: space.md,
    borderRadius: 12,
    backgroundColor: colors.bg,
  },

  error: { marginTop: space.sm, color: colors.danger, ...typo.medium, fontSize: textSize.body },

  ownerRow: { marginTop: space.md, flexDirection: 'row', gap: space.sm },
  ownerBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.xs,
    minHeight: 44,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  pressed: { opacity: 0.7 },
  editText: { color: colors.textSoft, ...typo.semi, fontSize: textSize.base },
  deleteText: { color: colors.danger, ...typo.semi, fontSize: textSize.base },
  confirmRow: { marginTop: space.md, flexDirection: 'row', gap: space.sm },
  confirmBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
    borderRadius: radius.pill,
    borderWidth: 1.5,
  },
  cancelBtn: { borderColor: colors.border, backgroundColor: colors.surface },
  cancelText: { color: colors.textSoft, ...typo.semi, fontSize: textSize.base },
  dangerBtn: { borderColor: colors.danger, backgroundColor: colors.danger },
  dangerText: { color: '#FFFFFF', ...typo.semi, fontSize: textSize.base },
});
