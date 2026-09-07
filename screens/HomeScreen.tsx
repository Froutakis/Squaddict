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
            setLoading(false);
        }

        load();
    },[user.id]);
    if (loading){
        return (
        <SafeAreaView style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
        </SafeAreaView>   
        )
    }
    return (
        <SafeAreaView style={styles.screen}>
            <ScrollView contentContainerStyle={styles.content}>
            <Text style={styles.greeting}>Hi{displayName ? `, ${displayName}` : ''}</Text>
            <Text style={styles.subtitle}>{user.email}</Text>

            <Pressable accessibilityRole="button" onPress={() => logout()}>
              <Text style={styles.logoutText}>Sign out</Text>
            </Pressable>

            <Text style={styles.sectionTitle}>Your squads</Text>
            {groups.length === 0 ? (
                <Text style={styles.emptyText}>You haven't joined any squad yet.</Text>
            ) : (
                groups.map((group) => (
                <Text key={group.id} style={styles.itemText}>{group.name}</Text>
                ))
            )}

            <Text style={styles.sectionTitle}>Upcoming events</Text>
            {events.length === 0 ? (
                <Text style={styles.emptyText}>No upcoming events.</Text>
            ) : (
                events.map((event) => (
                <Text key={event.id} style={styles.itemText}>
                    {event.date} — {event.title} ({event.groupName})
                </Text>
                ))
            )}
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
  content: { padding: space.lg, gap: space.sm },
  greeting: { color: colors.text, fontFamily: font.display, fontSize: 24 },
  subtitle: { color: colors.textSoft, fontFamily: font.medium, fontSize: 14 },
  logoutText: { color: colors.primary, fontFamily: font.semi, fontSize: 14, marginBottom: space.md },
  sectionTitle: { color: colors.textStrong, fontFamily: font.semi, fontSize: 17, marginTop: space.md },
  emptyText: { color: colors.textFaint, fontFamily: font.medium, fontSize: 14 },
  itemText: { color: colors.text, fontFamily: font.medium, fontSize: 15 },
});
