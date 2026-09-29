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
import { layout, paper, typo, radius, space, textSize } from '../theme';
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
  const [confirming, setConfirming] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [current, setCurrent] = useState(group);
  const [nights, setNights] = useState(0);
  const [editing, setEditing] = useState(false);
  const [tab, setTab] = useState<Tab>('memories');
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
    setLeaving(true);
    setError(null);

    try {
      await leaveGroup(group.id);
      if (onLeave) onLeave();
      else onBack();
    } catch {
      setError('Could not leave the squad. Try again.');
      setLeaving(false);
      setConfirming(false);
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
                <Ionicons
                  name={isActing ? 'checkmark-circle' : 'flash-outline'}
                  size={16}
                  color={isActing ? paper.accent : '#FFFFFF'}
                />
                <Text style={isActing ? styles.actOnText : styles.actOffText} numberOfLines={1}>
                  {isActing ? 'Acting as this squad' : actingBusy ? 'Switching…' : 'Act as this squad'}
                </Text>
              </Pressable>

              <Pressable
                onPress={function () {
                  setEditing(true);
                }}
                accessibilityRole="button"
                accessibilityLabel="Edit look"
                style={({ pressed }) => [styles.editLook, pressed && styles.pressed]}
              >
                <Ionicons name="color-palette-outline" size={16} color={paper.accent} />
                <Text style={styles.editLookText}>Edit look</Text>
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
            <>
              {member ? (
              <View style={styles.card}>
                <Text style={styles.cardLabel}>INVITE CODE</Text>

                <View style={styles.codeRow}>
                  <Text style={styles.code} selectable>
                    {code ?? '——————'}
                  </Text>

                  <Pressable
                    onPress={handleRotate}
                    disabled={rotating}
                    accessibilityRole="button"
                    accessibilityLabel="Make a new invite code"
                    style={({ pressed }) => [styles.ghost, pressed && styles.pressed]}
                  >
                    <Ionicons name="refresh" size={15} color={paper.accent} />
                    <Text style={styles.ghostText}>{rotating ? 'Working…' : 'New code'}</Text>
                  </Pressable>
                </View>

                <Text style={styles.cardHint}>
                  Anyone with this code can join. Make a new one and the old stops working.
                </Text>
              </View>
              ) : null}

              {restricted ? (
                <Text style={styles.hint}>Only members see who is in this squad.</Text>
              ) : (
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>MEMBERS</Text>

                {members.map((member) => (
                  <View key={member.id} style={styles.member}>
                    <Monogram name={member.name} uri={member.avatarUrl} size={34} />
                    <Text style={styles.memberName} numberOfLines={1}>
                      {member.name}
                    </Text>
                    {member.id === userId ? <Text style={styles.you}>you</Text> : null}
                  </View>
                ))}
              </View>
              )}

              {!member ? null : confirming ? (
                <View style={styles.confirmRow}>
                  <Pressable
                    onPress={() => setConfirming(false)}
                    disabled={leaving}
                    accessibilityRole="button"
                    accessibilityLabel="Cancel"
                    style={({ pressed }) => [styles.confirm, styles.cancel, pressed && styles.pressed]}
                  >
                    <Text style={styles.cancelText}>Cancel</Text>
                  </Pressable>

                  <Pressable
                    onPress={handleLeave}
                    disabled={leaving}
                    accessibilityRole="button"
                    accessibilityLabel="Confirm leaving the squad"
                    style={({ pressed }) => [styles.confirm, styles.danger, pressed && styles.pressed]}
                  >
                    <Text style={styles.dangerText}>{leaving ? 'Leaving…' : 'Yes, leave'}</Text>
                  </Pressable>
                </View>
              ) : (
                <Pressable
                  onPress={() => setConfirming(true)}
                  accessibilityRole="button"
                  accessibilityLabel="Leave this squad"
                  style={({ pressed }) => [styles.leave, pressed && styles.pressed]}
                >
                  <Ionicons name="exit-outline" size={16} color={paper.danger} />
                  <Text style={styles.leaveText}>Leave squad</Text>
                </Pressable>
              )}
            </>
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
    </SafeAreaView>
  );
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
    height: 40,
    paddingHorizontal: space.md,
    borderRadius: radius.pill,
  },
  actOff: { backgroundColor: paper.ink },
  actOn: { backgroundColor: paper.accentSoft },
  actOffText: { color: '#FFFFFF', ...typo.semi, fontSize: textSize.body },
  actOnText: { color: paper.accent, ...typo.semi, fontSize: textSize.body },
  editLook: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    height: 40,
    paddingHorizontal: space.md,
    borderRadius: radius.pill,
    backgroundColor: paper.accentSoft,
  },
  editLookText: { color: paper.accent, ...typo.semi, fontSize: textSize.body },
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

  card: {
    backgroundColor: paper.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: paper.line,
    padding: space.md,
    gap: space.sm,
  },
  cardLabel: {
    color: paper.inkFaint,
    ...typo.mono,
    fontSize: textSize.micro,
    letterSpacing: 1.2,
  },
  codeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm },
  code: {
    color: paper.ink,
    ...typo.mono,
    fontSize: textSize.heading,
    letterSpacing: 3,
  },
  ghost: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: radius.pill,
    backgroundColor: paper.accentSoft,
  },
  ghostText: { color: paper.accent, ...typo.semi, fontSize: textSize.small },
  cardHint: { color: paper.inkFaint, ...typo.regular, fontSize: textSize.small, lineHeight: 17 },

  section: { gap: space.xs },
  sectionLabel: {
    marginBottom: space.xxs,
    color: paper.inkFaint,
    ...typo.mono,
    fontSize: textSize.micro,
    letterSpacing: 1.2,
  },
  member: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    backgroundColor: paper.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: paper.line,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
  },
  memberName: { flex: 1, color: paper.ink, ...typo.medium, fontSize: textSize.base },
  you: {
    color: paper.inkFaint,
    ...typo.mono,
    fontSize: textSize.caption,
  },

  leave: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    marginTop: space.sm,
    paddingVertical: 13,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: paper.line,
    backgroundColor: paper.surface,
  },
  leaveText: { color: paper.danger, ...typo.semi, fontSize: textSize.base },
  confirmRow: { flexDirection: 'row', gap: space.sm, marginTop: space.sm },
  confirm: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 13,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  cancel: { borderColor: paper.line, backgroundColor: paper.surface },
  cancelText: { color: paper.inkSoft, ...typo.semi, fontSize: textSize.base },
  danger: { borderColor: paper.danger, backgroundColor: paper.danger },
  dangerText: { color: '#FFFFFF', ...typo.semi, fontSize: textSize.base },
});
