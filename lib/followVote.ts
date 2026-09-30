// A squad follows or unfollows another only when most of its members agree.
// The database applies the same rule (resolve_follow_proposal); this copy is
// for what the screen says while a vote is open.

export type FollowAction = 'follow' | 'unfollow';
export type VoteOutcome = 'open' | 'passed' | 'rejected';

// More than half of the members: 1 of 1, 2 of 2, 2 of 3, 3 of 4, 3 of 5.
export function votesNeeded(members: number): number {
  return Math.floor(Math.max(1, members) / 2) + 1;
}

export function voteOutcome(yes: number, no: number, members: number): VoteOutcome {
  const needed = votesNeeded(members);
  if (yes >= needed) return 'passed';
  // Rejected as soon as the members left to vote cannot reach a majority.
  if (Math.max(1, members) - no < needed) return 'rejected';
  return 'open';
}

export function voteTally(yes: number, members: number): string {
  return `${yes}/${votesNeeded(members)}`;
}

// What the follow button says while a vote is open in the acting squad.
export function voteButtonLabel(
  action: FollowAction,
  myVote: boolean | null,
  yes: number,
  members: number,
): string {
  const tally = voteTally(yes, members);
  if (myVote === true) return action === 'follow' ? `Vote open · ${tally}` : `Unfollow vote · ${tally}`;
  return action === 'follow' ? `Vote yes · ${tally}` : `Vote to unfollow · ${tally}`;
}

export function voteQuestion(action: FollowAction, targetName: string): string {
  return action === 'follow' ? `Follow ${targetName}?` : `Unfollow ${targetName}?`;
}

export function voteProgress(yes: number, no: number, members: number): string {
  const needed = votesNeeded(members);
  const parts = [`${yes} of ${needed} yes`];
  if (no > 0) parts.push(`${no} no`);
  return parts.join(' · ');
}
