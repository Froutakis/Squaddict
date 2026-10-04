import { useCallback, useEffect, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import SquadMemories from '../components/group/SquadMemories';
import SquadLookSheet from '../components/group/SquadLookSheet';
import FollowButton from '../components/group/FollowButton';
import SquadFollows from '../components/group/SquadFollows';
import SquadVotes from '../components/group/SquadVotes';
import SquadProfileHeader, { ACTING_ACCENT } from '../components/group/SquadProfileHeader';
import { getFollowerIds, getFollowing } from '../services/serviceFollow';
import { getOpenVotes, type SquadVote } from '../services/serviceVotes';
import Monogram from '../components/general/Monogram';
import IconTabs from '../components/general/IconTabs';
import DashedDivider from '../components/general/DashedDivider';
import { getActingSquad, setActingGroup } from '../services/serviceUser';
import {
  getGroupById,
  getInviteCode,
  getMembers,
  getNightsKept,
  leaveGroup,
  rotateInviteCode,
  type Group,
} from '../services/serviceGroup';
import { layout, paper, typo, radius, space, textSize } from '../theme';
import { getGroupPublicEvents, type FeedEvent } from '../services/serviceFeed';
import { clearRsvp, setRsvp, type RsvpStatus } from '../services/serviceEvents';
import EventSheet, { type SheetEvent } from '../components/events/EventSheet';
import PublicProfile from '../components/group/PublicProfile';
import RsvpButtons from '../components/events/RsvpButtons';
import SquadGoStub from '../components/events/SquadGoStub';
import { useSquadPlans } from '../components/events/useSquadPlans';
import { voteEventToSheet } from '../components/votes/VoteCard';

type Member = {
  id: string;
  name: string;
  avatarUrl: string | null;
};

type Tab = 'memories' | 'following' | 'members';

const TABS = [
  { value: 'memories' as const, label: 'Memories', icon: 'grid-outline' as const, activeIcon: 'grid' as const },
  { value: 'following' as const, label: 'Following', icon: 'compass-outline' as const, activeIcon: 'compass' as const },
  { value: 'members' as const, label: 'Members', icon: 'people-outline' as const, activeIcon: 'people' as const },
];

type GroupScreenProps = {
  group: Group;
  userId: string;
  onBack: () => void;
  onLeave?: () => void;
  onChange?: (group: Group) => void;
  // What the top bar's back button says, e.g. "You".
  backLabel?: string;
};

export default function GroupScreen({
  group,
  userId,
  onBack,
  onLeave,
  onChange,
  backLabel = 'Back',
}: GroupScreenProps) {
  const [plans, setPlans] = useState<FeedEvent[]>([]);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [openPlan, setOpenPlan] = useState<SheetEvent | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [code, setCode] = useState<string | null>(null);
  const [member, setMember] = useState(false);
  const [restricted, setRestricted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rotating, setRotating] = useState(false);
  const [current, setCurrent] = useState(group);
  const [nights, setNights] = useState(0);
  const [editing, setEditing] = useState(false);
  const [tab, setTab] = useState<Tab>('memories');
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [actingId, setActingId] = useState<string | null>(null);
  const [actingBusy, setActingBusy] = useState(false);
  const [actingError, setActingError] = useState<string | null>(null);
  const [opened, setOpened] = useState<Group | null>(null);
  const [followsReload, setFollowsReload] = useState(0);
  const [votes, setVotes] = useState<SquadVote[]>([]);
  const [followCounts, setFollowCounts] = useState<{ following: number | null; followers: number | null }>({
    following: null,
    followers: null,
  });
  const squadPlans = useSquadPlans(
    userId,
    plans.map((plan) => ({ id: plan.id, groupId: plan.groupId })),
  );

  useEffect(() => {
    setCurrent(group);
  }, [group]);

  useEffect(() => {
    let cancelled = false;
    getActingSquad(userId)
      .then(function (acting) {
        if (!cancelled) setActingId(acting?.id ?? null);
      })
      .catch(function () {});
    return function cleanup() {
      cancelled = true;
    };
  }, [userId]);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      getFollowing(group.id).then((list) => list.length).catch(() => null),
      getFollowerIds(group.id).then((ids) => ids.length).catch(() => null),
    ]).then(function ([following, followers]) {
      if (!cancelled) setFollowCounts({ following, followers });
    });
    return function cleanup() {
      cancelled = true;
    };
  }, [group.id, followsReload]);

  // Open votes of this squad. Outsiders get nothing back, which is fine.
  useEffect(() => {
    let cancelled = false;
    getOpenVotes(group.id, userId)
      .then(function (open) {
        if (!cancelled) setVotes(open);
      })
      .catch(function () {
        if (!cancelled) setVotes([]);
      });
    return function cleanup() {
      cancelled = true;
    };
  }, [group.id, userId, followsReload]);

  async function actAsThisSquad() {
    if (actingBusy || actingId === group.id) return;

    const previous = actingId;
    setActingId(group.id);
    setActingBusy(true);
    setActingError(null);

    try {
      await setActingGroup(userId, group.id);
    } catch {
      setActingId(previous);
      setActingError('Could not switch. Try again.');
    } finally {
      setActingBusy(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    getGroupById(group.id)
      .then(function (fresh) {
        if (!cancelled && fresh) setCurrent(fresh);
      })
      .catch(function () {});
    return function cleanup() {
      cancelled = true;
    };
  }, [group.id]);

  const refreshNights = useCallback(
    function refreshNights() {
      return getNightsKept(group.id)
        .then(function (count) {
          setNights(count);
        })
        .catch(function () {});
    },
    [group.id],
  );

  useEffect(() => {
    let cancelled = false;
    getNightsKept(group.id)
      .then(function (count) {
        if (!cancelled) setNights(count);
      })
      .catch(function () {});
    return function cleanup() {
      cancelled = true;
    };
  }, [group.id]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);

      let list: Member[] = [];
      let mine = false;

      try {
        const rows = await getMembers(group.id);
        list = (rows as any[]).map((row) => ({
          id: row.user_id,
          name: row.profiles?.display_name ?? 'Someone',
          avatarUrl: row.profiles?.avatar_url ?? null,
        }));
        mine = list.some((person) => person.id === userId);
      } catch {
        if (!cancelled) setRestricted(true);
      }

      if (cancelled) return;

      setMembers(list);
      setMember(mine);
      if (!mine) setRestricted(true);

      if (!mine) {
        try {
          const upcoming = await getGroupPublicEvents(group.id);
          if (!cancelled) setPlans(upcoming);
        } catch {
          if (!cancelled) setError("Couldn't load their plans");
        }
      }

      if (mine) {
        try {
          const invite = await getInviteCode(group.id);
          if (!cancelled) setCode(invite);
        } catch {
          if (!cancelled) setError("Couldn't load the invite code");
        }
      }

      if (!cancelled) setLoading(false);
    }

    load();

    return function cleanup() {
      cancelled = true;
    };
  }, [group.id, userId]);

  async function answer(plan: FeedEvent, status: RsvpStatus | null) {
    setSavingId(plan.id);
    setError(null);

    try {
      if (status) await setRsvp(plan.id, status);
      else await clearRsvp(plan.id);

      setPlans((current) =>
        current.map((one) => {
          if (one.id !== plan.id) return one;
          const wasIn = one.myStatus === 'in';
          const isIn = status === 'in';
          const goingCount = one.goingCount + (isIn && !wasIn ? 1 : 0) - (wasIn && !isIn ? 1 : 0);
          return { ...one, myStatus: status ?? undefined, goingCount: Math.max(0, goingCount) };
        }),
      );
    } catch {
      setError('Could not save your answer. Try again.');
    } finally {
      setSavingId(null);
    }
  }

  async function handleRotate() {
    setRotating(true);
    setError(null);

    try {
      setCode(await rotateInviteCode(group.id));
    } catch {
      setError('Could not make a new code. Try again.');
    } finally {
      setRotating(false);
    }
  }

  async function handleLeave() {
    setError(null);
    setLeaving(true);

    try {
      await leaveGroup(group.id);
      if (onLeave) onLeave();
      else onBack();
    } catch {
      setError('Could not leave the squad. Try again.');
      setLeaving(false);
      setConfirmLeave(false);
    }
  }

  const count = members.length > 0 ? members.length : group.memberCount;
  const isActing = actingId === group.id;

  function openSheet(plan: FeedEvent) {
    setOpenPlan({
      id: plan.id,
      groupName: plan.groupName,
      title: plan.title,
      date: plan.date,
      startTime: plan.startTime,
      location: plan.location,
      placeLabel: plan.placeLabel,
      lat: plan.lat,
      lng: plan.lng,
      isMember: false,
      groupId: plan.groupId,
      isPublic: true,
    });
  }

  const sheet = (
    <EventSheet
      event={openPlan}
      currentUserId={userId}
      onClose={() => setOpenPlan(null)}
      onChanged={async () => setPlans(await getGroupPublicEvents(group.id))}
    />
  );

  // A squad opened from the Following tab stacks on top of this one.
  if (opened) {
    const close = () => {
      setOpened(null);
      setFollowsReload((n) => n + 1);
    };
    return (
      <GroupScreen group={opened} userId={userId} onBack={close} onLeave={close} backLabel={current.name} />
    );
  }

  // People outside the squad get its public profile instead.
  if (!loading && !member) {
    return (
      <>
        <PublicProfile
          group={current}
          plans={plans}
          savingId={savingId}
          error={error ?? squadPlans.error}
          followAction={<FollowButton group={current} userId={userId} />}
          onBack={onBack}
          onAnswer={answer}
          onOpenPlan={openSheet}
          stubFor={(plan) => (
            <SquadGoStub
              stance={squadPlans.stanceFor(plan)}
              busy={squadPlans.busyId === plan.id}
              onAct={() => squadPlans.act(plan)}
            >
              <RsvpButtons
                status={plan.myStatus}
                saving={savingId === plan.id}
                onChange={(status) => answer(plan, status)}
                compact
                stretch
              />
            </SquadGoStub>
          )}
        />
        {sheet}
      </>
    );
  }

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.column}>
        <View style={styles.topBar}>
          <Pressable
            onPress={onBack}
            accessibilityRole="button"
            accessibilityLabel={'Back to ' + backLabel}
            hitSlop={8}
            style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
          >
            <Ionicons name="chevron-back" size={24} color={paper.ink} />
            <Text style={styles.backText} numberOfLines={1}>
              {backLabel}
            </Text>
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.content}>
          {loading ? (
            <ActivityIndicator color={paper.accent} style={styles.loader} />
          ) : (
            <>
              <SquadProfileHeader
                group={current}
                canReposition={member}
                stats={[
                  { value: nights, label: nights === 1 ? 'night' : 'nights' },
                  { value: count, label: count === 1 ? 'member' : 'members' },
                  { value: followCounts.followers, label: followCounts.followers === 1 ? 'follower' : 'followers' },
                  { value: followCounts.following, label: 'following' },
                ]}
              />

              <DashedDivider />

              <View style={styles.buttons}>
                {isActing ? (
                  <View style={[styles.button, styles.buttonActing]} accessibilityLabel="You are acting as this squad">
                    <View style={styles.actingDot} />
                    <Text style={styles.buttonActingText} numberOfLines={1}>
                      Acting
                    </Text>
                  </View>
                ) : (
                  <Pressable
                    onPress={actAsThisSquad}
                    disabled={actingBusy}
                    accessibilityRole="button"
                    accessibilityLabel="Act as this squad"
                    accessibilityHint="Follows will be made in this squad's name"
                    style={({ pressed }) => [styles.button, styles.buttonPrimary, (pressed || actingBusy) && styles.pressed]}
                  >
                    <Text style={styles.buttonPrimaryText} numberOfLines={1}>
                      {actingBusy ? 'Switching…' : 'Act as'}
                    </Text>
                  </Pressable>
                )}

                <Pressable
                  onPress={() => setEditing(true)}
                  accessibilityRole="button"
                  accessibilityLabel="Edit look"
                  style={({ pressed }) => [styles.button, pressed && styles.pressed]}
                >
                  <Text style={styles.buttonText} numberOfLines={1}>
                    Edit look
                  </Text>
                </Pressable>

                <Pressable
                  onPress={() => setTab('members')}
                  accessibilityRole="button"
                  accessibilityLabel="Invite people"
                  style={({ pressed }) => [styles.button, pressed && styles.pressed]}
                >
                  <Text style={styles.buttonText} numberOfLines={1}>
                    Invite
                  </Text>
                </Pressable>
              </View>

              <FollowButton
                key={actingId ?? 'none'}
                group={current}
                userId={userId}
                onChanged={() => setFollowsReload((n) => n + 1)}
              />

              {actingError ? <Text style={styles.error}>{actingError}</Text> : null}
              {error ? <Text style={styles.error}>{error}</Text> : null}

              <DashedDivider />

              <IconTabs
                options={TABS.map((option) =>
                  option.value === 'following'
                    ? { ...option, dot: votes.some((vote) => vote.myVote === null) }
                    : option,
                )}
                value={tab}
                onChange={setTab}
              />

              {tab === 'memories' ? (
                <SquadMemories
                  group={current}
                  userId={userId}
                  member={member}
                  nights={nights}
                  onPhotosChanged={refreshNights}
                />
              ) : null}

              {tab === 'following' ? (
                <>
                  <SquadVotes
                    votes={votes}
                    members={count}
                    userId={userId}
                    onOpenSquad={setOpened}
                    onOpenEvent={(event) => setOpenPlan(voteEventToSheet(event))}
                    onChanged={() => setFollowsReload((n) => n + 1)}
                  />
                  <SquadFollows group={current} reloadKey={followsReload} onOpen={setOpened} />
                </>
              ) : null}

              {tab === 'members' ? (
                <View style={styles.membersTab}>
                  <View style={styles.invite}>
                    <View style={styles.inviteText}>
                      <Text style={styles.inviteLabel}>Invite code</Text>
                      <Text style={styles.code} selectable>
                        {code ?? '——————'}
                      </Text>
                    </View>
                    <Pressable
                      onPress={handleRotate}
                      disabled={rotating}
                      accessibilityRole="button"
                      accessibilityLabel="Make a new invite code"
                      hitSlop={6}
                      style={({ pressed }) => [styles.roundButton, pressed && styles.pressed]}
                    >
                      {rotating ? (
                        <ActivityIndicator size="small" color={paper.ink} />
                      ) : (
                        <Ionicons name="refresh" size={17} color={paper.ink} />
                      )}
                    </Pressable>
                  </View>

                  {restricted ? (
                    <Text style={styles.hint}>Only members see who is in this squad.</Text>
                  ) : (
                    <View style={styles.memberList}>
                      {members.map((person, index) => (
                        <View key={person.id} style={[styles.member, index > 0 && styles.memberDivider]}>
                          <Monogram name={person.name} uri={person.avatarUrl} size={40} />
                          <Text style={styles.memberName} numberOfLines={1}>
                            {person.name}
                          </Text>
                          {person.id === userId ? <Text style={styles.you}>You</Text> : null}
                        </View>
                      ))}
                    </View>
                  )}

                  {confirmLeave ? (
                    <View style={styles.leaveConfirm}>
                      <Text style={styles.leaveQuestion}>Leave {current.name}? You can come back with a code.</Text>
                      <View style={styles.buttons}>
                        <Pressable
                          onPress={() => setConfirmLeave(false)}
                          disabled={leaving}
                          accessibilityRole="button"
                          accessibilityLabel="Cancel"
                          style={({ pressed }) => [styles.button, pressed && styles.pressed]}
                        >
                          <Text style={styles.buttonText}>Cancel</Text>
                        </Pressable>
                        <Pressable
                          onPress={handleLeave}
                          disabled={leaving}
                          accessibilityRole="button"
                          accessibilityLabel={'Leave ' + current.name}
                          style={({ pressed }) => [styles.button, styles.buttonDanger, pressed && styles.pressed]}
                        >
                          <Text style={styles.buttonDangerText}>{leaving ? 'Leaving…' : 'Leave'}</Text>
                        </Pressable>
                      </View>
                    </View>
                  ) : (
                    <Pressable
                      onPress={() => setConfirmLeave(true)}
                      accessibilityRole="button"
                      accessibilityLabel="Leave this squad"
                      style={({ pressed }) => [styles.leaveLink, pressed && styles.pressed]}
                    >
                      <Text style={styles.leaveLinkText}>Leave squad</Text>
                    </Pressable>
                  )}
                </View>
              ) : null}
            </>
          )}
        </ScrollView>
      </View>

      <SquadLookSheet
        visible={editing}
        group={current}
        onClose={function () {
          setEditing(false);
        }}
        onChange={function (fresh) {
          setCurrent(fresh);
          onChange?.(fresh);
        }}
      />
      {sheet}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: paper.bg },
  column: { flex: 1, width: '100%', maxWidth: layout.column, alignSelf: 'center' },
  pressed: { opacity: 0.6 },

  topBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.xs, height: 48 },
  backButton: { flexDirection: 'row', alignItems: 'center', gap: 2, flexShrink: 1, paddingRight: space.sm },
  backText: { color: paper.ink, ...typo.semi, fontSize: textSize.lead },

  content: { paddingHorizontal: space.lg, paddingTop: space.xs, paddingBottom: space.xl, gap: space.lg },
  loader: { marginVertical: space.xl },
  error: { color: paper.danger, ...typo.medium, fontSize: textSize.body },
  hint: {
    color: paper.inkFaint,
    ...typo.regular,
    fontSize: textSize.body,
    textAlign: 'center',
    paddingVertical: space.md,
  },

  buttons: { flexDirection: 'row', gap: 6 },
  // Calm, neutral buttons: white with a hairline, the same for every action.
  button: {
    flex: 1,
    height: 38,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: paper.line,
    backgroundColor: paper.surface,
  },
  buttonText: { color: paper.ink, ...typo.semi, fontSize: textSize.body },
  buttonPrimary: {},
  buttonPrimaryText: { color: paper.ink, ...typo.semi, fontSize: textSize.body },
  buttonActing: { backgroundColor: paper.bg },
  buttonActingText: { color: paper.inkSoft, ...typo.semi, fontSize: textSize.body },
  actingDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: ACTING_ACCENT },
  buttonDanger: { borderColor: paper.danger },
  buttonDangerText: { color: paper.danger, ...typo.semi, fontSize: textSize.body },

  membersTab: { gap: space.md },
  invite: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: paper.line,
    backgroundColor: paper.surface,
  },
  inviteText: { flex: 1, gap: 2 },
  inviteLabel: { color: paper.inkSoft, ...typo.regular, fontSize: textSize.small },
  code: { color: paper.ink, ...typo.mono, fontSize: textSize.heading, letterSpacing: 3 },
  roundButton: {
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: paper.surfaceAlt,
  },
  memberList: { gap: 2 },
  member: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingVertical: 8 },
  memberDivider: {},
  memberName: { flex: 1, color: paper.ink, ...typo.semi, fontSize: textSize.base },
  you: { color: paper.inkFaint, ...typo.medium, fontSize: textSize.small },
  leaveConfirm: { gap: space.sm },
  leaveQuestion: { color: paper.ink, ...typo.medium, fontSize: textSize.body, textAlign: 'center' },
  leaveLink: { alignSelf: 'center', paddingVertical: space.sm },
  leaveLinkText: { color: paper.danger, ...typo.semi, fontSize: textSize.body },
});
