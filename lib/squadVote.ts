// What a squad decides together goes to a vote: following other squads and
// going to their public plans. The database applies the same majority rule
// (resolve_proposal); this copy is for what the screen says.

export type VoteKind = 'follow' | 'unfollow' | 'attend' | 'unattend';
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

export function voteQuestion(kind: VoteKind, targetName: string): string {
  if (kind === 'follow') return `Follow ${targetName}?`;
  if (kind === 'unfollow') return `Unfollow ${targetName}?`;
  if (kind === 'attend') return `Go to ${targetName}?`;
  return `Skip ${targetName}?`;
}

export function voteProgress(yes: number, no: number, members: number): string {
  const needed = votesNeeded(members);
  const parts = [`${yes} of ${needed} yes`];
  if (no > 0) parts.push(`${no} no`);
  return parts.join(' · ');
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
