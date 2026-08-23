import { useState, useEffect } from 'react';
import type { User as AuthUser } from '@supabase/supabase-js';
import type { Group } from '../services/serviceGroup';
import type { MyEvent, RsvpStatus } from '../services/serviceEvents';
import { getUserById } from '../services/serviceUser';
import { getGroupsForUser } from '../services/serviceGroup';
import { getMyEvents } from '../services/serviceEvents'
import { logout } from '../services/serviceAuth';
import { ActivityIndicator, SafeAreaView, View, ScrollView, StyleSheet, Text } from 'react-native';
import { colors, font, layout, space } from '../theme';
import HomeHeader from '../components/home/HomeHeader';
import GroupBar from '../components/general/GroupBar';
import CalendarCard from '../components/events/CalendarCard';
import EventCard from '../components/events/EventCard';
import UpNext from '../components/events/UpNext';
import EventSheet from '../components/events/EventSheet';
import EventFormSheet from '../components/events/EventFormSheet';
import { keyOf } from '../lib/datetime';
import { clearRsvp, setRsvp } from '../services/serviceEvents';

type HomeScreenProps = {
    user: AuthUser;
};

export default function HomeScreen({ user }: HomeScreenProps){

    const [displayName , setDisplayName] = useState('');
    const [groups , setGroups] = useState<Group[]>([]);
    const [events, setEvents] = useState<MyEvent[]> ([]);
    const [loading, setLoading] = useState(true);
    const [activeGroup, setActiveGroup] = useState<string | null>(null);
    const [selectedDate, setSelectedDate] = useState<string | null>(null);
    const [error , setError] = useState<string | null>(null);
    const [showCreate, setShowCreate] = useState(false);
    const [rsvpSaving, setRsvpSaving] = useState(false);
    const [rsvpError, setRsvpError] = useState<string | null>(null);
    const [openEvent, setOpenEvent] = useState<MyEvent | null>(null);
    const [editEvent, setEditEvent] = useState<MyEvent | null>(null);

    useEffect(() => {
        async function load() {
            try {
                const profile = await getUserById(user.id);
                const myGroups = await getGroupsForUser(user.id);
                const myEvents = await getMyEvents(user.id);

                setDisplayName(profile?.name ?? '');
                setGroups(myGroups);
                setEvents(myEvents);
            }
            catch (e) {
                setError("Loading Error!");
            }
            finally {
                setLoading(false);
            }
        }

        load();
    },[user.id]);

    const date = keyOf(new Date());
    
    const squadEvents = activeGroup ? events.filter((e) => e.groupId === activeGroup) : events;
    const dayMode = !!selectedDate;
    const upcoming = squadEvents.filter((e) => e.date >= date);
    const upNextEvent = dayMode ? undefined : upcoming[0];
    const listEvents = dayMode ? squadEvents.filter((e) => e.date === selectedDate) : upcoming.slice(1);

    async function handleRsvp(eventId: string, status: RsvpStatus | null) {
        setRsvpSaving(true);
        setRsvpError(null);
        try {
            if (status) await setRsvp(eventId, status);
            else await clearRsvp(eventId);

            setEvents(await getMyEvents(user.id));
        }
        catch (e) {
            setRsvpError('Could not save your answer. Try again.');
        }
        finally {
            setRsvpSaving(false);
        }
    }

    if (loading){
        return (
        <SafeAreaView style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
        </SafeAreaView>
        )
    }

    if (error){
        return (
        <SafeAreaView style={styles.center}>
            <Text style={styles.emptyText}>{error}</Text>
        </SafeAreaView>
        )
    }

    return (
        <SafeAreaView style={styles.screen}> 
            <ScrollView contentContainerStyle={styles.content}>
                <HomeHeader displayName={displayName} onProfile={() => logout()} />
                <GroupBar groups={groups} activeId={activeGroup} onSelect={setActiveGroup} />
                {rsvpError ? (
                <View style={styles.body}>
                    <Text style={styles.formError}>{rsvpError}</Text>
                </View>
                ) : null }
                {upNextEvent ? (
                <View style={styles.body}>
                    <UpNext
                        event={upNextEvent}
                        onPress={() => setOpenEvent(upNextEvent)}
                        onRsvp={(status) => handleRsvp(upNextEvent.id, status)}
                        saving={rsvpSaving}
                    />
                </View>
                ) : null }
                <View style={styles.body}>
                    <CalendarCard
                        events={squadEvents}
                        daysShown={7}
                        selectedDate={selectedDate}
                        onSelectDate={(d) => setSelectedDate(d === selectedDate ? null : d)}
                        onAddEvent={() => setShowCreate(true)}
                    />
                </View>
                {!upNextEvent && listEvents.length == 0 ? ( 
                <View style={styles.body}>
                    <Text style={styles.emptyText}>
                        {dayMode ? 'Nothing Today..:(' : 'There are no Events'}
                    </Text>
                </View>
                ) : (
                listEvents.map((event) => (
                <View style={styles.body} key={event.id}>
                    <EventCard event={event} onPress={() => setOpenEvent(event)} />
                </View>
                ))
                )}
            </ScrollView>
            <EventFormSheet
                visible={showCreate}
                groups={groups}
                defaultGroupId={activeGroup}
                defaultDate={selectedDate ?? date}
                event={editEvent}
                onClose={() => { setShowCreate(false); setEditEvent(null); }}
                onSaved={async () => setEvents(await getMyEvents(user.id))}
            />

            <EventSheet
                event={openEvent}
                currentUserId={user.id}
                onClose={() => setOpenEvent(null)}
                onChanged={async () => setEvents(await getMyEvents(user.id))}
                onEdit={(e) => {
                    setOpenEvent(null);
                    setEditEvent(e);
                    setShowCreate(true);
                }}
            />
        </SafeAreaView>
        );
        

}

const styles = StyleSheet.create({
    center: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
    screen: { flex: 1, backgroundColor: colors.bg },
    content: { width: '100%', maxWidth: layout.column, alignSelf: 'center', paddingVertical: space.lg, gap: space.sm },
    body: { paddingHorizontal: space.lg, gap: space.sm },
    greeting: { color: colors.text, fontFamily: font.display, fontSize: 24 },
    subtitle: { color: colors.textSoft, fontFamily: font.medium, fontSize: 14 },
    logoutText: { color: colors.primary, fontFamily: font.semi, fontSize: 14, marginBottom: space.md },
    sectionTitle: { color: colors.textStrong, fontFamily: font.semi, fontSize: 17, marginTop: space.md },
    emptyText: { color: colors.textFaint, fontFamily: font.medium, fontSize: 14 },
    itemText: { color: colors.text, fontFamily: font.medium, fontSize: 15 },
    formError: { color: colors.danger, fontFamily: font.medium, fontSize: 13 },
});


