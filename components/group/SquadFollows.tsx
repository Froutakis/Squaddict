import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { Group } from '../../services/serviceGroup';
import { getFollowerIds, getFollowing } from '../../services/serviceFollow';
import { countMutual, filterSquads, markMutual } from '../../lib/follows';
import FollowRow from '../you/FollowRow';
import { colors, radius, shadow, space, textSize, typo } from '../../theme';

// Search shows up once the list is long enough to need it.
const SEARCH_FROM = 6;

type SquadFollowsProps = {
  group: Group;
  // Bump to reload, e.g. after coming back from a profile that was unfollowed.
  reloadKey: number;
  onOpen: (group: Group) => void;
};

// The pareas this squad follows, with the ones that follow back marked Mutual.
export default function SquadFollows({ group, reloadKey, onOpen }: SquadFollowsProps) {
  const [list, setList] = useState<Group[]>([]);
  const [followerIds, setFollowerIds] = useState<string[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    Promise.all([getFollowing(group.id), getFollowerIds(group.id).catch(() => null)])
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
  }, [group.id, reloadKey]);

  if (loading) return <ActivityIndicator color={colors.primary} style={styles.spinner} />;
  if (error) return <Text style={styles.error}>{error}</Text>;

  if (list.length === 0) {
    return (
      <View style={styles.empty}>
        <Ionicons name="compass-outline" size={24} color={colors.textSoft} />
        <Text style={styles.emptyTitle}>{group.name} follows nobody yet</Text>
        <Text style={styles.emptyBody}>
          Act as this parea, then follow a parea from its profile or from Explore.
        </Text>
      </View>
    );
  }

  const rows = markMutual(filterSquads(list, query), followerIds ?? []);
  const summary =
    `FOLLOWS ${list.length}` + (followerIds ? ` · ${countMutual(list, followerIds)} FOLLOW BACK` : '');

  return (
    <View style={styles.wrap}>
      <Text style={styles.summary}>{summary}</Text>

      {list.length >= SEARCH_FROM ? (
        <View style={styles.search}>
          <Ionicons name="search" size={16} color={colors.textFaint} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search who you follow"
            placeholderTextColor={colors.textFaint}
            autoCapitalize="none"
            autoCorrect={false}
            style={styles.input}
            accessibilityLabel="Search who you follow"
          />
        </View>
      ) : null}

      {rows.length === 0 ? (
        <Text style={styles.quiet}>No parea matches.</Text>
      ) : (
        <View style={styles.list}>
          {rows.map((row, index) => (
            <FollowRow
              key={row.group.id}
              group={row.group}
              mutual={row.mutual}
              first={index === 0}
              onPress={() => onOpen(row.group)}
            />
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.sm },
  summary: { color: colors.textFaint, ...typo.mono, fontSize: textSize.caption, letterSpacing: 1.2 },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingHorizontal: space.md,
    height: 44,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  input: { flex: 1, color: colors.text, ...typo.medium, fontSize: textSize.base },
  list: { backgroundColor: colors.surface, borderRadius: radius.lg, overflow: 'hidden', ...shadow.card },
  spinner: { alignSelf: 'center', marginVertical: space.lg },
  error: { color: colors.danger, ...typo.medium, fontSize: textSize.body },
  quiet: { color: colors.textFaint, ...typo.medium, fontSize: textSize.body },
  empty: {
    alignItems: 'center',
    gap: space.xs,
    padding: space.lg,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.border,
  },
  emptyTitle: { color: colors.text, ...typo.semi, fontSize: textSize.base, textAlign: 'center' },
  emptyBody: { color: colors.textSoft, ...typo.medium, fontSize: textSize.body, lineHeight: 19, textAlign: 'center' },
});
