import { useState, useEffect } from 'react';
import type { User as AuthUser } from '@supabase/supabase-js';
import { Group } from '../models/main';
import type { MyEvent } from '../services/serviceEvents';
import { getUserById } from '../services/serviceUser';
import { getGroupsForUser } from '../services/serviceGroup';
import { getMyEvents } from '../services/serviceEvents'
import { logout } from '../services/serviceAuth';
import { ActivityIndicator, Pressable, SafeAreaView, ScrollView, StyleSheet, Text } from 'react-native';
import { colors, font, radius, space } from '../theme';


type HomeScreenProps = {
    user: AuthUser;
};

export default function HomeScreen({ user }: HomeScreenProps){

    const [displayName , setDisplayName] = useState('');
    const [groups , setGroups] = useState<Group[]>([]);
    const [events, setEvents] = useState<MyEvent[]> ([]);
    const [loading, setLoading] = useState(true);
    
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

            
        </SafeAreaView>
        );
        

}

const styles = StyleSheet.create({
  center: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: space.lg, gap: space.sm },
  greeting: { color: colors.text, fontFamily: font.display, fontSize: 24 },
  subtitle: { color: colors.textSoft, fontFamily: font.medium, fontSize: 14 },
  logoutText: { color: colors.primary, fontFamily: font.semi, fontSize: 14, marginBottom: space.md },
  sectionTitle: { color: colors.textStrong, fontFamily: font.semi, fontSize: 17, marginTop: space.md },
  emptyText: { color: colors.textFaint, fontFamily: font.medium, fontSize: 14 },
  itemText: { color: colors.text, fontFamily: font.medium, fontSize: 15 },
});


