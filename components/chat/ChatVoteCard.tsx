import { useEffect, useRef, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, Animated, Easing, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import type { SquadVote } from '../../services/serviceVotes';
import type { RsvpStatus } from '../../services/serviceEvents';
import type { Person } from '../../lib/people';
import { formatDateTime } from '../../lib/datetime';
import { placeLines } from '../../lib/place';
import { membersWhoVote, votesNeeded } from '../../lib/squadVote';
import Ticket from '../general/Ticket';
import Monogram from '../general/Monogram';
import { colors, paper, radius, space, textSize, tint, typo } from '../../theme';

// Cards in the chat are a ticket wide, not a bubble.
export const CARD_WIDTH = 286;

const ON_BRAND_SOFT = 'rgba(255,255,255,0.78)';
const ON_BRAND_FAINT = 'rgba(255,255,255,0.2)';

type ChatVoteCardProps = {
  vote: SquadVote;
  // Members of the parea now: who decides.
  members: number;
  people: Person[];
  userId: string;
  busy: boolean;
  // Your own answer on the plan a passed vote made.
  going?: RsvpStatus;
  // The stamp lands with a thump only when it passed while you watched.
  justPassed?: boolean;
  onVote: (approve: boolean) => void;
  onPick: (optionId: string) => void;
  onGoing: (status: RsvpStatus | null) => void;
  onOpenPlan?: () => void;
  // The message menu (reply, react), from the parts of the card that open.
  onLongPress?: () => void;
};

// A vote put to the parea from the chat, answered right on its stub: a new
// plan (Yes / No, then I'm in / Pass once it is made) or a question.
export default function ChatVoteCard(props: ChatVoteCardProps) {
  if (props.vote.target.type === 'poll') return <PollCard {...props} />;
  if (props.vote.target.type === 'plan') return <PlanVoteCard {...props} />;
  return null;
}

function askerOf(vote: SquadVote, userId: string): string {
  if (vote.proposedBy === userId) return 'You';
  return vote.proposerName ?? 'Someone';
}

function PlanVoteCard({ vote, members, userId, busy, going, justPassed = false, onVote, onGoing, onOpenPlan, onLongPress }: ChatVoteCardProps) {
  const [changing, setChanging] = useState(false);
  if (vote.target.type !== 'plan') return null;

  const event = vote.target.event;
  const where = placeLines(event.location, event.placeLabel).primary;
  const line = [event.date ? formatDateTime(event.date, event.startTime) : null, where].filter(Boolean).join(' · ');
  const deciding = membersWhoVote('plan', members);
  const needed = votesNeeded(deciding);
  const asker = askerOf(vote, userId);
  const wants = asker === 'You' ? 'You want to throw a plan' : `${asker} wants to throw a plan`;

  if (vote.status === 'passed') {
    return (
      <Ticket
        style={styles.card}
        accessibilityLabel={`Plan made: ${event.title}`}
        stub={
          <View style={styles.stubBody}>
            {busy ? (
              <ActivityIndicator color={colors.primary} style={styles.spinner} />
            ) : (
              <View style={styles.buttons}>
                <Pressable
                  onPress={() => onGoing(going === 'in' ? null : 'in')}
                  accessibilityRole="button"
                  accessibilityLabel={going === 'in' ? "You're in. Tap to take it back" : "I'm in"}
                  accessibilityState={{ selected: going === 'in' }}
                  style={({ pressed }) => [styles.button, going === 'in' ? styles.inChip : styles.ink, pressed && styles.pressed]}
                >
                  {going === 'in' ? <Ionicons name="checkmark" size={16} color={colors.success} /> : null}
                  <Text style={[styles.buttonText, going === 'in' ? styles.inText : styles.onDark]}>
                    {going === 'in' ? "You're in" : "I'm in"}
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => onGoing(going === 'out' ? null : 'out')}
                  accessibilityRole="button"
                  accessibilityLabel={going === 'out' ? 'You passed. Tap to take it back' : 'Pass'}
                  accessibilityState={{ selected: going === 'out' }}
                  style={({ pressed }) => [styles.button, going === 'out' ? styles.outChip : styles.grey, pressed && styles.pressed]}
                >
                  <Text style={[styles.buttonText, going === 'out' && styles.outText]}>
                    {going === 'out' ? 'Passed' : 'Pass'}
                  </Text>
                </Pressable>
              </View>
            )}
            <Text style={styles.note}>Going is your call. The vote only made the plan.</Text>
          </View>
        }
      >
        <Pressable
          onPress={onOpenPlan}
          onLongPress={onLongPress}
          disabled={!onOpenPlan}
          accessibilityRole={onOpenPlan ? 'button' : undefined}
          accessibilityLabel={`Plan made: ${event.title}. ${line}. ${vote.yes} of ${deciding} said yes${onOpenPlan ? '. Open the plan' : ''}`}
          style={({ pressed }) => pressed && styles.pressed}
        >
          <View style={styles.kickerRow}>
            <Ionicons name="checkmark-circle" size={13} color={colors.success} />
            <Text style={[styles.kicker, styles.kickerGreen]}>Plan made · on the line</Text>
          </View>
          <Text style={[styles.title, styles.titleRoom]} numberOfLines={2}>
            {event.title}
          </Text>
          {line ? <Text style={styles.line} numberOfLines={2}>{line}</Text> : null}
          <Text style={styles.by}>{`${vote.yes} of ${deciding} said yes`}</Text>
        </Pressable>
        <Stamp label="PASSED" animate={justPassed} />
      </Ticket>
    );
  }

  if (vote.status !== 'open') {
    const closed =
      vote.status === 'rejected' ? "Didn't pass" : vote.status === 'expired' ? 'Its day went by' : 'Called off';
    return (
      <Ticket style={styles.card} accessibilityLabel={`Vote on a plan: ${event.title}. ${closed}`}>
        <View style={styles.kickerRow}>
          <Ionicons name="ticket" size={13} color={colors.textSoft} />
          <Text style={[styles.kicker, styles.kickerSoft]}>{`Vote · ${closed}`}</Text>
        </View>
        <Text style={[styles.title, styles.titleClosed]} numberOfLines={2}>
          {event.title}
        </Text>
        {line ? <Text style={styles.line} numberOfLines={2}>{line}</Text> : null}
        <Text style={styles.by}>{`${vote.yes} yes · ${vote.no} no`}</Text>
      </Ticket>
    );
  }

  const answering = vote.myVote === null || changing;

  return (
    <Ticket
      tone="brand"
      style={styles.card}
      accessibilityLabel={`Vote on a new plan: ${event.title}. ${vote.yes} of ${deciding} said yes, needs ${needed}`}
      stub={
        <View>
          <View style={styles.tally} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            {Array.from({ length: deciding }, (_, i) => (
              <View
                key={i}
                style={[
                  styles.segment,
                  i < vote.yes ? styles.segmentYes : i < vote.yes + vote.no ? styles.segmentNo : null,
                ]}
              />
            ))}
          </View>
          <View style={styles.countRow}>
            <Text style={styles.countOnBrand}>{`${vote.yes} of ${deciding} yes`}</Text>
            <Text style={styles.countOnBrand}>{`needs ${needed}`}</Text>
          </View>
          {busy ? (
            <ActivityIndicator color={colors.onInk} style={styles.spinner} />
          ) : answering ? (
            <View style={styles.buttons}>
              <Pressable
                onPress={() => {
                  setChanging(false);
                  onVote(true);
                }}
                accessibilityRole="button"
                accessibilityLabel={`Yes to ${event.title}`}
                accessibilityState={{ selected: vote.myVote === true }}
                style={({ pressed }) => [styles.button, styles.strong, pressed && styles.pressed]}
              >
                <Ionicons name="checkmark" size={16} color={colors.primary} />
                <Text style={[styles.buttonText, styles.strongText]}>Yes</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  setChanging(false);
                  onVote(false);
                }}
                accessibilityRole="button"
                accessibilityLabel={`No to ${event.title}`}
                accessibilityState={{ selected: vote.myVote === false }}
                style={({ pressed }) => [styles.button, styles.soft, pressed && styles.pressed]}
              >
                <Text style={[styles.buttonText, styles.onDark]}>No</Text>
              </Pressable>
            </View>
          ) : (
            <View style={styles.voted}>
              <Ionicons name={vote.myVote ? 'checkmark-circle' : 'close-circle'} size={18} color={colors.onInk} />
              <Text style={styles.votedText}>{vote.myVote ? 'You said yes' : 'You said no'}</Text>
              <Pressable
                onPress={() => setChanging(true)}
                accessibilityRole="button"
                accessibilityLabel="Change your vote"
                hitSlop={6}
                style={({ pressed }) => [styles.change, pressed && styles.pressed]}
              >
                <Text style={styles.changeText}>Change</Text>
              </Pressable>
            </View>
          )}
        </View>
      }
    >
      <View style={styles.kickerRow}>
        <Ionicons name="ticket" size={13} color={ON_BRAND_SOFT} />
        <Text style={[styles.kicker, styles.kickerOnBrand]}>Vote · new plan</Text>
      </View>
      <Text style={[styles.title, styles.onDark]} numberOfLines={2}>
        {event.title}
      </Text>
      {line ? <Text style={[styles.line, styles.lineOnBrand]} numberOfLines={2}>{line}</Text> : null}
      <Text style={[styles.by, styles.byOnBrand]}>{wants}</Text>
    </Ticket>
  );
}

