import { useEffect, useState } from 'react';
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
import { GroupMonogram } from '../components/chat/GroupPicker';
import {
  getInviteCode,
  getMembers,
  leaveGroup,
  rotateInviteCode,
  type Group,
} from '../services/serviceGroup';
import { layout, paper, typo, radius, space, textSize } from '../theme';

type Member = {
  id: string;
  name: string;
};

type GroupScreenProps = {
  group: Group;
  userId: string;
  onBack: () => void;
  onLeave?: () => void;
};

function plural(count: number, one: string, many: string) {
  return `${count} ${count === 1 ? one : many}`;
}

export default function GroupScreen({ group, userId, onBack, onLeave }: GroupScreenProps) {
  const [members, setMembers] = useState<Member[]>([]);
  const [code, setCode] = useState<string | null>(null);
  const [member, setMember] = useState(false);
  const [restricted, setRestricted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rotating, setRotating] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [leaving, setLeaving] = useState(false);

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
        }));
        mine = list.some((person) => person.id === userId);
      } catch {
        if (!cancelled) setRestricted(true);
      }

      if (cancelled) return;

      setMembers(list);
      setMember(mine);

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

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.column}>
        <View style={styles.header}>
          <Pressable
            onPress={onBack}
            accessibilityRole="button"
            accessibilityLabel="Back to the conversation"
            style={roundButtonStyle}
          >
            <Ionicons name="chevron-back" size={20} color={paper.ink} />
          </Pressable>

          <GroupMonogram name={group.name} size={32} />

          <Text style={styles.title} numberOfLines={1}>
            {group.name}
          </Text>
        </View>

        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.identity}>
            <GroupMonogram name={group.name} size={76} />

            <Text style={styles.name} numberOfLines={2}>
              {group.name}
            </Text>
            <Text style={styles.handle}>@{group.handle}</Text>
            <Text style={styles.count}>{plural(count, 'member', 'members')}</Text>

            {group.bio ? <Text style={styles.bio}>{group.bio}</Text> : null}
          </View>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          {loading ? (
            <ActivityIndicator color={paper.accent} style={styles.loader} />
          ) : (
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
                <Text style={styles.hint}>Only members can see who is in this squad.</Text>
              ) : (
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>MEMBERS</Text>

                {members.map((member) => (
                  <View key={member.id} style={styles.member}>
                    <GroupMonogram name={member.name} size={34} />
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
          )}
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

function roundButtonStyle({ pressed }: { pressed: boolean }) {
  return pressed ? [styles.round, styles.pressed] : styles.round;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: paper.bg },
  column: { flex: 1, width: '100%', maxWidth: layout.column, alignSelf: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingHorizontal: space.md,
    paddingTop: space.sm,
    paddingBottom: space.sm,
    borderBottomWidth: 1,
    borderBottomColor: paper.line,
  },
  round: {
    width: 32,
    height: 32,
    marginLeft: -4,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.6 },
  title: { flex: 1, color: paper.ink, ...typo.semi, fontSize: textSize.lead },

  content: { padding: space.md, gap: space.md, paddingBottom: space.xl },

  identity: { alignItems: 'center', gap: 3, paddingVertical: space.md },
  name: {
    marginTop: space.sm,
    color: paper.ink,
    ...typo.display,
    fontSize: textSize.hero,
    textAlign: 'center',
  },
  handle: { color: paper.accent, ...typo.mono, fontSize: textSize.body },
  count: { color: paper.inkFaint, ...typo.medium, fontSize: textSize.small },
  bio: {
    marginTop: space.sm,
    color: paper.inkSoft,
    ...typo.regular,
    fontSize: textSize.base,
    lineHeight: 21,
    textAlign: 'center',
  },

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
