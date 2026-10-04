import { useCallback, useEffect, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, Pressable, RefreshControl, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { Group } from '../services/serviceGroup';
import { cancelVote, castVote, getVotes, type SquadVote, type VoteEvent } from '../services/serviceVotes';
import VoteCard from '../components/votes/VoteCard';
import { colors, layout, space, textSize, typo } from '../theme';

type VotesScreenProps = {
  group: Group;
  userId: string;
  // Bumped from outside (a vote changed elsewhere): load again.
  reloadKey?: number;
  onBack: () => void;
  onOpenSquad: (group: Group) => void;
  onOpenEvent: (event: VoteEvent) => void;
  // A vote was cast, cancelled or decided: badges and plans may have moved.
  onChanged: () => void;
};

// Room for the tab bar that floats over the bottom of the page.
const NAV_CLEARANCE = 96;

// The squad's votes as a page of their own, like the chat and the calendar:
// open ones to answer, then the last few that were decided.
export default function VotesScreen({ group, userId, reloadKey = 0, onBack, onOpenSquad, onOpenEvent, onChanged }: VotesScreenProps) {
  const [open, setOpen] = useState<SquadVote[]>([]);
  const [decided, setDecided] = useState<SquadVote[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async function load() {
      setError(null);
      try {
        const votes = await getVotes(group.id, userId);
        setOpen(votes.open);
        setDecided(votes.decided);
      } catch {
        setError('Could not load the votes. Try again.');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [group.id, userId],
  );

  useEffect(() => {
    setLoading(true);
    load();
  }, [load, reloadKey]);

  async function run(voteId: string, action: () => Promise<unknown>) {
    if (busy) return;
    setBusy(voteId);
    setError(null);
    try {
      await action();
      await load();
      onChanged();
    } catch {
      setError('Could not save that. Try again.');
    } finally {
      setBusy(null);
    }
  }

  function openTarget(vote: SquadVote) {
    if (vote.target.type === 'squad') onOpenSquad(vote.target.group);
    else onOpenEvent(vote.target.event);
  }

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.column}>
        <View style={styles.topBar}>
          <Pressable
            onPress={onBack}
            accessibilityRole="button"
            accessibilityLabel="Back to Home"
            hitSlop={8}
            style={({ pressed }) => [styles.back, pressed && styles.pressed]}
          >
            <Ionicons name="chevron-back" size={24} color={colors.text} />
            <Text style={styles.backText}>Home</Text>
          </Pressable>
        </View>

        <View style={styles.head}>
          <Text style={styles.title}>Votes</Text>
          <Text style={styles.squad} numberOfLines={1}>
            {group.name}
          </Text>
        </View>

        <ScrollView
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                load();
              }}
              tintColor={colors.primary}
            />
          }
        >
          {loading ? (
            <ActivityIndicator color={colors.primary} style={styles.spinner} />
          ) : (
            <>
              <Text style={styles.section}>OPEN {open.length}</Text>
              {open.length === 0 ? (
                <Text style={styles.empty}>
                  No open votes. Follow a squad or pick a public plan in Explore to start one.
                </Text>
              ) : (
                open.map((vote) => (
                  <VoteCard
                    key={vote.id}
                    vote={vote}
                    members={group.memberCount}
                    userId={userId}
                    busy={busy === vote.id}
                    onYes={() => run(vote.id, () => castVote(vote.id, true))}
                    onNo={() => run(vote.id, () => castVote(vote.id, false))}
                    onCancel={() => run(vote.id, () => cancelVote(vote.id))}
                    onOpen={() => openTarget(vote)}
                  />
                ))
              )}
            </>
          )}

          {error ? (
            <Text style={styles.error} accessibilityLiveRegion="polite">
              {error}
            </Text>
          ) : null}

          {!loading && decided.length > 0 ? (
            <>
              <Text style={[styles.section, styles.sectionGap]}>DECIDED</Text>
              {decided.map((vote) => (
                <VoteCard
                  key={vote.id}
                  vote={vote}
                  members={group.memberCount}
                  userId={userId}
                  onOpen={() => openTarget(vote)}
                />
              ))}
            </>
          ) : null}
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: colors.bg },
  column: {
    flex: 1,
    width: '100%',
    maxWidth: layout.column,
    alignSelf: 'center',
  },
  pressed: { opacity: 0.6 },

  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space.xs,
    height: 48,
  },
  back: { flexDirection: 'row', alignItems: 'center', gap: 2, paddingRight: space.sm, minHeight: 44 },
  backText: { color: colors.text, ...typo.semi, fontSize: textSize.lead },

  head: { paddingHorizontal: space.lg },
  title: { color: colors.text, ...typo.display, fontSize: textSize.hero, letterSpacing: -0.6 },
  squad: { color: colors.textSoft, ...typo.medium, fontSize: textSize.base },

  list: { gap: space.sm, paddingHorizontal: space.lg, paddingTop: space.md, paddingBottom: NAV_CLEARANCE + space.md },
  spinner: { marginVertical: space.xl },
  section: { color: colors.textFaint, ...typo.mono, fontSize: textSize.caption, letterSpacing: 1.2 },
  sectionGap: { marginTop: space.md },
  empty: { color: colors.textSoft, ...typo.medium, fontSize: textSize.base, textAlign: 'center', paddingVertical: space.xl },
  error: { color: colors.danger, ...typo.medium, fontSize: textSize.body },
});
