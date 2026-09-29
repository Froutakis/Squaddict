import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { Group } from '../services/serviceGroup';
import { getFollowerIds, getFollowing } from '../services/serviceFollow';
import { countMutual, filterSquads, markMutual } from '../lib/follows';
import FollowRow from '../components/you/FollowRow';
import GroupScreen from './GroupScreen';
import { colors, layout, paper, radius, shadow, space, textSize, typo } from '../theme';

type FollowsScreenProps = {
  acting: Group;
  userId: string;
  onBack: () => void;
};

export default function FollowsScreen({ acting, userId, onBack }: FollowsScreenProps) {
  const [list, setList] = useState<Group[]>([]);
  const [followerIds, setFollowerIds] = useState<string[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [profileGroup, setProfileGroup] = useState<Group | null>(null);
  const [reloads, setReloads] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    Promise.all([getFollowing(acting.id), getFollowerIds(acting.id).catch(() => null)])
      .then(function ([following, back]) {
        if (cancelled) return;
        setList(following);
        setFollowerIds(back);
      })
      .catch(function () {
        if (!cancelled) setError('Could not load who you follow.');
      })
      .finally(function () {
        if (!cancelled) setLoading(false);
      });

    return function cleanup() {
      cancelled = true;
    };
  }, [acting.id, reloads]);

  if (profileGroup) {
    const close = () => {
      setProfileGroup(null);
      setReloads((n) => n + 1);
    };
    return <GroupScreen group={profileGroup} userId={userId} onBack={close} onLeave={close} />;
  }

  const rows = markMutual(filterSquads(list, query), followerIds ?? []);
  const summary =
    `${acting.name.toUpperCase()} FOLLOWS ${list.length}` +
    (followerIds ? ` · ${countMutual(list, followerIds)} FOLLOW BACK` : '');

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Pressable
          onPress={onBack}
          accessibilityRole="button"
          accessibilityLabel="Back"
          style={({ pressed }) => [styles.head, pressed && styles.pressed]}
        >
          <Ionicons name="chevron-back" size={26} color={colors.text} />
          <View style={styles.headText}>
            <Text style={styles.title}>Your fellow squads</Text>
            <Text style={styles.summary} numberOfLines={1}>
              {summary}
            </Text>
          </View>
        </Pressable>

        <View style={styles.search}>
          <Ionicons name="search" size={16} color={colors.textFaint} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search your fellow squads"
            placeholderTextColor={colors.textFaint}
            autoCapitalize="none"
            autoCorrect={false}
            style={styles.input}
            accessibilityLabel="Search your fellow squads"
          />
        </View>

        {loading ? (
          <ActivityIndicator color={colors.primary} style={styles.spinner} />
        ) : error ? (
          <Text style={styles.error}>{error}</Text>
        ) : list.length === 0 ? (
          <Text style={styles.quiet}>Nobody yet. Follows belong to the squad, not to you.</Text>
        ) : rows.length === 0 ? (
          <Text style={styles.quiet}>No squad matches.</Text>
        ) : (
          <View style={styles.list}>
            {rows.map((row, index) => (
              <FollowRow
                key={row.group.id}
                group={row.group}
                mutual={row.mutual}
                first={index === 0}
                onPress={() => setProfileGroup(row.group)}
              />
            ))}
          </View>
        )}

        <View style={styles.hint}>
          <Ionicons name="compass-outline" size={18} color={colors.primary} />
          <Text style={styles.hintText}>
            Follow a parea from its profile. This list only holds the ones {acting.name} already decided to
            follow.
          </Text>
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
    paddingHorizontal: space.md,
    paddingVertical: space.lg,
    paddingBottom: 110,
    gap: space.md,
  },
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: space.xs },
  headText: { flex: 1 },
  title: { color: colors.text, ...typo.display, fontSize: textSize.hero, letterSpacing: -0.5 },
  summary: { color: colors.textFaint, ...typo.mono, fontSize: textSize.caption, letterSpacing: 1 },
  pressed: { opacity: 0.6 },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingHorizontal: space.md,
    height: 48,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  input: { flex: 1, color: colors.text, ...typo.medium, fontSize: textSize.base },
  list: { backgroundColor: colors.surface, borderRadius: radius.lg, overflow: 'hidden', ...shadow.card },
  spinner: { alignSelf: 'flex-start', marginVertical: space.sm },
  error: { color: colors.danger, ...typo.medium, fontSize: 13 },
  quiet: { color: colors.textFaint, ...typo.medium, fontSize: 13 },
  hint: {
    flexDirection: 'row',
    gap: space.sm,
    padding: space.md,
    borderRadius: radius.md,
    backgroundColor: paper.accentSoft,
  },
  hintText: { flex: 1, color: colors.textSoft, ...typo.medium, fontSize: textSize.body, lineHeight: 19 },
});
