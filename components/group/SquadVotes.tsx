import { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { Group } from '../../services/serviceGroup';
import { cancelVote, castOption, castVote, type SquadVote, type VoteEvent } from '../../services/serviceVotes';
import { errorText } from '../../lib/postgres';
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
  // Every vote, and starting a new one, live on the Votes page.
  onOpenVotes: () => void;
};

// What this squad is still deciding on about follows, to answer in place.
// Shows nothing when there is nothing.
export default function SquadVotes({ votes, members, userId, onOpenSquad, onOpenEvent, onChanged, onOpenVotes }: SquadVotesProps) {
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
    } catch (problem) {
      setError(errorText(problem, 'Could not save that. Try again.'));
    } finally {
      setBusy(null);
    }
  }

  return (
    <View style={styles.wrap}>
      <View style={styles.head}>
        <Text style={styles.summary}>OPEN VOTES {votes.length}</Text>
        <Pressable
          onPress={onOpenVotes}
          accessibilityRole="button"
          accessibilityLabel="See all votes"
          style={({ pressed }) => [styles.all, pressed && styles.pressed]}
        >
          <Text style={styles.allText}>All votes</Text>
          <Ionicons name="chevron-forward" size={14} color={colors.primary} />
        </Pressable>
      </View>

      {votes.map((vote) => (
        <VoteCard
          key={vote.id}
          vote={vote}
          members={members}
          userId={userId}
          busy={busy === vote.id}
          onYes={() => run(vote.id, () => castVote(vote.id, true))}
          onNo={() => run(vote.id, () => castVote(vote.id, false))}
          onPick={(optionId) => run(vote.id, () => castOption(vote.id, optionId))}
          onCancel={() => run(vote.id, () => cancelVote(vote.id))}
          onOpen={() => {
            if (vote.target.type === 'squad') onOpenSquad(vote.target.group);
            else if (vote.target.type === 'plan' && vote.target.created) onOpenEvent(vote.target.event);
          }}
          onStale={onChanged}
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
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  summary: { color: colors.textFaint, ...typo.mono, fontSize: textSize.caption, letterSpacing: 1.2 },
  all: { flexDirection: 'row', alignItems: 'center', gap: 2, minHeight: 44, paddingLeft: space.sm },
  allText: { color: colors.primary, ...typo.semi, fontSize: textSize.body },
  pressed: { opacity: 0.6 },
  error: { color: colors.danger, ...typo.medium, fontSize: textSize.body },
});
