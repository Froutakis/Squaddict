import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { SquadVote, VoteEvent } from '../../services/serviceVotes';
import type { SheetEvent } from '../events/EventSheet';
import {
  inviteExpiry,
  membersWhoVote,
  outcomeLabel,
  pollProgress,
  voteProgress,
  voteQuestion,
} from '../../lib/squadVote';
import { formatDateTime } from '../../lib/datetime';
import { placeLines } from '../../lib/place';
import Monogram from '../general/Monogram';
import { useInviteShare } from './VoteTicket';
import { colors, radius, shadow, space, textSize, tint, typo } from '../../theme';

const THUMB = 40;

type VoteCardProps = {
  vote: SquadVote;
  // How many members the squad has: a vote needs more than half of them.
  members: number;
  userId: string;
  busy?: boolean;
  onYes?: () => void;
  onNo?: () => void;
  // A choice on a question.
  onPick?: (optionId: string) => void;
  onCancel?: () => void;
  // Opens the squad or plan a vote is about.
  onOpen?: () => void;
  // Something moved under the card (an invite got used): load again.
  onStale?: () => void;
};

export function voteEventToSheet(event: VoteEvent): SheetEvent {
  return {
    id: event.id,
    groupId: event.groupId,
    isPublic: event.isPublic,
    groupName: event.groupName,
    title: event.title,
    date: event.date,
    startTime: event.startTime,
    location: event.location,
    placeLabel: event.placeLabel,
    lat: event.lat,
    lng: event.lng,
    // A plan vote's plan is made in the parea that voted.
    isMember: true,
  };
}

// The icon for votes that are about the squad itself, not a squad, plan or person.
function iconFor(vote: SquadVote): keyof typeof Ionicons.glyphMap {
  if (vote.kind === 'poll') return 'help';
  if (vote.kind === 'invite') return 'person-add-outline';
  if (vote.kind === 'rename') return 'text-outline';
  if (vote.kind === 'memories') return vote.payload.public ? 'lock-open-outline' : 'lock-closed-outline';
  return 'image-outline';
}