function PollCard({ vote, members, people, userId, busy, onPick }: ChatVoteCardProps) {
  if (vote.target.type !== 'poll') return null;

  const poll = vote.target;
  const deciding = Math.max(1, members);
  const needed = votesNeeded(deciding);
  const open = vote.status === 'open';
  const asker = askerOf(vote, userId);
  const byId = new Map(people.map((person) => [person.id, person]));
  const status =
    vote.status === 'passed' ? 'decided' : vote.status === 'open' ? `${needed} picks win` : 'no winner';

  return (
    <Ticket
      style={styles.card}
      accessibilityLabel={`Question from ${asker}: ${vote.targetName}`}
      stub={
        <View>
          {poll.options.map((option) => {
            const mine = poll.myOption === option.id;
            const winner = poll.winnerId === option.id;
            const faces = vote.ballots
              .filter((ballot) => ballot.optionId === option.id)
              .map((ballot) => byId.get(ballot.userId))
              .filter((person): person is Person => !!person);
            const share = Math.min(1, option.votes / deciding);

            return (
              <Pressable
                key={option.id}
                onPress={() => onPick(option.id)}
                disabled={!open || busy}
                accessibilityRole="button"
                accessibilityLabel={`${option.label}, ${option.votes} picked${winner ? ', the answer' : ''}`}
                accessibilityState={{ selected: mine, disabled: !open || busy }}
                style={({ pressed }) => [styles.option, (mine || winner) && styles.optionMine, pressed && styles.pressed]}
              >
                <View style={[styles.fill, { width: `${Math.round(share * 100)}%` }]} />
                <View style={[styles.check, mine && styles.checkMine]}>
                  {mine ? <Ionicons name="checkmark" size={12} color={colors.onInk} /> : null}
                </View>
                <Text style={styles.optionLabel} numberOfLines={2}>
                  {option.label}
                </Text>
                {winner ? <Ionicons name="trophy" size={13} color={colors.primary} /> : null}
                <View style={styles.faces}>
                  {faces.slice(0, 3).map((person, index) => (
                    <Monogram
                      key={person.id}
                      name={person.name}
                      uri={person.avatarUrl}
                      size={18}
                      ring={1.5}
                      style={index > 0 ? styles.faceOverlap : undefined}
                    />
                  ))}
                </View>
                <Text style={styles.optionCount}>{option.votes}</Text>
              </Pressable>
            );
          })}
          {busy ? <ActivityIndicator color={colors.primary} style={styles.pollSpinner} /> : null}
          <View style={[styles.countRow, styles.pollCount]}>
            <Text style={styles.count}>{`${vote.voted} of ${deciding} answered`}</Text>
            <Text style={styles.count}>{status}</Text>
          </View>
        </View>
      }
    >
      <View style={styles.kickerRow}>
        <Ionicons name="help-circle" size={13} color={colors.primary} />
        <Text style={styles.kicker} numberOfLines={1}>{`Ask the parea · ${asker}`}</Text>
      </View>
      <Text style={styles.title} numberOfLines={3}>
        {vote.targetName}
      </Text>
    </Ticket>
  );
}

