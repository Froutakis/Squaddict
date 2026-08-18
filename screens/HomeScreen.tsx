import { useState, useEffect } from 'react';
import type { User as AuthUser } from '@supabase/supabase-js';
import { Group } from '../models/main';
import type { MyEvent } from '../services/serviceEvents';
import { getUserById } from '../services/serviceUser';
import { getGroupsForUser } from '../services/serviceGroup';
import { getMyEvents } from '../services/serviceEvents'
import { logout } from '../services/serviceAuth';
import { ActivityIndicator, Pressable, SafeAreaView, View, ScrollView, StyleSheet, Text } from 'react-native';
import { colors, font, layout, radius, space } from '../theme';
import HomeHeader from '../components/home/HomeHeader';
import GroupBar from '../components/general/GroupBar';
import CalendarCard from '../components/events/CalendarCard';
import EventCard from '../components/events/EventCard';
import UpNext from '../components/events/UpNext';
import { keyOf } from '../lib/eventFormat';

const dummyEvent: MyEvent = {
  id: 'dummy-1',
  groupId: 'g1',
  title: 'Sunset at Zefyros',
  date: '2026-08-19',
  startTime: '20:30',
  location: 'Zefyros Beach Bar',
  createdBy: 'u1',
  groupName: 'Paralia Crew',
};

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
    
    useEffect(() => {
        async function load() {
            const profile = await getUserById(user.id);
            const myGroups = await getGroupsForUser(user.id);
            const myEvents = await getMyEvents(user.id);

            setDisplayName(profile?.name ?? '');
            setGroups(myGroups);
            setEvents(myEvents);
            setLoading(false);
        }

        load();
    },[user.id]);

    const date = keyOf(new Date());
    const upNextEvent = events.find((e) => e.date >= date);
    const laterEvents = events.filter((e) => e.date >= date && e.id != upNextEvent?.id);



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
                <HomeHeader displayName={displayName} onProfile={() => logout()} />
                <GroupBar groups={groups} activeId={activeGroup} onSelect={setActiveGroup} />

                <View style={styles.body}>
                    <CalendarCard
                        events={events}
                        selectedDate={selectedDate}
                        onSelectDate={setSelectedDate}
                        onAddEvent={() => {}}
                    />
                </View>
                {laterEvents.length == 0 ? ( 
                <View style={styles.body}>
                    <Text> There are no events </Text> 
                </View>
                ) : (
                laterEvents.map((event) => (
                <View style={styles.body}>
                    <EventCard event={event} />
                </View>
                ))
                )}
                
                {upNextEvent ? (
                <View style={styles.body}>
                    <UpNext event={upNextEvent} /> 
                </View>
                ) : null }

            </ScrollView>

            
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
});


