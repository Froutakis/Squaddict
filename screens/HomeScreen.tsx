import { useCallback, useEffect, useState } from 'react';
import type { User as AuthUser } from '@supabase/supabase-js';
import { ActivityIndicator, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { Group } from '../services/serviceGroup';
import type { MyEvent, RsvpStatus } from '../services/serviceEvents';
import { getUserById } from '../services/serviceUser';
import { getGroupsForUser } from '../services/serviceGroup';
import { clearRsvp, getEventCovers, getMyEvents, setRsvp } from '../services/serviceEvents';
import { signImages } from '../services/serviceMedia';
import { colors, font, layout, space } from '../theme';
import { dayFilterLabel, inPhotoWindow, keyOf } from '../lib/datetime';
import HomeHeader from '../components/home/HomeHeader';
import DayFilterRow from '../components/home/DayFilterRow';
import ListEmpty from '../components/home/ListEmpty';
import SectionLabel from '../components/general/SectionLabel';
import Button from '../components/general/Button';
import CalendarCard from '../components/events/CalendarCard';
import EventCard, { type EventCardData } from '../components/events/EventCard';
import UpNext from '../components/events/UpNext';
import EventOfTheWeek, { bestOfWeek } from '../components/events/EventOfTheWeek';
import { PhotoPrompt } from '../components/events/EventPhotos';
import EventSheet from '../components/events/EventSheet';
import EventFormSheet from '../components/events/EventFormSheet';
import GroupFormSheet from '../components/group/GroupFormSheet';

type HomeScreenProps = {
  user: AuthUser;
  createNonce?: number;
};

function toCardData(event: MyEvent): EventCardData {
  return {
    id: event.id,
    title: event.title,
    date: event.date,
    startTime: event.startTime,
    location: event.location,
    placeLabel: event.placeLabel,
    squadName: event.groupName,
    myStatus: event.myStatus,
    going: event.going,
    goingCount: event.going.length,
  };
}

export default function HomeScreen({ user, createNonce = 0 }: HomeScreenProps) {
  const [displayName, setDisplayName] = useState('');
  const [groups, setGroups] = useState<Group[]>([]);
  const [events, setEvents] = useState<MyEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [squadId, setSquadId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [showSquadForm, setShowSquadForm] = useState(false);
  const [formDate, setFormDate] = useState<string | null>(null);
  const [openEvent, setOpenEvent] = useState<MyEvent | null>(null);
  const [editEvent, setEditEvent] = useState<MyEvent | null>(null);
  const [rsvpError, setRsvpError] = useState<string | null>(null);
  const [covers, setCovers] = useState<Record<string, string>>({});
  const [photoNonce, setPhotoNonce] = useState(0);

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

  const today = keyOf(new Date());
  const dayMode = selectedDate !== null;
  const visible = squadId ? events.filter((e) => e.groupId === squadId) : events;
  const upcoming = visible.filter((e) => e.date >= today);
  const upNextEvent = dayMode ? undefined : upcoming[0];
  const pool = dayMode ? visible.filter((e) => e.date === selectedDate) : upcoming.slice(1);
  const waiting = pool.filter((e) => e.myStatus === undefined);
  const later = pool.filter((e) => e.myStatus !== undefined);
  const weekBest = dayMode ? null : bestOfWeek(visible, new Date());
  const wantsPhoto = visible.find(
    (e) => e.myStatus === 'in' && inPhotoWindow(e.date, e.startTime, e.endTime),
  );

  const pastIds = events
    .filter((e) => e.date < today)
    .map((e) => e.id)
    .sort()
    .join(',');

  useEffect(() => {
    if (pastIds === '') {
      setCovers({});
      return;
    }

    let cancelled = false;

    async function loadCovers() {
      try {
        const byEvent = await getEventCovers(pastIds.split(','));
        const paths = Object.values(byEvent).map((photo) => photo.path);
        if (paths.length === 0) {
          if (!cancelled) setCovers({});
          return;
        }

        const signed = await signImages(paths);
        if (cancelled) return;

        const byDate: Record<string, string> = {};
        for (const event of events) {
          const photo = byEvent[event.id];
          const url = photo ? signed[photo.path]?.url : undefined;
          if (url && !byDate[event.date]) byDate[event.date] = url;
        }
        setCovers(byDate);
      } catch {
        if (!cancelled) setCovers({});
      }
    }

    loadCovers();
    return () => {
      cancelled = true;
    };
  }, [pastIds, photoNonce]);

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
            <Button title="Start a squad" onPress={() => setShowSquadForm(true)} />
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

        {upNextEvent ? (
          <View style={styles.body}>
            <SectionLabel>Up next</SectionLabel>
            <UpNext
              event={upNextEvent}
              onPress={() => setOpenEvent(upNextEvent)}
              onRsvp={(status) => handleRsvp(upNextEvent.id, status)}
            />
          </View>
        ) : null}

        {wantsPhoto ? (
          <View style={styles.body}>
            <PhotoPrompt
              event={wantsPhoto}
              onChanged={() => setPhotoNonce((n) => n + 1)}
            />
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

        {waiting.length > 0 ? (
          <View style={styles.body}>
            <SectionLabel count={waiting.length}>Waiting on you</SectionLabel>
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
        ) : null}

        <View style={styles.body}>
          <SectionLabel>{dayMode ? 'On this day' : 'Later'}</SectionLabel>

          {later.length === 0 ? (
            waiting.length === 0 ? (
              <ListEmpty
                title={dayMode ? `Nothing on ${dayFilterLabel(selectedDate)}` : 'Nothing else planned'}
                body="A free evening is a terrible thing to waste."
                actionLabel="Propose something"
                onAction={() => openNewEvent(selectedDate)}
              />
            ) : (
              <Text style={styles.quiet}>Nothing else on the books.</Text>
            )
          ) : (
            later.map((event) => (
              <EventCard
                key={event.id}
                event={toCardData(event)}
                onPress={() => setOpenEvent(event)}
              />
            ))
          )}
        </View>

        {weekBest ? (
          <View style={styles.body}>
            <EventOfTheWeek
              event={toCardData(weekBest)}
              onPress={() => setOpenEvent(weekBest)}
            />
          </View>
        ) : null}
      </>
    );
  }

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <HomeHeader displayName={displayName} />
        {renderBody()}
      </ScrollView>

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
        visible={showSquadForm}
        onClose={() => setShowSquadForm(false)}
        onDone={async () => {
          setGroups(await getGroupsForUser(user.id));
        }}
      />

      <EventSheet
        event={openEvent}
        currentUserId={user.id}
        onClose={() => setOpenEvent(null)}
        onChanged={async () => setEvents(await getMyEvents(user.id))}
        onPhotosChanged={() => setPhotoNonce((n) => n + 1)}
        onEdit={(e) => {
          setOpenEvent(null);
          setEditEvent(e);
          setFormDate(e.date);
          setShowCreate(true);
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: {
    width: '100%',
    maxWidth: layout.column,
    alignSelf: 'center',
    paddingVertical: space.md,
    paddingBottom: 110,
    gap: space.md,
  },
  body: { paddingHorizontal: space.lg, gap: space.sm },
  error: { color: colors.danger, fontFamily: font.medium, fontSize: 13 },
  quiet: { color: colors.textFaint, fontFamily: font.medium, fontSize: 13 },
  state: { alignItems: 'center', paddingHorizontal: space.lg, paddingVertical: space.xl, gap: space.xs },
  stateTitle: {
    color: colors.text,
    fontFamily: font.display,
    fontSize: 21,
    letterSpacing: -0.3,
    textAlign: 'center',
  },
  stateBody: {
    color: colors.textSoft,
    fontFamily: font.medium,
    fontSize: 14.5,
    lineHeight: 21,
    textAlign: 'center',
  },
  stateButton: { alignSelf: 'stretch', marginTop: space.sm },
});
