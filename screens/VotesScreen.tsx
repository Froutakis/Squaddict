import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Ionicons } from '@expo/vector-icons';
import {
  ActivityIndicator,
  BackHandler,
  Pressable,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { getMemberProfiles, type Group } from '../services/serviceGroup';
import {
  cancelVote,
  castOption,
  castVote,
  countDecidedSince,
  getVotes,
  propose,
  waitsOnMe,
  type SquadVote,
  type VoteEvent,
  type VoteKind,
  type VoteStatus,
} from '../services/serviceVotes';
import { getVoteIdeas, type VoteIdea } from '../services/serviceVoteIdeas';
import HomeHeader from '../components/home/HomeHeader';
import { GroupNode, GroupTitle, MarkerNode, TallyNode, TimelineRow } from '../components/home/Timeline';
import { Reveal } from '../components/home/PlanLine';
import {
  decidedLine,
  inviteDaysLeft,
  InviteTicket,
  UsedVoteTicket,
  VoteRow,
  VoteTicket,
  voteTally,
} from '../components/votes/VoteTicket';
import { DecideStrip, IdeaTicket, QuickStarts, type QuickStep } from '../components/votes/VoteIdeas';
import NewVoteSheet, { type Step } from '../components/votes/NewVoteSheet';
import { errorText, UNIQUE_VIOLATION } from '../lib/postgres';
import { keyOf, weekdayShort } from '../lib/datetime';
import { membersWhoVote, votesNeeded } from '../lib/squadVote';
import { readJson, writeJson } from '../lib/store';
import type { Person } from '../lib/people';
import { colors, layout, radius, space, textSize, tint, typo } from '../theme';

type VotesScreenProps = {
  group: Group;
  userId: string;
  // Bumped from outside (a vote changed elsewhere): load again.
  reloadKey?: number;
  // Android's back button. Everywhere else the side rail is the way out.
  onBack: () => void;
  onOpenRail: () => void;
  onOpenSquad: (group: Group) => void;
  onOpenEvent: (event: VoteEvent) => void;
  // "Throw a plan": the plan form, whose plan goes to this parea's vote.
  onNewPlan: () => void;
  // A vote was cast, cancelled or decided: badges and plans may have moved.
  onChanged: () => void;
};

// Room under the last row, as on Home.
const BOTTOM_CLEARANCE = 96;
// getVotes() brings this many decided votes.
const DECIDED_SHOWN = 5;

// "Not now" on an idea is kept on this phone, per squad.
function notNowKey(groupId: string): string {
  return `squaddict.votes.notNow.${groupId}`;
}

// What the page says right after a vote went in.
function startedNotice(kind: VoteKind, status: VoteStatus, needed: number, members: number): string {
  if (status === 'passed') {
    if (kind === 'plan') return "Passed on the spot. It's on your plans.";
    return kind === 'invite' ? 'Passed on the spot. Share the invite below.' : 'Passed on the spot.';
  }
  if (status === 'rejected') return 'That vote was decided already.';
  return kind === 'poll' ? 'Question sent. Pick your answer too.' : `Vote started. It passes with ${needed} of ${members}.`;
}

// "FRI" over "02" on the rail, for a timestamp or a date key.
function railDay(value: string | null): { label: string; value: string } {
  if (!value) return { label: '', value: '–' };
  const key = /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : keyOf(new Date(value));
  return { label: weekdayShort(key), value: key.slice(8, 10) };
}

// The squad's votes, read like Home's line. What is open sits on top: the
// vote that waits on you is a ticket you answer in place, the others are rows
// you tap to bring forward. When nothing is open the line still has things on
// it: ideas worth a vote and one-tap ways to start one. Under the black
// DECIDED marker the line goes solid, like under NOW: those are over.
export default function VotesScreen({
  group,
  userId,
  reloadKey = 0,
  onBack,
  onOpenRail,
  onOpenSquad,
  onOpenEvent,
  onNewPlan,
  onChanged,
}: VotesScreenProps) {
  const [open, setOpen] = useState<SquadVote[]>([]);
  const [invites, setInvites] = useState<SquadVote[]>([]);
  const [decided, setDecided] = useState<SquadVote[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [ideas, setIdeas] = useState<VoteIdea[]>([]);
  const [hidden, setHidden] = useState<string[]>([]);
  const [monthCount, setMonthCount] = useState<number | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  // The open vote shown as the ticket, when you tapped one; else the natural one.
  const [chosen, setChosen] = useState<string | null>(null);
  const [composing, setComposing] = useState(false);
  const [composeStep, setComposeStep] = useState<Step>('menu');

  const members = group.memberCount;
  const needed = votesNeeded(membersWhoVote('poll', members));

  // Brings back the open votes, so a caller can pick out the one just made.
  const load = useCallback(
    async function load(): Promise<SquadVote[] | null> {
      setError(null);
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      try {
        const [votes, profiles, found, notNow, count] = await Promise.all([
          getVotes(group.id, userId),
          getMemberProfiles(group.id).catch((): Person[] => []),
          getVoteIdeas(group.id).catch((): VoteIdea[] => []),
          readJson<string[]>(notNowKey(group.id)),
          countDecidedSince(group.id, monthStart),
        ]);
        setOpen(votes.open);
        setInvites(votes.invites);
        setDecided(votes.decided);
        setPeople(profiles);
        setIdeas(found);
        setHidden(Array.isArray(notNow) ? notNow : []);
        setMonthCount(count);
        setLoaded(true);
        return votes.open;
      } catch {
        setError('Could not load the votes. Try again.');
        return null;
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [group.id, userId],
  );

  useEffect(() => {
    setLoading(true);
    setChosen(null);
    load();
  }, [load, reloadKey]);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      onBack();
      return true;
    });
    return () => sub.remove();
  }, [onBack]);

  // Puts the vote you just started in front.
  function showMine(list: SquadVote[] | null) {
    const mine = list?.find((vote) => vote.proposedBy === userId);
    if (mine) setChosen(mine.id);
  }

  async function run(key: string, action: () => Promise<unknown>, after?: (list: SquadVote[] | null) => void) {
    if (busy) return;
    setBusy(key);
    setError(null);
    setNotice(null);
    try {
      await action();
      const list = await load();
      after?.(list);
      onChanged();
    } catch (problem) {
      // Two members opening the same vote at once hit the one-open-vote
      // indexes instead of the friendly check in propose().
      const code = (problem as { code?: unknown } | null)?.code;
      setError(
        code === UNIQUE_VIOLATION ? 'There is already an open vote on that.' : errorText(problem, 'Could not save that. Try again.'),
      );
    } finally {
      setBusy(null);
    }
  }

  function openTarget(vote: SquadVote) {
    if (vote.target.type === 'squad') onOpenSquad(vote.target.group);
    else if (vote.target.type === 'plan' && vote.target.created) onOpenEvent(vote.target.event);
  }

  function compose(step: Step) {
    setNotice(null);
    setComposeStep(step);
    setComposing(true);
  }

  function putToVote(idea: VoteIdea) {
    run(
      idea.id,
      async () => {
        const status = await propose(group.id, idea.kind, idea.targetId);
        setNotice(startedNotice(idea.kind, status, needed, members));
      },
      showMine,
    );
  }

  function notNow(idea: VoteIdea) {
    const next = [...hidden.filter((id) => id !== idea.id), idea.id];
    setHidden(next);
    writeJson(notNowKey(group.id), next);
  }

  // Ideas already on the table (an open vote on the same parea) or put away
  // with Not now are left out.
  const onTable = new Set(open.map((vote) => (vote.target.type === 'squad' ? vote.target.group.id : vote.id)));
  const shownIdeas = ideas.filter((idea) => !hidden.includes(idea.id) && !onTable.has(idea.targetId));

  const waiting = open.filter((vote) => waitsOnMe(vote, userId));
  const front = open.find((vote) => vote.id === chosen) ?? waiting[0] ?? open[0] ?? null;
  const quiet = open.length === 0;

  // "This month · 3". Without the count, what the last five say ("5+" when
  // all five are from this month).
  const monthStartIso = (() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  })();
  const inMonth = decided.filter((vote) => (vote.closedAt ?? '') >= monthStartIso).length;
  const month = monthCount ?? inMonth;
  const monthText =
    month > 0
      ? `This month · ${monthCount === null && inMonth >= DECIDED_SHOWN ? `${DECIDED_SHOWN}+` : month}`
      : decided.length > 0
        ? `Last ${decided.length}`
        : 'Nothing decided yet';

  // "Last: followed Kathisterimenou, Fri".
  const lastDecided = decided[0];
  const lastDay = lastDecided ? railDay(lastDecided.closedAt).label : '';
  const last = lastDecided
    ? `${decidedLine(lastDecided)}${lastDay ? `, ${lastDay.charAt(0)}${lastDay.slice(1).toLowerCase()}` : ''}`
    : 'Nothing decided yet';

  function renderLine() {
    const rows: ReactNode[] = [];

    rows.push(
      <TimelineRow key="open" first node={<GroupNode hollow />}>
        <GroupTitle
          kicker="Open"
          title={quiet ? 'Nothing open' : `${open.length} ${open.length === 1 ? 'vote' : 'votes'}`}
          meta={
            quiet
              ? shownIdeas.length > 0
                ? 'Suspicious. Take a hint, or start one.'
                : 'Suspicious. Start one below.'
              : waiting.length > 0
                ? `${waiting.length} ${waiting.length === 1 ? 'needs' : 'need'} you`
                : 'All answered. The others are slow.'
          }
        />
      </TimelineRow>,
    );

    for (const vote of open) {
      const tally = voteTally(vote, members);
      const mine = waitsOnMe(vote, userId);
      rows.push(
        <TimelineRow
          key={vote.id}
          node={
            <TallyNode
              label={tally.label}
              value={tally.value}
              kind={mine ? 'ask' : 'wait'}
              accessibilityLabel={`${tally.label} ${tally.value.replace('/', ' of ')}`}
            />
          }
        >
          {vote.id === front?.id ? (
            <Reveal key={`${vote.id}-ticket`}>
              <VoteTicket
                vote={vote}
                members={members}
                people={people}
                userId={userId}
                busy={busy === vote.id}
                onYes={() => run(vote.id, () => castVote(vote.id, true))}
                onNo={() => run(vote.id, () => castVote(vote.id, false))}
                onPick={(optionId) => run(vote.id, () => castOption(vote.id, optionId))}
                onCancel={() => run(vote.id, () => cancelVote(vote.id))}
                onOpen={() => openTarget(vote)}
              />
            </Reveal>
          ) : (
            <Reveal key={`${vote.id}-row`}>
              <VoteRow vote={vote} userId={userId} waiting={mine} onPress={() => setChosen(vote.id)} />
            </Reveal>
          )}
        </TimelineRow>,
      );
    }

    if (shownIdeas.length > 0) {
      rows.push(
        <TimelineRow key="ideas" node={<GroupNode hollow />}>
          <GroupTitle
            kicker="Worth a vote"
            title={shownIdeas.length === 1 ? '1 idea' : `${shownIdeas.length} ideas`}
            meta="From the pareas you crossed"
          />
        </TimelineRow>,
      );
      for (const idea of shownIdeas) {
        const day = railDay(idea.date);
        rows.push(
          <TimelineRow key={idea.id} node={<TallyNode label={day.label} value={day.value} kind="wait" />}>
            <IdeaTicket idea={idea} busy={busy === idea.id} onPropose={() => putToVote(idea)} onLater={() => notNow(idea)} />
          </TimelineRow>,
        );
      }
    }

    if (quiet) {
      rows.push(
        <TimelineRow key="start" node={<GroupNode hollow />}>
          <GroupTitle kicker="Start one" title="One tap, then it goes out" />
          <QuickStarts
            onStart={(step: QuickStep) => (step === 'plan' ? onNewPlan() : compose(step))}
            onAll={() => compose('menu')}
          />
        </TimelineRow>,
      );
    }

    if (invites.length > 0) {
      rows.push(
        <TimelineRow key="invites" node={<GroupNode hollow />}>
          <GroupTitle
            kicker="To hand out"
            title={invites.length === 1 ? '1 invite' : `${invites.length} invites`}
            meta="Passed. Send it before it runs out."
          />
        </TimelineRow>,
      );
      for (const vote of invites) {
        const link = vote.target.type === 'invite' ? vote.target.link : null;
        const days = link ? inviteDaysLeft(link.createdAt) : 0;
        rows.push(
          <TimelineRow
            key={vote.id}
            node={<TallyNode label="Left" value={`${days}d`} kind="ask" accessibilityLabel={`${days} ${days === 1 ? 'day' : 'days'} left`} />}
          >
            <InviteTicket vote={vote} members={members} userId={userId} onStale={load} />
          </TimelineRow>,
        );
      }
    }

    rows.push(
      <TimelineRow key="decided" solid node={<MarkerNode label="Decided" />}>
        <View style={styles.decidedHead} accessibilityRole="header" accessible accessibilityLabel={`Decided. ${monthText}`}>
          <Text style={styles.decidedText}>{monthText.toUpperCase()}</Text>
          <View style={styles.decidedRule} />
        </View>
      </TimelineRow>,
    );

    for (const vote of decided) {
      const day = railDay(vote.closedAt);
      rows.push(
        <TimelineRow key={vote.id} solid node={<TallyNode label={day.label} value={day.value} kind="over" />}>
          <UsedVoteTicket vote={vote} userId={userId} />
        </TimelineRow>,
      );
    }

    return rows;
  }

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView
        contentContainerStyle={styles.content}
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
        <HomeHeader
          squad={group}
          label="Votes"
          onMenu={onOpenRail}
          right={
            <Pressable
              onPress={() => compose('menu')}
              accessibilityRole="button"
              accessibilityLabel="New vote"
              accessibilityHint={`Put something to the vote in ${group.name}`}
              style={({ pressed }) => [styles.newVote, pressed && styles.pressed]}
            >
              <Ionicons name="add" size={18} color={colors.onInk} />
              <Text style={styles.newVoteText}>New vote</Text>
            </Pressable>
          }
        />

        {loaded ? (
          <View style={styles.strip}>
            <DecideStrip people={people} needed={needed} members={members} last={last} />
          </View>
        ) : null}

        {notice ? (
          <View style={styles.notice} accessibilityLiveRegion="polite">
            <Ionicons name="checkmark" size={16} color={colors.success} />
            <Text style={styles.noticeText}>{notice}</Text>
          </View>
        ) : null}

        {error ? (
          <View style={styles.errorBox}>
            <Text style={styles.error} accessibilityLiveRegion="polite">
              {error}
            </Text>
            {!loaded && !loading ? (
              <Pressable
                onPress={() => {
                  setLoading(true);
                  load();
                }}
                accessibilityRole="button"
                accessibilityLabel="Try again"
                style={({ pressed }) => [styles.retry, pressed && styles.pressed]}
              >
                <Text style={styles.retryText}>Try again</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}

        {loading && !loaded ? (
          <ActivityIndicator color={colors.primary} style={styles.spinner} />
        ) : loaded ? (
          <View style={styles.line}>{renderLine()}</View>
        ) : null}
      </ScrollView>

      <NewVoteSheet
        visible={composing}
        group={group}
        userId={userId}
        initialStep={composeStep}
        onClose={() => setComposing(false)}
        onNewPlan={() => {
          setComposing(false);
          onNewPlan();
        }}
        onStarted={async (kind, status) => {
          setComposing(false);
          setNotice(startedNotice(kind, status, needed, members));
          showMine(await load());
          onChanged();
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: colors.bg },
  // Home's page: one column, the header level with the menu button.
  content: {
    width: '100%',
    maxWidth: layout.column,
    alignSelf: 'center',
    paddingTop: space.md,
    paddingBottom: BOTTOM_CLEARANCE + space.md,
    gap: space.sm,
  },
  pressed: { opacity: 0.6 },

  newVote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xxs,
    minHeight: 44,
    paddingLeft: 11,
    paddingRight: 14,
    borderRadius: radius.pill,
    backgroundColor: colors.ink,
  },
  newVoteText: { color: colors.onInk, ...typo.bold, fontSize: textSize.base },

  strip: { paddingHorizontal: space.md, marginTop: space.xxs },
  notice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    marginHorizontal: space.md,
    paddingVertical: space.sm,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: tint.success,
  },
  noticeText: { flex: 1, color: colors.success, ...typo.bold, fontSize: textSize.body },
  errorBox: { marginHorizontal: space.md, gap: space.xxs },
  error: { color: colors.danger, ...typo.medium, fontSize: textSize.body },
  retry: { alignSelf: 'flex-start', minHeight: 44, justifyContent: 'center' },
  retryText: { color: colors.primary, ...typo.bold, fontSize: textSize.body },
  spinner: { marginVertical: space.xl },
  line: { paddingTop: space.xs },

  decidedHead: { flexDirection: 'row', alignItems: 'center', gap: space.xs, height: 28 },
  decidedText: { color: colors.text, ...typo.mono, fontSize: 10.5, letterSpacing: 1.2 },
  decidedRule: { flex: 1, height: 1.5, backgroundColor: colors.ink, opacity: 0.25 },
});
