import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { User as AuthUser } from '@supabase/supabase-js';
import { logout } from '../services/serviceAuth';
import { getUserById } from '../services/serviceUser';
import { getGroupsForUser, type Group } from '../services/serviceGroup';
import GradientAvatar, { initialsFor } from '../components/general/GradientAvatar';
import SectionLabel from '../components/general/SectionLabel';
import GroupCard from '../components/group/GroupCard';
import GroupScreen from './GroupScreen';
import { colors, typo, layout, space, textSize } from '../theme';

type YouScreenProps = {
  user: AuthUser;
};

export default function YouScreen({ user }: YouScreenProps) {
  const [displayName, setDisplayName] = useState('');
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [profileGroup, setProfileGroup] = useState<Group | null>(null);

  const load = useCallback(
    async function load() {
      try {
        const [profile, myGroups] = await Promise.all([
          getUserById(user.id),
          getGroupsForUser(user.id),
        ]);

        setDisplayName(profile?.name ?? '');
        setGroups(myGroups);
        setError(null);
      } catch {
        setError('Could not load your pareas.');
      } finally {
        setLoading(false);
      }
    },
    [user.id],
  );

  useEffect(() => {
    load();
  }, [load]);

  if (profileGroup) {
    return (
      <GroupScreen
        group={profileGroup}
        userId={user.id}
        onBack={() => setProfileGroup(null)}
        onLeave={() => {
          setProfileGroup(null);
          load();
        }}
      />
    );
  }

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.crest}>
          <GradientAvatar label={displayName} initials={initialsFor(displayName)} size={72} />
          <Text style={styles.name} numberOfLines={1}>
            {displayName}
          </Text>
          <Text style={styles.since}>
            {groups.length === 1 ? 'In 1 parea' : `In ${groups.length} pareas`}
          </Text>
        </View>

        <View style={styles.body}>
          <SectionLabel>Your pareas</SectionLabel>

          {loading ? (
            <ActivityIndicator color={colors.primary} style={styles.spinner} />
          ) : error ? (
            <Text style={styles.error}>{error}</Text>
          ) : groups.length === 0 ? (
            <Text style={styles.quiet}>You are not in a parea yet.</Text>
          ) : (
            <View style={styles.list}>
              {groups.map((group) => (
                <GroupCard
                  key={group.id}
                  group={group}
                  style={styles.card}
                  onPress={() => setProfileGroup(group)}
                />
              ))}
            </View>
          )}
        </View>

        <View style={styles.body}>
          <Pressable
            onPress={() => logout().catch(() => {})}
            accessibilityRole="button"
            accessibilityLabel="Sign out"
            style={({ pressed }) => [styles.signOut, pressed && styles.pressed]}
          >
            <Text style={styles.signOutText}>Sign out</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: {
    width: '100%',
    maxWidth: layout.column,
    alignSelf: 'center',
    paddingVertical: space.lg,
    paddingBottom: 110,
    gap: space.lg,
  },
  body: { paddingHorizontal: space.lg, gap: space.sm },

  crest: { alignItems: 'center', gap: space.xs, paddingHorizontal: space.lg },
  name: {
    marginTop: space.xs,
    color: colors.text,
    ...typo.display,
    fontSize: textSize.hero,
    letterSpacing: -0.5,
  },
  since: { color: colors.textFaint, ...typo.mono, fontSize: textSize.small },

  list: { gap: space.sm },
  card: { width: '100%' },

  spinner: { alignSelf: 'flex-start', marginVertical: space.sm },
  error: { color: colors.danger, ...typo.medium, fontSize: 13 },
  quiet: { color: colors.textFaint, ...typo.medium, fontSize: 13 },

  signOut: { alignSelf: 'flex-start', paddingVertical: space.xs },
  signOutText: { color: colors.danger, ...typo.semi, fontSize: textSize.base },
  pressed: { opacity: 0.6 },
});
