import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { Group } from '../../services/serviceGroup';
import { cancelVote, castVote, type SquadVote, type VoteEvent } from '../../services/serviceVotes';
import VoteCard from '../votes/VoteCard';
import { colors, space, textSize, typo } from '../../theme';

type SquadVotesProps = {
  votes: SquadVote[];
  // How many members the squad has: a vote needs more than half of them.
  members: number;
  userId: string;
  onOpenSquad: (group: Group) => void;
  onOpenEvent: (event: VoteEvent) => void;
  onChanged: () => void;
};

// What this squad is still deciding on. Shows nothing when there is nothing.
export default function SquadVotes({ votes, members, userId, onOpenSquad, onOpenEvent, onChanged }: SquadVotesProps) {
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

      {votes.map((vote) => (
        <VoteCard
          key={vote.id}
          vote={vote}
          members={members}
          userId={userId}
          busy={busy === vote.id}
          onYes={() => run(vote.id, () => castVote(vote.id, true))}
          onNo={() => run(vote.id, () => castVote(vote.id, false))}
          onCancel={() => run(vote.id, () => cancelVote(vote.id))}
          onOpen={() => (vote.target.type === 'squad' ? onOpenSquad(vote.target.group) : onOpenEvent(vote.target.event))}
        />
      ))}

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
  error: { color: colors.danger, ...typo.medium, fontSize: textSize.body },
});
