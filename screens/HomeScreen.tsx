import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { User as AuthUser } from '@supabase/supabase-js';
import { ActivityIndicator, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { Group } from '../services/serviceGroup';
import type { EventPhoto, MyEvent, RsvpStatus } from '../services/serviceEvents';
import { getUserById } from '../services/serviceUser';
import { getGroupsForUser } from '../services/serviceGroup';
import { clearRsvp, getEventCovers, getMyEvents, setRsvp } from '../services/serviceEvents';
import { signImages } from '../services/serviceMedia';
import { mergeSigned, pathsToSign, type SignedMap } from '../components/chat/media';
import { colors, typo, layout, space } from '../theme';
import {
  countdownLabel,
  dayFilterLabel,
  inPhotoWindow,
  isHappeningNow,
  keyOf,
  liveLabel,
} from '../lib/datetime';
import HomeHeader from '../components/home/HomeHeader';
import { useNow } from '../components/home/useNow';
import { userPrefix } from '../components/chat/cache';
import { readJson, writeJson } from '../lib/store';
import DayFilterRow from '../components/home/DayFilterRow';
import ListEmpty from '../components/home/ListEmpty';
import SectionHead from '../components/general/SectionHead';
import PlanCard from '../components/home/PlanCard';
import Button from '../components/general/Button';
import CalendarCard from '../components/events/CalendarCard';
import EventCard, { type CardEvent } from '../components/events/EventCard';
import UpNext from '../components/events/UpNext';
import {
  capture,
  messageFor,
  PhotoSourceSheet,
  type PhotoSource,
} from '../components/events/EventPhotos';
import EventSheet, { type SheetEvent } from '../components/events/EventSheet';
import { useLiveLocations } from '../components/events/useLiveLocations';
import EventFormSheet from '../components/events/EventFormSheet';
import GroupFormSheet from '../components/group/GroupFormSheet';

const RENEW_TICK_MS = 5 * 60 * 1000;

type HomeScreenProps = {
  user: AuthUser;
  createNonce?: number;
};

function planLine(event: MyEvent): string {
  const parts: string[] = [];
  if (event.startTime) parts.push(event.startTime);
  if (event.placeLabel ?? event.location) parts.push((event.placeLabel ?? event.location) as string);
  parts.push(`${event.going.length} in`);
  return parts.join(' · ');
}

function toCardData(event: MyEvent): CardEvent {
  return {
    id: event.id,
    title: event.title,
    date: event.date,
    startTime: event.startTime,
    location: event.location,
    placeLabel: event.placeLabel,
    groupName: event.groupName,
    myStatus: event.myStatus,
    going: event.going,
    goingCount: event.going.length,
  };
}

export default function HomeScreen({ user, createNonce = 0 }: HomeScreenProps) {
  const [displayName, setDisplayName] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [groups, setGroups] = useState<Group[]>([]);
  const [events, setEvents] = useState<MyEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [groupId, setGroupId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [showGroupForm, setShowGroupForm] = useState(false);
  const [formDate, setFormDate] = useState<string | null>(null);
  const [openEvent, setOpenEvent] = useState<SheetEvent | null>(null);
  const [editEvent, setEditEvent] = useState<MyEvent | null>(null);
  const [rsvpError, setRsvpError] = useState<string | null>(null);
  const [checkedIn, setCheckedIn] = useState<Record<string, true>>({});
  const [coverPhotos, setCoverPhotos] = useState<Record<string, EventPhoto>>({});
  const [signed, setSigned] = useState<SignedMap>({});
  const [clock, setClock] = useState(0);
  const [photoNonce, setPhotoNonce] = useState(0);
  const [addingPhoto, setAddingPhoto] = useState<MyEvent | null>(null);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    readJson<Record<string, true>>(userPrefix(user.id) + 'checkedin').then((stored) => {
      if (!cancelled && stored) setCheckedIn(stored);
    });

    return () => {
      cancelled = true;
    };
  }, [user.id]);

  async function pickPhoto(source: PhotoSource) {
    const target = addingPhoto;
    if (!target || photoBusy) return;

    setPhotoBusy(true);
    setPhotoError(null);

    try {
      const result = await capture(source, { id: target.id, groupId: target.groupId });
      setAddingPhoto(null);
      if (result) setPhotoNonce((n) => n + 1);
    } catch (problem) {
      setPhotoError(messageFor(problem));
      setAddingPhoto(null);
    } finally {
      setPhotoBusy(false);
    }
  }

  function checkIn(eventId: string) {
    const next = { ...checkedIn, [eventId]: true as const };
    setCheckedIn(next);
    writeJson(userPrefix(user.id) + 'checkedin', next);
  }

  const load = useCallback(
    async function load() {
      setLoading(true);
      setError(null);

      try {
        const [profile, myGroups, myEvents] = await Promise.all([
          getUserById(user.id),
          getGroupsForUser(user.id),
          getMyEvents(user.id),
        ]);

        setDisplayName(profile?.name ?? '');
        setAvatarUrl(profile?.avatarUrl ?? null);
        setGroups(myGroups);
        setEvents(myEvents);
      } catch {
        setError("Couldn't load your week");
      } finally {
        setLoading(false);
      }
    },
    [user.id],
  );

  useEffect(() => {
    load();
  }, [load]);

  function applyRsvp(list: MyEvent[], eventId: string, status: RsvpStatus | null): MyEvent[] {
    return list.map(function (event) {
      if (event.id !== eventId) {
        return event;
      }

      const others = event.going.filter((person) => person.id !== user.id);
      const going =
        status === 'in' ? [...others, { id: user.id, name: displayName }] : others;

      return { ...event, myStatus: status ?? undefined, going };
    });
  }

  async function handleRsvp(eventId: string, status: RsvpStatus | null) {
    const previous = events;

    setRsvpError(null);
    setEvents(applyRsvp(events, eventId, status));

    try {
      if (status) {
        await setRsvp(eventId, status);
      } else {
        await clearRsvp(eventId);
      }
    } catch {
      setEvents(previous);
      setRsvpError('Could not save your answer. Try again.');
    }
  }

  useEffect(() => {
    if (createNonce > 0) openNewEvent(selectedDate);
  }, [createNonce]);

  function openNewEvent(date: string | null) {
    setEditEvent(null);
    setFormDate(date);
    setShowCreate(true);
  }

  const now = useNow();
  const today = keyOf(new Date());
  const dayMode = selectedDate !== null;
  const visible = groupId ? events.filter((e) => e.groupId === groupId) : events;
  const upcoming = visible.filter((e) => e.date >= today);
  const upNextEvent = dayMode ? undefined : upcoming.find((e) => e.myStatus !== 'out');
  const liveEvent = dayMode
    ? undefined
    : visible.find(
        (e) => e.myStatus !== 'out' && isHappeningNow(e.date, e.startTime, e.endTime, now),
      );
  const heroEvent = liveEvent ?? upNextEvent;
  const sharingEvent = liveEvent?.myStatus === 'in' ? liveEvent : undefined;
  const livePeople = useLiveLocations(sharingEvent?.id, { id: user.id, name: displayName });
  const pool = dayMode
    ? visible.filter((e) => e.date === selectedDate)
    : upcoming.filter((e) => e.id !== heroEvent?.id);
  const waiting = pool.filter((e) => e.myStatus === undefined);
  const later = pool.filter((e) => e.myStatus !== undefined);
  const wantsPhoto = visible.find(
    (e) => e.myStatus === 'in' && inPhotoWindow(e.date, e.startTime, e.endTime),
  );

  const pastIds = events
    .filter((e) => e.date < today)
    .map((e) => e.id)
    .sort()
    .join(',');

  useEffect(() => {
    const tick = setInterval(() => setClock((c) => c + 1), RENEW_TICK_MS);
    return () => clearInterval(tick);
  }, []);

  useEffect(() => {
    if (pastIds === '') {
      setCoverPhotos({});
      return;
    }

    let cancelled = false;

    getEventCovers(pastIds.split(','))
      .then((byEvent) => {
        if (!cancelled) setCoverPhotos(byEvent);
      })
      .catch(() => {
        if (!cancelled) setCoverPhotos({});
      });

    return () => {
      cancelled = true;
    };
  }, [pastIds, photoNonce]);

  useEffect(() => {
    const paths = Object.values(coverPhotos).map((photo) => photo.path);
    const missing = pathsToSign(paths, signed, Date.now());
    if (missing.length === 0) return;

    let cancelled = false;

    signImages(missing)
      .then((fresh) => {
        if (!cancelled) setSigned((prev) => mergeSigned(prev, fresh));
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [coverPhotos, signed, clock]);

  const covers = useMemo(() => {
    const byDate: Record<string, string> = {};

    for (const event of events) {
      const photo = coverPhotos[event.id];
      const url = photo ? signed[photo.path]?.url : undefined;
      if (url && !byDate[event.date]) byDate[event.date] = url;
    }

    return byDate;
  }, [events, coverPhotos, signed]);

  function renderBody() {
    if (loading) {
      return (
        <View style={styles.state}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      );
    }

    if (error) {
      return (
        <View style={styles.state}>
          <Text style={styles.stateTitle}>{error}</Text>
          <Text style={styles.stateBody}>The connection dropped. Your plans are still there.</Text>
          <View style={styles.stateButton}>
            <Button title="Try again" onPress={load} />
          </View>
        </View>
      );
    }

    if (groups.length === 0) {
      return (
        <View style={styles.state}>
          <Text style={styles.stateTitle}>No squads yet</Text>
          <Text style={styles.stateBody}>
            Start one and send the code to your people, or paste a code somebody sent you.
          </Text>
          <View style={styles.stateButton}>
            <Button title="Start a squad" onPress={() => setShowGroupForm(true)} />
          </View>
        </View>
      );
    }

    if (events.length === 0) {
      return (
        <View style={styles.state}>
          <Text style={styles.stateTitle}>Nothing on. Suspicious.</Text>
          <Text style={styles.stateBody}>
            Your week is wide open. Somebody has to go first — might as well be you.
          </Text>
          <View style={styles.stateButton}>
            <Button title="Propose an outing" onPress={() => openNewEvent(null)} />
          </View>
        </View>
      );
    }

    return (
      <>

        {heroEvent ? (
          <View>
            <SectionHead
              title={liveEvent ? 'Happening now' : 'Up next'}
              live={liveEvent !== undefined}
              meta={
                liveEvent
                  ? liveLabel(liveEvent.date, liveEvent.startTime, liveEvent.endTime, now)
                  : countdownLabel(heroEvent.date)
              }
            />
            <View style={styles.body}>
            <UpNext
              event={heroEvent}
              live={liveEvent !== undefined}
              liveText={
                liveEvent
                  ? liveLabel(liveEvent.date, liveEvent.startTime, liveEvent.endTime, now)
                  : undefined
              }
              checkedIn={checkedIn[heroEvent.id] === true}
              onCheckIn={() => checkIn(heroEvent.id)}
              onAddPhoto={
                checkedIn[heroEvent.id] === true ? () => setAddingPhoto(heroEvent) : undefined
              }
              onPress={() => setOpenEvent(heroEvent)}
              onRsvp={(status) => handleRsvp(heroEvent.id, status)}
            />
            {photoError ? <Text style={styles.error}>{photoError}</Text> : null}
            </View>
          </View>
        ) : null}

    

        <View style={styles.body}>
          <CalendarCard
            events={visible}
            selectedDate={selectedDate}
            onSelectDate={(d) => setSelectedDate(d === selectedDate ? null : d)}
            onAddEvent={() => openNewEvent(selectedDate)}
            covers={covers}
          />
        </View>

        {dayMode ? (
          <View style={styles.body}>
            <DayFilterRow
              label={dayFilterLabel(selectedDate)}
              onClear={() => setSelectedDate(null)}
            />
          </View>
        ) : null}

        {rsvpError ? (
          <View style={styles.body}>
            <Text style={styles.error}>{rsvpError}</Text>
          </View>
        ) : null}

        <View>
          <SectionHead
            title={dayMode ? 'On this day' : 'Later'}
            meta={later.length > 0 ? `${later.length} plans` : undefined}
          />

          {later.length === 0 ? (
            <View style={styles.body}>
              {waiting.length === 0 ? (
                <ListEmpty
                  title={dayMode ? `Nothing on ${dayFilterLabel(selectedDate)}` : 'Nothing else planned'}
                  body="A free evening is a terrible thing to waste."
                  actionLabel="Propose something"
                  onAction={() => openNewEvent(selectedDate)}
                />
              ) : (
                <Text style={styles.quiet}>Nothing else on the books.</Text>
              )}
            </View>
          ) : (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.row}
            >
              {later.map((event) => (
                <PlanCard
                  key={event.id}
                  title={event.title}
                  date={event.date}
                  line={planLine(event)}
                  groupName={groupId === null ? event.groupName : undefined}
                  onPress={() => setOpenEvent(event)}
                />
              ))}
            </ScrollView>
          )}
        </View>

        {waiting.length > 0 ? (
          <View>
            <SectionHead title="Waiting on you" count={waiting.length} />
            <View style={styles.body}>
            {waiting.map((event) => (
              <EventCard
                key={event.id}
                event={toCardData(event)}
                action="rsvp"
                onPress={() => setOpenEvent(event)}
                onRsvp={(status) => handleRsvp(event.id, status)}
              />
            ))}
            </View>
          </View>
        ) : null}

      </>
    );
  }

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <HomeHeader
          displayName={displayName}
          avatarUrl={avatarUrl}
          groups={groups}
          groupId={groupId}
          onGroupSelect={setGroupId}
        />
        {renderBody()}
      </ScrollView>

      <PhotoSourceSheet
        visible={addingPhoto !== null}
        onClose={() => {
          if (!photoBusy) setAddingPhoto(null);
        }}
        onPick={pickPhoto}
      />

      <EventFormSheet
        visible={showCreate}
        groups={groups}
        defaultGroupId={null}
        defaultDate={formDate ?? today}
        event={editEvent}
        onClose={() => {
          setShowCreate(false);
          setEditEvent(null);
        }}
        onSaved={async () => setEvents(await getMyEvents(user.id))}
      />

      <GroupFormSheet
        visible={showGroupForm}
        onClose={() => setShowGroupForm(false)}
        onDone={async () => {
          setGroups(await getGroupsForUser(user.id));
        }}
      />

      <EventSheet
        event={openEvent}
        livePeople={openEvent !== null && openEvent.id === sharingEvent?.id ? livePeople : undefined}
        currentUserId={user.id}
        onClose={() => setOpenEvent(null)}
        onChanged={async () => setEvents(await getMyEvents(user.id))}
        onEdit={(e) => {
          const mine = events.find((one) => one.id === e.id);
          if (!mine) return;

          setOpenEvent(null);
          setEditEvent(mine);
          setFormDate(mine.date);
          setShowCreate(true);
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  row: { gap: space.sm, paddingHorizontal: space.lg },
  content: {
    width: '100%',
    maxWidth: layout.column,
    alignSelf: 'center',
    paddingVertical: space.md,
    paddingBottom: 130,
    gap: space.md,
  },
  body: { paddingHorizontal: space.lg, gap: space.sm },
  error: { color: colors.danger, ...typo.medium, fontSize: 13 },
  quiet: { color: colors.textFaint, ...typo.medium, fontSize: 13 },
  state: { alignItems: 'center', paddingHorizontal: space.lg, paddingVertical: space.xl, gap: space.xs },
  stateTitle: {
    color: colors.text,
    ...typo.display,
    fontSize: 21,
    letterSpacing: -0.3,
    textAlign: 'center',
  },
  stateBody: {
    color: colors.textSoft,
    ...typo.medium,
    fontSize: 14.5,
    lineHeight: 21,
    textAlign: 'center',
  },
  stateButton: { alignSelf: 'stretch', marginTop: space.sm },
});
