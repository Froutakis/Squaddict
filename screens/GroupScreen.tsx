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
import SquadHero from '../components/group/SquadHero';
import SquadMemories from '../components/group/SquadMemories';
import SquadLookSheet from '../components/group/SquadLookSheet';
import FollowButton from '../components/group/FollowButton';
import SquadFollows from '../components/group/SquadFollows';
import SquadMenu from '../components/group/SquadMenu';
import SquadStats from '../components/group/SquadStats';
import { getFollowerIds, getFollowing } from '../services/serviceFollow';
import Monogram from '../components/general/Monogram';
import Segmented from '../components/general/Segmented';
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
import { layout, paper, typo, radius, shadow, space, textSize } from '../theme';
import { getGroupPublicEvents, type FeedEvent } from '../services/serviceFeed';
import { clearRsvp, setRsvp, type RsvpStatus } from '../services/serviceEvents';
import EventSheet, { type SheetEvent } from '../components/events/EventSheet';
import PublicProfile from '../components/group/PublicProfile';

type Member = {
  id: string;
  name: string;
  avatarUrl: string | null;
};

type Tab = 'memories' | 'following' | 'members';

const TABS: { value: Tab; label: string }[] = [
  { value: 'memories', label: 'Memories' },
  { value: 'following', label: 'Following' },
  { value: 'members', label: 'Members' },
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
  const [menuOpen, setMenuOpen] = useState(false);
  const [actingId, setActingId] = useState<string | null>(null);
  const [actingBusy, setActingBusy] = useState(false);
  const [actingError, setActingError] = useState<string | null>(null);
  const [opened, setOpened] = useState<Group | null>(null);
  const [followsReload, setFollowsReload] = useState(0);
  const [followCounts, setFollowCounts] = useState<{ following: number | null; followers: number | null }>({
    following: null,
    followers: null,
  });

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

    try {
      await leaveGroup(group.id);
      setMenuOpen(false);
      if (onLeave) onLeave();
      else onBack();
    } catch {
      setMenuOpen(false);
      setError('Could not leave the squad. Try again.');
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
          error={error}
          followAction={<FollowButton group={current} userId={userId} />}
          onBack={onBack}
          onAnswer={answer}
          onOpenPlan={openSheet}
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
            <Ionicons name="chevron-back" size={22} color={paper.ink} />
            <Text style={styles.backText} numberOfLines={1}>
              {backLabel}
            </Text>
          </Pressable>

          {member ? (
            <Pressable
              onPress={() => setMenuOpen(true)}
              accessibilityRole="button"
              accessibilityLabel="More options"
              hitSlop={8}
              style={({ pressed }) => [styles.moreButton, pressed && styles.pressed]}
            >
              <Ionicons name="ellipsis-horizontal" size={20} color={paper.ink} />
            </Pressable>
          ) : null}
        </View>

        <ScrollView contentContainerStyle={styles.content}>
          <SquadHero
            group={current}
            memberCount={count}
            nights={member ? 0 : nights}
            action={<FollowButton key={actingId ?? 'none'} group={current} userId={userId} />}
          />

          {member ? (
            <>
              <SquadStats
                stats={[
                  { value: count, label: count === 1 ? 'member' : 'members' },
                  { value: nights, label: nights === 1 ? 'night' : 'nights' },
                  { value: followCounts.following, label: 'follows' },
                  { value: followCounts.followers, label: followCounts.followers === 1 ? 'follower' : 'followers' },
                ]}
              />

              {isActing ? (
                <View style={styles.actingPill} accessibilityLabel="You are acting as this squad">
                  <View style={styles.actingDot} />
                  <Text style={styles.actingText}>Acting as this squad</Text>
                </View>
              ) : (
                <Pressable
                  onPress={actAsThisSquad}
                  disabled={actingBusy}
                  accessibilityRole="button"
                  accessibilityLabel="Act as this squad"
                  accessibilityHint="Follows will be made in this squad's name"
                  style={({ pressed }) => [styles.actButton, (pressed || actingBusy) && styles.pressed]}
                >
                  {actingBusy ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Ionicons name="flash" size={15} color="#FFFFFF" />
                  )}
                  <Text style={styles.actText}>Act as this squad</Text>
                </Pressable>
              )}
            </>
          ) : null}

          {actingError ? <Text style={styles.error}>{actingError}</Text> : null}
          {error ? <Text style={styles.error}>{error}</Text> : null}

          {loading ? (
            <ActivityIndicator color={paper.accent} style={styles.loader} />
          ) : (
            <>
              <Segmented options={TABS} value={tab} onChange={setTab} />

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
                <SquadFollows group={current} reloadKey={followsReload} onOpen={setOpened} />
              ) : null}

              {tab === 'members' ? (
                <View style={styles.membersTab}>
                  {member ? (
                    <View style={styles.invite}>
                      <View style={styles.inviteText}>
                        <Text style={styles.inviteLabel}>INVITE CODE</Text>
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
                  ) : null}

                  {restricted ? (
                    <Text style={styles.hint}>Only members see who is in this squad.</Text>
                  ) : (
                    <View style={styles.memberList}>
                      {members.map((person, index) => (
                        <View key={person.id} style={[styles.member, index > 0 && styles.memberDivider]}>
                          <Monogram name={person.name} uri={person.avatarUrl} size={38} />
                          <Text style={styles.memberName} numberOfLines={1}>
                            {person.name}
                          </Text>
                          {person.id === userId ? <Text style={styles.you}>You</Text> : null}
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              ) : null}
            </>
          )}
        </ScrollView>
      </View>

      <SquadMenu
        visible={menuOpen}
        squadName={current.name}
        onClose={() => setMenuOpen(false)}
        onEditLook={() => {
          setMenuOpen(false);
          afterSheet(() => setEditing(true));
        }}
        onInvite={() => {
          setMenuOpen(false);
          setTab('members');
        }}
        onLeave={handleLeave}
      />

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
    </SafeAreaView>
  );
}

// iOS can't present a sheet while another one is still sliding away.
const SHEET_CLOSE_MS = 350;

function afterSheet(open: () => void) {
  setTimeout(open, SHEET_CLOSE_MS);
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: paper.bg },
  column: { flex: 1, width: '100%', maxWidth: layout.column, alignSelf: 'center' },
  pressed: { opacity: 0.6 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.sm,
    height: 48,
  },
  backButton: { flexDirection: 'row', alignItems: 'center', gap: 2, flexShrink: 1, paddingRight: space.sm },
  backText: { color: paper.ink, ...typo.semi, fontSize: textSize.lead },
  moreButton: {
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: paper.surface,
  },
  actButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 44,
    borderRadius: radius.pill,
    backgroundColor: paper.ink,
  },
  actText: { color: '#FFFFFF', ...typo.semi, fontSize: textSize.base },
  actingPill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    height: 44,
    borderRadius: radius.pill,
    backgroundColor: paper.accentSoft,
  },
  actingDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: paper.accent },
  actingText: { color: paper.accent, ...typo.semi, fontSize: textSize.base },

  content: { paddingHorizontal: space.md, paddingBottom: space.xl, gap: space.md },

  loader: { marginVertical: space.xl },
  error: { color: paper.danger, ...typo.medium, fontSize: textSize.body },
  hint: {
    color: paper.inkFaint,
    ...typo.regular,
    fontSize: textSize.body,
    textAlign: 'center',
    paddingVertical: space.md,
  },

  membersTab: { gap: space.md },
  invite: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderRadius: radius.lg,
    backgroundColor: paper.surface,
    ...shadow.card,
  },
  inviteText: { flex: 1, gap: 2 },
  inviteLabel: { color: paper.inkFaint, ...typo.mono, fontSize: textSize.micro, letterSpacing: 1.2 },
  code: { color: paper.ink, ...typo.mono, fontSize: textSize.heading, letterSpacing: 3 },
  roundButton: {
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: paper.bg,
  },
  memberList: { borderRadius: radius.lg, backgroundColor: paper.surface, overflow: 'hidden', ...shadow.card },
  member: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingHorizontal: space.md,
    paddingVertical: 10,
  },
  memberDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: paper.line },
  memberName: { flex: 1, color: paper.ink, ...typo.medium, fontSize: textSize.base },
  you: { color: paper.inkFaint, ...typo.medium, fontSize: textSize.small },
});
