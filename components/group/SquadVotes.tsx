import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { Group } from '../../services/serviceGroup';
import { cancelVote, castVote, type FollowVote } from '../../services/serviceFollow';
import { voteProgress, voteQuestion } from '../../lib/followVote';
import Monogram from '../general/Monogram';
import { colors, radius, shadow, space, textSize, typo } from '../../theme';

type SquadVotesProps = {
  votes: FollowVote[];
  // How many members the squad has: a vote needs more than half of them.
  members: number;
  userId: string;
  onOpen: (group: Group) => void;
  onChanged: () => void;
};

// The follows this squad is still deciding on. Shows nothing when there are none.
export default function SquadVotes({ votes, members, userId, onOpen, onChanged }: SquadVotesProps) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (votes.length === 0) return null;

  async function run(voteId: string, action: () => Promise<unknown>) {
    if (busy) return;
    setBusy(voteId);
    setError(null);

    try {
      await action();
      onChanged();
    } catch {
      setError('Could not save that. Try again.');
    } finally {
      setBusy(null);
    }
  }

  return (
    <View style={styles.wrap}>
      <Text style={styles.summary}>OPEN VOTES {votes.length}</Text>

      {votes.map(function (vote) {
        const saving = busy === vote.id;
        const mine = vote.proposedBy === userId;
        const by = mine ? 'You' : vote.proposerName ?? 'Someone';

        return (
          <View key={vote.id} style={styles.card}>
            <Pressable
              onPress={() => onOpen(vote.target)}
              accessibilityRole="button"
              accessibilityLabel={`Open ${vote.target.name}`}
              style={({ pressed }) => [styles.head, pressed && styles.pressed]}
            >
              <Monogram name={vote.target.name} uri={vote.target.avatarUrl} size={40} />
              <View style={styles.text}>
                <Text style={styles.question} numberOfLines={1}>
                  {voteQuestion(vote.action, vote.target.name)}
                </Text>
                <Text style={styles.meta} numberOfLines={1}>
                  {by} asked · {voteProgress(vote.yes, vote.no, members)}
                </Text>
              </View>
            </Pressable>

            <View style={styles.buttons}>
              <Pressable
                onPress={() => run(vote.id, () => castVote(vote.id, true))}
                disabled={saving || vote.myVote === true}
                accessibilityRole="button"
                accessibilityLabel={`Vote yes: ${voteQuestion(vote.action, vote.target.name)}`}
                accessibilityState={{ selected: vote.myVote === true, disabled: saving }}
                style={({ pressed }) => [
                  styles.button,
                  vote.myVote === true && styles.buttonChosen,
                  (pressed || saving) && styles.pressed,
                ]}
              >
                <Text style={[styles.buttonText, vote.myVote === true && styles.buttonChosenText]}>Yes</Text>
              </Pressable>

              <Pressable
                onPress={() => run(vote.id, () => castVote(vote.id, false))}
                disabled={saving || vote.myVote === false}
                accessibilityRole="button"
                accessibilityLabel={`Vote no: ${voteQuestion(vote.action, vote.target.name)}`}
                accessibilityState={{ selected: vote.myVote === false, disabled: saving }}
                style={({ pressed }) => [
                  styles.button,
                  vote.myVote === false && styles.buttonChosen,
                  (pressed || saving) && styles.pressed,
                ]}
              >
                <Text style={[styles.buttonText, vote.myVote === false && styles.buttonChosenText]}>No</Text>
              </Pressable>
            </View>

            {mine ? (
              <Pressable
                onPress={() => run(vote.id, () => cancelVote(vote.id))}
                disabled={saving}
                accessibilityRole="button"
                accessibilityLabel="Cancel this vote"
                style={({ pressed }) => [styles.cancel, pressed && styles.pressed]}
              >
                <Text style={styles.cancelText}>Cancel vote</Text>
              </Pressable>
            ) : null}
          </View>
        );
      })}

      {error ? (
        <Text style={styles.error} accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.sm },
  summary: { color: colors.textFaint, ...typo.mono, fontSize: textSize.caption, letterSpacing: 1.2 },
  card: {
    gap: space.sm,
    padding: space.md,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    ...shadow.card,
  },
  head: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  text: { flex: 1, minWidth: 0, gap: 2 },
  question: { color: colors.text, ...typo.semi, fontSize: textSize.lead },
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
  error: { color: colors.danger, ...typo.medium, fontSize: textSize.body },
});
