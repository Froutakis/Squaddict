import { useState, useEffect } from 'react';
import type { User as AuthUser } from '@supabase/supabase-js';
import { ActivityIndicator, Pressable, SafeAreaView, ScrollView, StyleSheet, Text } from 'react-native';
import { Group } from '../models/main';
import { getUserById } from '../services/serviceUser';
import { getGroupsForUser } from '../services/serviceGroup';
import { getMyEvents, type MyEvent } from '../services/serviceEvents';
import { logout } from '../services/serviceAuth';
import { colors, font, layout, radius, space } from '../theme';

type HomeScreenProps = {
  user: AuthUser;
  /** null = άνοιξε το chat χωρίς προεπιλεγμένη παρέα (π.χ. όταν δεν έχεις καμία ακόμα). */
  onOpenChat: (groupId: string | null) => void;
};

export default function HomeScreen({ user, onOpenChat }: HomeScreenProps) {
  const [displayName, setDisplayName] = useState('');
  const [groups, setGroups] = useState<Group[]>([]);
  const [events, setEvents] = useState<MyEvent[]>([]);
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
  }, [user.id]);

  if (loading) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </SafeAreaView>
    );
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
          <Text style={styles.emptyText}>No squads yet.</Text>
        ) : (
          groups.map((group) => (
            <Pressable
              key={group.id}
              accessibilityRole="button"
              accessibilityLabel={`Open chat with ${group.name}`}
              onPress={() => onOpenChat(group.id)}
              style={({ pressed }) => [styles.groupRow, pressed && styles.groupRowPressed]}
            >
              <Text style={styles.itemText}>{group.name}</Text>
              <Text style={styles.groupRowAction}>Chat ›</Text>
            </Pressable>
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
  content: {
    width: '100%',
    maxWidth: layout.column,
    alignSelf: 'center',
    padding: space.lg,
    gap: space.sm,
  },
  greeting: { color: colors.text, fontFamily: font.display, fontSize: 24 },
  subtitle: { color: colors.textSoft, fontFamily: font.medium, fontSize: 14 },
  logoutText: { marginBottom: space.md, color: colors.primary, fontFamily: font.semi, fontSize: 14 },
  sectionTitle: { marginTop: space.md, color: colors.textStrong, fontFamily: font.semi, fontSize: 17 },
  emptyText: { color: colors.textFaint, fontFamily: font.medium, fontSize: 14 },
  itemText: { color: colors.text, fontFamily: font.medium, fontSize: 15 },
  groupRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
  },
  groupRowPressed: { opacity: 0.75 },
  groupRowAction: { color: colors.primary, fontFamily: font.semi, fontSize: 13 },
});
