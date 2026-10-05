// What a squad decides together goes to a vote: following other squads, a new
// plan, a question of its own, who is in, and its name, photo and public
// memories. Going to a plan is not one of them: each member answers that.
// The database applies the same rules (resolve_proposal); this copy is for
// what the screen says.

export type VoteKind =
  | 'follow'
  | 'unfollow'
  | 'plan'
  | 'poll'
  | 'invite'
  | 'remove'
  | 'rename'
  | 'photo'
  | 'memories';
export type VoteOutcome = 'open' | 'passed' | 'rejected';
export type VoteStatus = 'open' | 'passed' | 'rejected' | 'cancelled' | 'expired';

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

// What a vote button says while the vote is open.
export function voteButtonLabel(kind: VoteKind, myVote: boolean | null, yes: number, members: number): string {
  const tally = voteTally(yes, members);
  const voted = myVote === true;
  if (kind === 'unfollow') return voted ? `Unfollow vote · ${tally}` : `Vote to unfollow · ${tally}`;
  return voted ? `Vote open · ${tally}` : `Vote yes · ${tally}`;
}

// targetName is what the vote is about: the squad, the plan's title, the member, the friend
// to invite, the new name, the question itself, the squad (for a photo), or
// 'public' / 'private' (for the memories).
export function voteQuestion(kind: VoteKind, targetName: string): string {
  switch (kind) {
    case 'follow':
      return `Follow ${targetName}?`;
    case 'unfollow':
      return `Unfollow ${targetName}?`;
    case 'plan':
      return targetName;
    case 'poll':
      return targetName;
    case 'invite':
      return `Invite ${targetName}?`;
    case 'remove':
      return `Remove ${targetName}?`;
    case 'rename':
      return `Rename to "${targetName}"?`;
    case 'photo':
      return `New photo for ${targetName}?`;
    case 'memories':
      return targetName === 'public' ? 'Make memories public?' : 'Make memories private?';
  }
}

// Who decides: everyone, except the member a remove vote is about.
export function membersWhoVote(kind: VoteKind, members: number): number {
  return kind === 'remove' ? Math.max(1, members - 1) : Math.max(1, members);
}

// Pass membersWhoVote() as members, so a removal counts without its target.
export function voteProgress(yes: number, no: number, members: number): string {
  const needed = votesNeeded(members);
  const parts = [`${yes} of ${needed} yes`];
  if (no > 0) parts.push(`${no} no`);
  return parts.join(' · ');
}

export function pollProgress(voted: number, members: number): string {
  return `${voted} of ${Math.max(1, members)} answered`;
}

// A question: a choice wins with more than half of the members, or, once
// everyone has answered, the choice with the most votes. A tie decides
// nothing. counts follow the order of the choices; winner is an index into it.
export function pollOutcome(
  counts: number[],
  members: number,
  voted: number,
): { outcome: VoteOutcome; winner: number | null } {
  const all = Math.max(1, members);
  let top = -1;
  counts.forEach((count, index) => {
    if (top === -1 || count > counts[top]) top = index;
  });
  if (top === -1) return { outcome: voted >= all ? 'rejected' : 'open', winner: null };

  const second = Math.max(0, ...counts.filter((_, index) => index !== top));
  if (counts[top] * 2 > all || (voted >= all && counts[top] > second)) return { outcome: 'passed', winner: top };
  if (voted >= all) return { outcome: 'rejected', winner: null };
  return { outcome: 'open', winner: null };
}

// An invite link lasts a week; join_squad refuses it after that.
export const INVITE_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;

export function inviteExpiry(createdAt: string, now: Date = new Date()): { expired: boolean; label: string } {
  const made = new Date(createdAt).getTime();
  if (Number.isNaN(made)) return { expired: false, label: '' };
  const left = made + INVITE_DAYS * DAY_MS - now.getTime();
  if (left <= 0) return { expired: true, label: 'Expired' };
  const days = Math.ceil(left / DAY_MS);
  return { expired: false, label: `Expires in ${days} ${days === 1 ? 'day' : 'days'}` };
}

const OUTCOME_LABELS: Record<VoteStatus, string> = {
  open: 'Open',
  passed: 'Passed',
  rejected: 'Rejected',
  cancelled: 'Cancelled',
  expired: 'Expired',
};

export function outcomeLabel(status: VoteStatus): string {
  return OUTCOME_LABELS[status];
}

// An open vote on a plan whose day has gone is over, even before the
// database gets round to closing it.
export function effectiveStatus(status: VoteStatus, eventDate: string | null, today: string): VoteStatus {
  if (status === 'open' && eventDate !== null && eventDate < today) return 'expired';
  return status;
}

// A squad's plans in Home and its calendar: the ones it hosts, and the public
// plans of other pareas you said you're in to (withGroupIds, see getMyEvents).
export function isSquadPlan(event: { groupId: string; withGroupIds?: string[] }, squadId: string): boolean {
  return event.groupId === squadId || (event.withGroupIds ?? []).includes(squadId);
}
