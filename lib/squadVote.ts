// What a squad decides together goes to a vote: following other squads, going
// to their public plans, a question of its own, who is in, and its name, photo
// and public memories. The database applies the same rules (resolve_proposal);
// this copy is for what the screen says.

export type VoteKind =
  | 'follow'
  | 'unfollow'
  | 'attend'
  | 'unattend'
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
  if (kind === 'unattend') return voted ? `Skip vote · ${tally}` : `Vote to skip · ${tally}`;
  return voted ? `Vote open · ${tally}` : `Vote yes · ${tally}`;
}

// targetName is what the vote is about: the squad, plan or member, the friend
// to invite, the new name, the question itself, the squad (for a photo), or
// 'public' / 'private' (for the memories).
export function voteQuestion(kind: VoteKind, targetName: string): string {
  switch (kind) {
    case 'follow':
      return `Follow ${targetName}?`;
    case 'unfollow':
      return `Unfollow ${targetName}?`;
    case 'attend':
      return `Go to ${targetName}?`;
    case 'unattend':
      return `Skip ${targetName}?`;
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

export type SquadRef = { id: string; name: string; memberCount: number };
export type OpenPlanVote = { kind: VoteKind; myVote: boolean | null; yes: number };

export type PlanStance =
  // Answer in / out yourself. `via` names the squad of yours that is going
  // (null on your own squad's plan); `skipLabel` is set when the acting squad
  // is the one going, so it can vote to skip.
  | { kind: 'rsvp'; via: string | null; skipLabel: string | null; skipWaiting: boolean }
  | { kind: 'propose'; label: string }
  | { kind: 'vote'; label: string; waiting: boolean }
  | { kind: 'no-squad'; text: string };

export const NO_SQUAD_TEXT = 'Join a squad to go to public plans';

// What a member can do on a plan: answer it (their squad's own plan, or one a
// squad of theirs is going to), or put it to the acting squad's vote.
export function planStance(input: {
  hostGroupId: string;
  myGroups: SquadRef[];
  acting: SquadRef | null;
  goingGroupIds: string[];
  // The acting squad's open vote on this plan, of either kind.
  vote: OpenPlanVote | null;
}): PlanStance {
  const { hostGroupId, myGroups, acting, goingGroupIds, vote } = input;

  if (myGroups.some((group) => group.id === hostGroupId)) {
    return { kind: 'rsvp', via: null, skipLabel: null, skipWaiting: false };
  }

  const going = myGroups.filter((group) => goingGroupIds.includes(group.id));
  if (going.length > 0) {
    const actingGoing = acting !== null && going.some((group) => group.id === acting.id);
    if (!acting || !actingGoing) {
      return { kind: 'rsvp', via: going[0].name, skipLabel: null, skipWaiting: false };
    }

    const skip = vote && vote.kind === 'unattend' ? vote : null;
    return {
      kind: 'rsvp',
      via: acting.name,
      skipLabel: skip ? voteButtonLabel('unattend', skip.myVote, skip.yes, acting.memberCount) : 'Vote to skip',
      skipWaiting: skip?.myVote === true,
    };
  }

  if (!acting) return { kind: 'no-squad', text: NO_SQUAD_TEXT };

  if (vote && vote.kind === 'attend') {
    return {
      kind: 'vote',
      label: voteButtonLabel('attend', vote.myVote, vote.yes, acting.memberCount),
      waiting: vote.myVote === true,
    };
  }

  return { kind: 'propose', label: `Go with ${acting.name}?` };
}

// A squad's plans in Home and its calendar: the ones it hosts and the public
// plans of other squads it voted to go to.
export function isSquadPlan(event: { groupId: string; withGroupIds?: string[] }, squadId: string): boolean {
  return event.groupId === squadId || (event.withGroupIds ?? []).includes(squadId);
}
