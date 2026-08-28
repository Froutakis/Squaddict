import { useCallback, useEffect, useState } from 'react';
import type { User as AuthUser } from '@supabase/supabase-js';
import { ActivityIndicator, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { Group } from '../services/serviceGroup';
import type { MyEvent, RsvpStatus } from '../services/serviceEvents';
import { getUserById } from '../services/serviceUser';
import { getGroupsForUser } from '../services/serviceGroup';
import { clearRsvp, getMyEvents, setRsvp } from '../services/serviceEvents';
import { colors, font, layout, space } from '../theme';
import { dayFilterLabel, keyOf } from '../lib/datetime';
import HomeHeader from '../components/home/HomeHeader';
import DayFilterRow from '../components/home/DayFilterRow';
import ListEmpty from '../components/home/ListEmpty';
import SectionLabel from '../components/general/SectionLabel';
import Button from '../components/general/Button';
import CalendarCard from '../components/events/CalendarCard';
import EventCard from '../components/events/EventCard';
import UpNext from '../components/events/UpNext';
import EventSheet from '../components/events/EventSheet';
import EventFormSheet from '../components/events/EventFormSheet';
import GroupFormSheet from '../components/group/GroupFormSheet';

type HomeScreenProps = {
  user: AuthUser;
};

function unansweredFirst(list: MyEvent[]): MyEvent[] {
  return [...list].sort(
    (a, b) => Number(a.myStatus !== undefined) - Number(b.myStatus !== undefined),
  );
}

export default function HomeScreen({ user }: HomeScreenProps) {
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
  const listEvents = unansweredFirst(
    dayMode ? visible.filter((e) => e.date === selectedDate) : upcoming.slice(1),
  );

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

        <View style={styles.body}>
          <CalendarCard
            events={visible}
            daysShown={7}
            selectedDate={selectedDate}
            onSelectDate={(d) => setSelectedDate(d === selectedDate ? null : d)}
            onAddEvent={() => openNewEvent(selectedDate)}
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

        <View style={styles.body}>
          <SectionLabel>{dayMode ? 'On this day' : 'Later'}</SectionLabel>

          {listEvents.length === 0 ? (
            <ListEmpty
              title={dayMode ? `Nothing on ${dayFilterLabel(selectedDate)}` : 'Nothing else planned'}
              body="A free evening is a terrible thing to waste."
              actionLabel="Propose something"
              onAction={() => openNewEvent(selectedDate)}
            />
          ) : (
            listEvents.map((event) => (
              <EventCard key={event.id} event={event} onPress={() => setOpenEvent(event)} />
            ))
          )}
        </View>
      </>
    );
  }

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <HomeHeader displayName={displayName} onCreate={() => openNewEvent(selectedDate)} />
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
    gap: space.md,
  },
  body: { paddingHorizontal: space.lg, gap: space.sm },
  error: { color: colors.danger, fontFamily: font.medium, fontSize: 13 },
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
