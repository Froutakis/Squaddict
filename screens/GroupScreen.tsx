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
import { layout, paper, typo, radius, space, sun, textSize } from '../theme';
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
};

export default function GroupScreen({ group, userId, onBack, onLeave, onChange }: GroupScreenProps) {
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
    return <GroupScreen group={opened} userId={userId} onBack={close} onLeave={close} />;
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
        <ScrollView contentContainerStyle={styles.content}>
          <SquadHero
            group={current}
            memberCount={count}
            nights={nights}
            onBack={onBack}
            action={<FollowButton key={actingId ?? 'none'} group={current} userId={userId} />}
          />

          {member ? (
            <View style={styles.actions}>
              <Pressable
                onPress={actAsThisSquad}
                disabled={actingBusy || isActing}
                accessibilityRole="button"
                accessibilityLabel={isActing ? 'You are acting as this squad' : 'Act as this squad'}
                accessibilityState={{ selected: isActing, disabled: actingBusy || isActing }}
                style={({ pressed }) => [
                  styles.actButton,
                  isActing ? styles.actOn : styles.actOff,
                  pressed && styles.pressed,
                ]}
              >
                {isActing ? <View style={styles.actDot} /> : null}
                <Text style={isActing ? styles.actOnText : styles.actOffText} numberOfLines={1}>
                  {isActing ? 'Acting as this squad' : actingBusy ? 'Switching…' : 'Act as this squad'}
                </Text>
              </Pressable>

              <Pressable
                onPress={() => setMenuOpen(true)}
                accessibilityRole="button"
                accessibilityLabel="More options"
                hitSlop={6}
                style={({ pressed }) => [styles.more, pressed && styles.pressed]}
              >
                <Ionicons name="ellipsis-horizontal" size={20} color={paper.ink} />
              </Pressable>
            </View>
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
  actions: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  actButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.xs,
    height: 38,
    paddingHorizontal: space.md,
    borderRadius: radius.sm,
  },
  actOff: { backgroundColor: paper.ink },
  actOn: { backgroundColor: paper.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: paper.line },
  actDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: sun },
  actOffText: { color: '#FFFFFF', ...typo.semi, fontSize: textSize.body },
  actOnText: { color: paper.ink, ...typo.semi, fontSize: textSize.body },
  more: {
    width: 38,
    height: 38,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: paper.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: paper.line,
  },
  pressed: { opacity: 0.6 },

  content: { padding: space.md, gap: space.md, paddingBottom: space.xl },

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
    borderRadius: radius.md,
    backgroundColor: paper.surface,
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
  memberList: { borderRadius: radius.md, backgroundColor: paper.surface, overflow: 'hidden' },
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