// One vote: what it asks, who asked, the count, and Yes / No (or the choices
// of a question) while it is open.
export default function VoteCard({
  vote,
  members,
  userId,
  busy = false,
  onYes,
  onNo,
  onPick,
  onCancel,
  onOpen,
  onStale,
}: VoteCardProps) {
  // One tap: the phone's share sheet with the link (copied where there is none).
  const { share: shareLink, sharing, notice } = useInviteShare(vote, onStale);
  const open = vote.status === 'open';
  const mine = vote.proposedBy === userId;
  const by = mine ? 'You' : vote.proposerName ?? 'Someone';
  const question = voteQuestion(vote.kind, vote.targetName);
  const target = vote.target;
  const event = target.type === 'plan' ? target.event : null;
  const poll = target.type === 'poll' ? target : null;
  const link = target.type === 'invite' ? target.link : null;
  // The member a remove vote is about sees it, but does not vote on it.
  const aboutMe = target.type === 'user' && target.user.id === userId;
  const deciding = membersWhoVote(vote.kind, members);
  const where = event ? placeLines(event.location, event.placeLabel).primary : '';
  const opensTarget = onOpen !== undefined && (target.type === 'squad' || (target.type === 'plan' && target.created));

  // An unused link lasts a week.
  const expiry = link && !link.usedAt ? inviteExpiry(link.createdAt) : null;

  const progress = poll ? pollProgress(vote.voted, deciding) : voteProgress(vote.yes, vote.no, deciding);
  const outcome =
    poll && vote.status === 'rejected'
      ? 'No clear winner'
      : poll && vote.status === 'passed' && vote.payload.winner
        ? `Decided: ${vote.payload.winner}`
        : link && link.usedAt
          ? `Joined · ${link.usedByName ?? 'someone new'}`
          : expiry?.expired
            ? 'Invite expired'
            : outcomeLabel(vote.status);
  const asked = event ? `${by} ${mine ? 'want' : 'wants'} to throw a plan` : `${by} asked`;
  const meta = open ? `${asked} · ${progress}` : `${outcome} · ${asked}`;

  const thumb = target.type === 'squad' || target.type === 'plan' || target.type === 'user' ? (
    <Monogram
      name={vote.targetName}
      uri={target.type === 'squad' ? target.group.avatarUrl : target.type === 'user' ? target.user.avatarUrl : null}
      size={THUMB}
      square={event !== null}
    />
  ) : vote.kind === 'photo' && vote.payload.url ? (
    <Monogram name={vote.squadName} uri={vote.payload.url} size={THUMB} />
  ) : (
    <View style={styles.icon}>
      <Ionicons name={iconFor(vote)} size={20} color={colors.text} />
    </View>
  );

  const headText = (
    <View style={styles.text}>
      <Text style={styles.question} numberOfLines={poll ? 3 : 2}>
        {question}
      </Text>
      {event ? (
        <Text style={styles.when} numberOfLines={1}>
          {[formatDateTime(event.date, event.startTime), where].filter(Boolean).join(' · ')}
        </Text>
      ) : null}
      <Text style={styles.meta} numberOfLines={2}>
        {meta}
      </Text>
    </View>
  );

  // A passed invite whose link still waits to be sent stays bright.
  const waitingInvite = vote.status === 'passed' && expiry !== null && !expiry.expired;

  return (
    <View style={[styles.card, !open && !waitingInvite && styles.decided]}>
      {opensTarget ? (
        <Pressable
          onPress={onOpen}
          accessibilityRole="button"
          accessibilityLabel={`Open ${vote.targetName}`}
          style={({ pressed }) => [styles.head, pressed && styles.pressed]}
        >
          {thumb}
          {headText}
        </Pressable>
      ) : (
        <View style={styles.head} accessible accessibilityLabel={`${question} ${meta}`}>
          {thumb}
          {headText}
        </View>
      )}

      {poll ? (
        <View style={styles.options}>
          {poll.options.map((option) => {
            const chosen = poll.myOption === option.id;
            const won = poll.winnerId === option.id;
            const share = Math.min(1, option.votes / Math.max(1, deciding));
            const canPick = open && onPick !== undefined && !busy;
            return (
              <Pressable
                key={option.id}
                onPress={() => onPick?.(option.id)}
                disabled={!canPick || chosen}
                accessibilityRole={open ? 'button' : 'text'}
                accessibilityLabel={`${option.label}, ${option.votes} ${option.votes === 1 ? 'vote' : 'votes'}${
                  chosen ? ', your choice' : ''
                }${won ? ', the winner' : ''}`}
                accessibilityState={{ selected: chosen, disabled: !canPick }}
                style={({ pressed }) => [
                  styles.option,
                  (chosen || won) && styles.optionChosen,
                  pressed && styles.pressed,
                ]}
              >
                <View style={[styles.bar, { width: `${Math.round(share * 100)}%` }]} />
                {won ? <Ionicons name="trophy-outline" size={16} color={colors.text} /> : null}
                {chosen && !won ? <Ionicons name="checkmark-circle" size={16} color={colors.primary} /> : null}
                <Text style={[styles.optionText, (chosen || won) && styles.optionTextChosen]} numberOfLines={2}>
                  {option.label}
                </Text>
                <Text style={styles.optionCount}>{option.votes}</Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}

      {!poll && open && aboutMe ? (
        <Text style={styles.note}>This vote is about you, so you don't vote on it.</Text>
      ) : null}

      {!poll && open && !aboutMe && onYes && onNo ? (
        <View style={styles.buttons}>
          <Pressable
            onPress={onYes}
            disabled={busy || vote.myVote === true}
            accessibilityRole="button"
            accessibilityLabel={`Vote yes: ${question}`}
            accessibilityState={{ selected: vote.myVote === true, disabled: busy }}
            style={({ pressed }) => [
              styles.button,
              vote.myVote === true && styles.buttonChosen,
              (pressed || busy) && styles.pressed,
            ]}
          >
            <Text style={[styles.buttonText, vote.myVote === true && styles.buttonChosenText]}>Yes</Text>
          </Pressable>
          <Pressable
            onPress={onNo}
            disabled={busy || vote.myVote === false}
            accessibilityRole="button"
            accessibilityLabel={`Vote no: ${question}`}
            accessibilityState={{ selected: vote.myVote === false, disabled: busy }}
            style={({ pressed }) => [
              styles.button,
              vote.myVote === false && styles.buttonChosen,
              (pressed || busy) && styles.pressed,
            ]}
          >
            <Text style={[styles.buttonText, vote.myVote === false && styles.buttonChosenText]}>No</Text>
          </Pressable>
        </View>
      ) : null}

      {waitingInvite ? (
        <>
          <Pressable
            onPress={shareLink}
            disabled={sharing}
            accessibilityRole="button"
            accessibilityLabel={`Share the invite with ${vote.targetName}`}
            accessibilityHint="The link works once"
            style={({ pressed }) => [styles.share, (pressed || sharing) && styles.pressed]}
          >
            <Ionicons name="share-outline" size={17} color={colors.onInk} />
            <Text style={styles.shareText}>Share invite</Text>
          </Pressable>
          <Text style={styles.note}>
            {expiry?.label}. The link works once: send it to {vote.targetName} only.
          </Text>
        </>
      ) : null}

      {notice ? (
        <Text style={styles.note} accessibilityLiveRegion="polite">
          {notice}
        </Text>
      ) : null}

      {open && mine && onCancel ? (
        <Pressable
          onPress={onCancel}
          disabled={busy}
          accessibilityRole="button"
          accessibilityLabel="Cancel this vote"
          style={({ pressed }) => [styles.cancel, pressed && styles.pressed]}
        >
          <Text style={styles.cancelText}>Cancel vote</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: space.sm,
    padding: space.md,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    ...shadow.card,
  },
  decided: { opacity: 0.6 },
  head: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  icon: {
    width: THUMB,
    height: THUMB,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceAlt,
  },
  text: { flex: 1, minWidth: 0, gap: 2 },
  question: { color: colors.text, ...typo.semi, fontSize: textSize.lead },
  when: { color: colors.textSoft, ...typo.mono, fontSize: textSize.caption },
  meta: { color: colors.textSoft, ...typo.medium, fontSize: textSize.small },
  options: { gap: space.xs },
  option: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    paddingHorizontal: space.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  optionChosen: { borderColor: colors.primary },
  // How much of the squad picked it, drawn behind the label.
  bar: { position: 'absolute', top: 0, bottom: 0, left: 0, backgroundColor: tint.neutral },
  optionText: { flex: 1, color: colors.text, ...typo.medium, fontSize: textSize.base },
  optionTextChosen: { ...typo.semi },
  optionCount: { color: colors.text, ...typo.mono, fontSize: textSize.base },
  note: { color: colors.textSoft, ...typo.medium, fontSize: textSize.small },
  buttons: { flexDirection: 'row', gap: space.xs },
  button: {
    flex: 1,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  buttonChosen: { borderColor: colors.ink, backgroundColor: colors.ink },
  buttonText: { color: colors.text, ...typo.semi, fontSize: textSize.base },
  buttonChosenText: { color: colors.onInk },
  share: {
    height: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.xs,
    borderRadius: radius.md,
    backgroundColor: colors.ink,
  },
  shareText: { color: colors.onInk, ...typo.semi, fontSize: textSize.base },
  cancel: { alignSelf: 'center', minHeight: 44, justifyContent: 'center', paddingHorizontal: space.sm },
  cancelText: { color: colors.textSoft, ...typo.semi, fontSize: textSize.small },
  pressed: { opacity: 0.6 },
});