// "PASSED", pressed on at an angle.
function Stamp({ label, animate }: { label: string; animate: boolean }) {
  const land = useRef(new Animated.Value(animate ? 0 : 1)).current;

  useEffect(() => {
    if (!animate) return;
    Animated.timing(land, {
      toValue: 1,
      duration: 320,
      easing: Easing.out(Easing.back(2)),
      useNativeDriver: Platform.OS !== 'web',
    }).start();
  }, [animate, land]);

  return (
    <Animated.View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        styles.stamp,
        {
          opacity: land,
          transform: [
            { rotate: '-8deg' },
            { scale: land.interpolate({ inputRange: [0, 1], outputRange: [2.2, 1] }) },
          ],
        },
      ]}
    >
      <Text style={styles.stampText}>{label}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: { width: CARD_WIDTH },
  pressed: { opacity: 0.8 },
  spinner: { height: 44 },
  pollSpinner: { marginVertical: space.xxs },

  kickerRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  kicker: {
    flexShrink: 1,
    color: colors.primary,
    ...typo.mono,
    fontSize: textSize.micro,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  kickerOnBrand: { color: ON_BRAND_SOFT },
  kickerGreen: { color: colors.success },
  kickerSoft: { color: colors.textSoft },
  title: {
    marginTop: 6,
    marginBottom: 4,
    color: colors.text,
    ...typo.display,
    fontSize: 18,
    lineHeight: 21,
    letterSpacing: -0.5,
  },
  // Room for the stamp on the right.
  titleRoom: { marginRight: 72 },
  titleClosed: { color: colors.textSoft },
  onDark: { color: colors.onInk },
  line: {
    color: colors.textSoft,
    ...typo.mono,
    fontSize: textSize.caption,
    lineHeight: 15,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  lineOnBrand: { color: ON_BRAND_SOFT },
  by: { marginTop: 6, color: colors.textSoft, ...typo.semi, fontSize: 12.5 },
  byOnBrand: { color: ON_BRAND_SOFT },

  tally: { flexDirection: 'row', gap: 4, marginBottom: space.xs + 2 },
  segment: { flex: 1, height: 6, borderRadius: 3, backgroundColor: ON_BRAND_FAINT },
  segmentYes: { backgroundColor: colors.onInk },
  segmentNo: { backgroundColor: colors.danger },
  countRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: space.sm },
  countOnBrand: {
    color: ON_BRAND_SOFT,
    ...typo.mono,
    fontSize: 10.5,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  count: {
    color: colors.textSoft,
    ...typo.mono,
    fontSize: 10.5,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  pollCount: { marginTop: space.xxs, marginBottom: 0 },

  stubBody: { gap: space.xs + 2 },
  buttons: { flexDirection: 'row', gap: space.xs + 2 },
  button: {
    flex: 1,
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: radius.sm + 2,
  },
  buttonText: { color: colors.ink, ...typo.display, fontSize: textSize.base },
  strong: { backgroundColor: colors.surface },
  strongText: { color: colors.primary },
  soft: { backgroundColor: 'rgba(255,255,255,0.14)' },
  ink: { backgroundColor: colors.ink },
  grey: { backgroundColor: colors.surfaceAlt },
  inChip: { backgroundColor: tint.success },
  inText: { color: colors.success },
  outChip: { backgroundColor: tint.danger },
  outText: { color: colors.danger },
  note: { color: colors.textSoft, ...typo.medium, fontSize: textSize.small },

  voted: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs + 2,
    paddingLeft: 12,
    borderRadius: radius.sm + 2,
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  votedText: { flex: 1, color: colors.onInk, ...typo.bold, fontSize: 13.5 },
  change: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 12 },
  changeText: {
    color: ON_BRAND_SOFT,
    ...typo.mono,
    fontSize: 10.5,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },

  stamp: {
    position: 'absolute',
    top: space.md,
    right: 12,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderWidth: 2,
    borderColor: colors.success,
    borderRadius: 6,
    backgroundColor: tint.success,
  },
  stampText: { color: colors.success, ...typo.display, fontSize: textSize.caption, letterSpacing: 1.5 },

  option: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    marginBottom: 6,
    borderRadius: radius.sm + 2,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  optionMine: { borderColor: colors.primary },
  fill: { position: 'absolute', left: 0, top: 0, bottom: 0, backgroundColor: paper.accentSoft },
  check: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkMine: { backgroundColor: colors.primary, borderColor: colors.primary },
  optionLabel: { flex: 1, minWidth: 0, color: colors.ink, ...typo.bold, fontSize: textSize.base },
  faces: { flexDirection: 'row' },
  faceOverlap: { marginLeft: -5 },
  optionCount: { color: colors.textSoft, ...typo.mono, fontSize: textSize.caption, minWidth: 10, textAlign: 'right' },
});
