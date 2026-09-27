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
import { Ionicons } from '@expo/vector-icons';
import { logout } from '../services/serviceAuth';
import { getActingGroupId, getUserById, setActingGroup } from '../services/serviceUser';
import { getGroupsForUser, getNightsKept, type Group } from '../services/serviceGroup';
import { getUnreadCounts } from '../services/serviceChat';
import { pickActing, splitVisible, switchList } from '../lib/acting';
import Monogram from '../components/general/Monogram';
import ActingCard from '../components/you/ActingCard';
import SwitchRow from '../components/you/SwitchRow';
import GroupScreen from './GroupScreen';
import GroupFormSheet from '../components/group/GroupFormSheet';
import { colors, layout, paper, radius, shadow, space, textSize, typo } from '../theme';

type YouScreenProps = {
  user: AuthUser;
};

export default function YouScreen({ user }: YouScreenProps) {
  const [displayName, setDisplayName] = useState('');
  const [groups, setGroups] = useState<Group[]>([]);
  const [actingId, setActingId] = useState<string | null>(null);
  const [unread, setUnread] = useState<Record<string, number>>({});
  const [nights, setNights] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [switchError, setSwitchError] = useState<string | null>(null);
  const [switching, setSwitching] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [profileGroup, setProfileGroup] = useState<Group | null>(null);
  const [groupForm, setGroupForm] = useState<'create' | 'join' | null>(null);

  const load = useCallback(
    async function load() {
      getUnreadCounts()
        .then(setUnread)
        .catch(function () {
          setUnread({});
        });

      try {
        const [profile, myGroups, stored] = await Promise.all([
          getUserById(user.id),
          getGroupsForUser(user.id),
          getActingGroupId(user.id),
        ]);

        setDisplayName(profile?.name ?? '');
        setGroups(myGroups);
        setActingId(stored);
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

  const acting = pickActing(groups, actingId);
  const others = switchList(groups, acting);
  const { shown, more } = expanded ? { shown: others, more: 0 } : splitVisible(others);

  useEffect(() => {
    if (!acting) return;

    let cancelled = false;
    setNights(0);
    getNightsKept(acting.id)
      .then(function (count) {
        if (!cancelled) setNights(count);
      })
      .catch(function () {});

    return function cleanup() {
      cancelled = true;
    };
  }, [acting?.id]);

  async function switchTo(group: Group) {
    if (switching) return;

    const previous = actingId;
    setActingId(group.id);
    setSwitchError(null);
    setSwitching(true);

    try {
      await setActingGroup(user.id, group.id);
    } catch {
      setActingId(previous);
      setSwitchError('Could not switch. Try again.');
      load();
    } finally {
      setSwitching(false);
    }
  }

  if (profileGroup) {
    return (
      <GroupScreen
        group={profileGroup}
        userId={user.id}
        onBack={() => {
          setProfileGroup(null);
          load();
        }}
        onLeave={() => {
          setProfileGroup(null);
          load();
        }}
      />
    );
  }

  const squadsLine = groups.length === 1 ? 'in 1 parea' : `in ${groups.length} pareas`;

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <View style={styles.headerText}>
            <Text style={styles.title}>Your Squad</Text>
            <Text style={styles.subtitle} numberOfLines={1}>
              {displayName ? `${displayName} · ${squadsLine}` : squadsLine}
            </Text>
          </View>
          <Monogram name={displayName || '?'} size={40} color={colors.primary} />
        </View>

        {loading ? (
          <ActivityIndicator color={colors.primary} style={styles.spinner} />
        ) : error ? (
          <Text style={styles.error}>{error}</Text>
        ) : !acting ? (
          <Text style={styles.quiet}>You are not in a parea yet.</Text>
        ) : (
          <>
            <View style={styles.labels}>
              <Text style={styles.label}>ACTING AS</Text>
              <Text style={styles.label}>THE PUNCHED ONE</Text>
            </View>

            <ActingCard group={acting} nights={nights} onOpenProfile={() => setProfileGroup(acting)} />

            <View style={styles.info}>
              <Ionicons name="ticket-outline" size={16} color={colors.primary} />
              <Text style={styles.infoText}>
                Explore, Parea and the shelf on Home speak as{' '}
                <Text style={styles.infoStrong}>{acting.name}</Text>. Punch another one below to switch.
              </Text>
            </View>

            {others.length > 0 ? (
              <>
                <View style={styles.labels}>
                  <Text style={styles.label}>SWITCH TO</Text>
                  {more > 0 ? (
                    <Pressable
                      onPress={() => setExpanded(true)}
                      hitSlop={8}
                      accessibilityRole="button"
                      accessibilityLabel={`Show ${more} more squads`}
                    >
                      <Text style={styles.label}>{more} MORE</Text>
                    </Pressable>
                  ) : null}
                </View>

                <View style={styles.list}>
                  {shown.map((group, index) => (
                    <SwitchRow
                      key={group.id}
                      group={group}
                      unread={unread[group.id] ?? 0}
                      first={index === 0}
                      disabled={switching}
                      onPress={() => switchTo(group)}
                    />
                  ))}
                </View>

                {switchError ? <Text style={styles.error}>{switchError}</Text> : null}
              </>
            ) : null}
          </>
        )}

        <View style={styles.startRow}>
          <Pressable
            onPress={() => setGroupForm('create')}
            accessibilityRole="button"
            accessibilityLabel="Make a squad"
            style={({ pressed }) => [styles.start, pressed && styles.pressed]}
          >
            <Ionicons name="add" size={18} color={colors.text} />
            <Text style={styles.startText}>Make a squad</Text>
          </Pressable>
          <Pressable
            onPress={() => setGroupForm('join')}
            accessibilityRole="button"
            accessibilityLabel="Enter a code"
            style={({ pressed }) => [styles.start, pressed && styles.pressed]}
          >
            <Ionicons name="ticket-outline" size={18} color={colors.text} />
            <Text style={styles.startText}>Enter a code</Text>
          </Pressable>
        </View>

        <Pressable
          onPress={() => logout().catch(() => {})}
          accessibilityRole="button"
          accessibilityLabel="Sign out"
          style={({ pressed }) => [styles.signOut, pressed && styles.pressed]}
        >
          <Text style={styles.signOutText}>Sign out</Text>
        </Pressable>
      </ScrollView>

      <GroupFormSheet
        visible={groupForm !== null}
        initialMode={groupForm ?? 'create'}
        onClose={() => setGroupForm(null)}
        onDone={() => {
          setGroupForm(null);
          load();
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
    paddingHorizontal: space.md,
    paddingVertical: space.lg,
    paddingBottom: 110,
    gap: space.md,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  headerText: { flex: 1 },
  title: { color: colors.text, ...typo.display, fontSize: textSize.hero, letterSpacing: -0.5 },
  subtitle: { color: colors.textFaint, ...typo.medium, fontSize: textSize.small },
  labels: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  label: { color: colors.textFaint, ...typo.mono, fontSize: textSize.caption, letterSpacing: 1.2 },
  info: {
    flexDirection: 'row',
    gap: space.sm,
    padding: space.md,
    borderRadius: radius.md,
    backgroundColor: paper.accentSoft,
  },
  infoText: { flex: 1, color: colors.text, ...typo.medium, fontSize: textSize.body, lineHeight: 19 },
  infoStrong: { color: colors.primary, ...typo.bold },
  list: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    overflow: 'hidden',
    ...shadow.card,
  },
  startRow: { flexDirection: 'row', gap: space.sm },
  start: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.xs,
    paddingVertical: 14,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  startText: { color: colors.text, ...typo.semi, fontSize: textSize.base },
  spinner: { alignSelf: 'flex-start', marginVertical: space.sm },
  error: { color: colors.danger, ...typo.medium, fontSize: 13 },
  quiet: { color: colors.textFaint, ...typo.medium, fontSize: 13 },
  signOut: { alignSelf: 'flex-start', paddingVertical: space.xs },
  signOutText: { color: colors.danger, ...typo.semi, fontSize: textSize.base },
  pressed: { opacity: 0.6 },
});
