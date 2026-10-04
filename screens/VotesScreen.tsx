import { useCallback, useEffect, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, Pressable, RefreshControl, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { Group } from '../services/serviceGroup';
import {
  cancelVote,
  castOption,
  castVote,
  getVotes,
  type SquadVote,
  type VoteEvent,
  type VoteKind,
  type VoteStatus,
} from '../services/serviceVotes';
import VoteCard from '../components/votes/VoteCard';
import NewVoteSheet from '../components/votes/NewVoteSheet';
import { errorText } from '../lib/postgres';
import { FAB_CENTER_Y, FAB_INSET } from '../components/general/MenuFab';
import { colors, layout, radius, space, textSize, typo } from '../theme';

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

// What the page says right after a vote went in.
function startedNotice(kind: VoteKind, status: VoteStatus): string {
  if (status === 'passed') {
    return kind === 'invite' ? 'Passed on the spot. Share the invite below.' : 'Passed on the spot.';
  }
  if (status === 'rejected') return 'That vote was decided already.';
  return kind === 'poll'
    ? 'Question sent. Pick your answer too.'
    : 'Vote started. It passes with more than half of the parea.';
}

// The squad's votes as a page of their own, like the chat and the calendar:
// open ones to answer, invites waiting to be sent, then the last few that
// were decided. Every vote starts here, with New vote.
export default function VotesScreen({ group, userId, reloadKey = 0, onBack, onOpenSquad, onOpenEvent, onChanged }: VotesScreenProps) {
  const [open, setOpen] = useState<SquadVote[]>([]);
  const [invites, setInvites] = useState<SquadVote[]>([]);
  const [decided, setDecided] = useState<SquadVote[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [composing, setComposing] = useState(false);

  const load = useCallback(
    async function load() {
      setError(null);
      try {
        const votes = await getVotes(group.id, userId);
        setOpen(votes.open);
        setInvites(votes.invites);
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
    setNotice(null);
    try {
      await action();
      await load();
      onChanged();
    } catch (problem) {
      setError(errorText(problem, 'Could not save that. Try again.'));
    } finally {
      setBusy(null);
    }
  }

  function openTarget(vote: SquadVote) {
    if (vote.target.type === 'squad') onOpenSquad(vote.target.group);
    else if (vote.target.type === 'event') onOpenEvent(vote.target.event);
  }

  function card(vote: SquadVote, live: boolean) {
    return (
      <VoteCard
        key={vote.id}
        vote={vote}
        members={group.memberCount}
        userId={userId}
        busy={busy === vote.id}
        onYes={live ? () => run(vote.id, () => castVote(vote.id, true)) : undefined}
        onNo={live ? () => run(vote.id, () => castVote(vote.id, false)) : undefined}
        onPick={live ? (optionId) => run(vote.id, () => castOption(vote.id, optionId)) : undefined}
        onCancel={live ? () => run(vote.id, () => cancelVote(vote.id)) : undefined}
        onOpen={() => openTarget(vote)}
        onStale={load}
      />
    );
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
          <Pressable
            onPress={() => {
              setNotice(null);
              setComposing(true);
            }}
            accessibilityRole="button"
            accessibilityLabel="New vote"
            accessibilityHint={`Put something to the vote in ${group.name}`}
            style={({ pressed }) => [styles.newVote, pressed && styles.pressed]}
          >
            <Ionicons name="add" size={18} color={colors.onInk} />
            <Text style={styles.newVoteText}>New vote</Text>
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
          {notice ? (
            <Text style={styles.notice} accessibilityLiveRegion="polite">
              {notice}
            </Text>
          ) : null}

          {loading ? (
            <ActivityIndicator color={colors.primary} style={styles.spinner} />
          ) : (
            <>
              <Text style={styles.section}>OPEN {open.length}</Text>
              {open.length === 0 ? (
                <Text style={styles.empty}>
                  No open votes. Tap New vote to ask the parea something, invite a friend or pick a plan.
                </Text>
              ) : (
                open.map((vote) => card(vote, true))
              )}
            </>
          )}

          {error ? (
            <Text style={styles.error} accessibilityLiveRegion="polite">
              {error}
            </Text>
          ) : null}

          {!loading && invites.length > 0 ? (
            <>
              <Text style={[styles.section, styles.sectionGap]}>INVITES TO SEND {invites.length}</Text>
              {invites.map((vote) => card(vote, false))}
            </>
          ) : null}

          {!loading && decided.length > 0 ? (
            <>
              <Text style={[styles.section, styles.sectionGap]}>DECIDED</Text>
              {decided.map((vote) => card(vote, false))}
            </>
          ) : null}
        </ScrollView>
      </View>

      <NewVoteSheet
        visible={composing}
        group={group}
        userId={userId}
        onClose={() => setComposing(false)}
        onStarted={async (kind, status) => {
          setComposing(false);
          setNotice(startedNotice(kind, status));
          await load();
          onChanged();
        }}
      />
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

  // Starts right of the floating menu button, level with it.
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingLeft: FAB_INSET - space.xs,
    paddingRight: space.lg,
    height: 48,
    marginTop: FAB_CENTER_Y - 24,
  },
  back: { flexDirection: 'row', alignItems: 'center', gap: 2, paddingRight: space.sm, minHeight: 44 },
  backText: { color: colors.text, ...typo.semi, fontSize: textSize.lead },
  newVote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xxs,
    minHeight: 44,
    paddingHorizontal: space.md,
    borderRadius: radius.pill,
    backgroundColor: colors.ink,
  },
  newVoteText: { color: colors.onInk, ...typo.semi, fontSize: textSize.base },

  head: { paddingHorizontal: space.lg },
  title: { color: colors.text, ...typo.display, fontSize: textSize.hero, letterSpacing: -0.6 },
  squad: { color: colors.textSoft, ...typo.medium, fontSize: textSize.base },

  list: { gap: space.sm, paddingHorizontal: space.lg, paddingTop: space.md, paddingBottom: NAV_CLEARANCE + space.md },
  spinner: { marginVertical: space.xl },
  section: { color: colors.textFaint, ...typo.mono, fontSize: textSize.caption, letterSpacing: 1.2 },
  sectionGap: { marginTop: space.md },
  empty: { color: colors.textSoft, ...typo.medium, fontSize: textSize.base, textAlign: 'center', paddingVertical: space.xl },
  notice: { color: colors.success, ...typo.semi, fontSize: textSize.body },
  error: { color: colors.danger, ...typo.medium, fontSize: textSize.body },
});
