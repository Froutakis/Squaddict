import { useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import type { SquadVote, VoteEvent } from '../../services/serviceVotes';
import type { SheetEvent } from '../events/EventSheet';
import { outcomeLabel, voteProgress, voteQuestion } from '../../lib/squadVote';
import { formatDateTime } from '../../lib/datetime';
import { placeLines } from '../../lib/place';
import Monogram from '../general/Monogram';
import { colors, radius, shadow, space, textSize, typo } from '../../theme';

const THUMB = 40;

type VoteCardProps = {
  vote: SquadVote;
  // How many members the squad has: a vote needs more than half of them.
  members: number;
  userId: string;
  busy?: boolean;
  onYes?: () => void;
  onNo?: () => void;
  onCancel?: () => void;
  onOpen: () => void;
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
    isMember: false,
  };
}

// One vote: what it asks, who asked, the count, and Yes / No while it is open.
export default function VoteCard({ vote, members, userId, busy = false, onYes, onNo, onCancel, onOpen }: VoteCardProps) {
  const [coverFailed, setCoverFailed] = useState(false);
  const open = vote.status === 'open';
  const mine = vote.proposedBy === userId;
  const by = mine ? 'You' : vote.proposerName ?? 'Someone';
  const question = voteQuestion(vote.kind, vote.targetName);
  const event = vote.target.type === 'event' ? vote.target.event : null;
  const cover = event && !coverFailed ? event.coverUrl : null;
  const where = event ? placeLines(event.location, event.placeLabel).primary : '';
  const meta = open
    ? `${by} asked · ${voteProgress(vote.yes, vote.no, members)}`
    : `${outcomeLabel(vote.status)} · ${by} asked`;

  return (
    <View style={[styles.card, !open && styles.decided]}>
      <Pressable
        onPress={onOpen}
        accessibilityRole="button"
        accessibilityLabel={`Open ${vote.targetName}`}
        style={({ pressed }) => [styles.head, pressed && styles.pressed]}
      >
        {cover ? (
          <Image source={{ uri: cover }} style={styles.cover} onError={() => setCoverFailed(true)} />
        ) : (
          <Monogram
            name={vote.targetName}
            uri={vote.target.type === 'squad' ? vote.target.group.avatarUrl : null}
            size={THUMB}
            square={event !== null}
          />
        )}
        <View style={styles.text}>
          <Text style={styles.question} numberOfLines={1}>
            {question}
          </Text>
          {event ? (
            <Text style={styles.when} numberOfLines={1}>
              {[formatDateTime(event.date, event.startTime), where].filter(Boolean).join(' · ')}
            </Text>
          ) : null}
          <Text style={styles.meta} numberOfLines={1}>
            {meta}
          </Text>
        </View>
      </Pressable>

      {open && onYes && onNo ? (
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
  cover: { width: THUMB, height: THUMB, borderRadius: radius.sm, backgroundColor: colors.surfaceAlt },
  text: { flex: 1, minWidth: 0, gap: 2 },
  question: { color: colors.text, ...typo.semi, fontSize: textSize.lead },
  when: { color: colors.textSoft, ...typo.mono, fontSize: textSize.caption },
  meta: { color: colors.textSoft, ...typo.medium, fontSize: textSize.small },
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
  cancel: { alignSelf: 'center', minHeight: 32, justifyContent: 'center', paddingHorizontal: space.sm },
  cancelText: { color: colors.textSoft, ...typo.semi, fontSize: textSize.small },
  pressed: { opacity: 0.6 },
});
