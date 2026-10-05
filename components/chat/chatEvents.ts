import type { MyEvent } from '../../services/serviceEvents';
import type { FeedPhoto } from '../../services/servicePhotoFeed';
import type { SquadVote } from '../../services/serviceVotes';

// What the parea did besides talking, shown in the chat where it happened: a
// plan when it was made, a vote when it was asked (or just decided), new
// photos of a night when they were added. Read from the plans, votes and
// memories themselves, nothing is stored for the chat.
export type ChatEventItem =
  | { kind: 'plan'; id: string; at: string; plan: MyEvent }
  | { kind: 'vote'; id: string; at: string; vote: SquadVote }
  | { kind: 'memory'; id: string; at: string; memory: FeedPhoto };

// A few, so the chat stays a chat.
const PLANS_SHOWN = 3;
const OPEN_VOTES_SHOWN = 3;
const DECIDED_SHOWN = 2;
const MEMORIES_SHOWN = 2;
const DAY_MS = 24 * 60 * 60 * 1000;
// A decided vote is news for a couple of days, new photos for two weeks.
const DECIDED_FRESH_MS = 2 * DAY_MS;
const MEMORY_FRESH_MS = 14 * DAY_MS;

type PickInput = {
  groupId: string;
  plans: MyEvent[];
  openVotes: SquadVote[];
  decidedVotes: SquadVote[];
  memories: FeedPhoto[];
  // The oldest message loaded, while older ones are still to load: nothing
  // from before it shows yet. Null once the whole chat is here.
  since: string | null;
  now: Date;
  // keyOf(now).
  today: string;
};

export function pickChatEvents({
  groupId,
  plans,
  openVotes,
  decidedVotes,
  memories,
  since,
  now,
  today,
}: PickInput): ChatEventItem[] {
  const inWindow = (at: string | null | undefined): at is string => !!at && (since === null || at >= since);
  const newestFirst = (a: string, b: string) => (a < b ? 1 : a > b ? -1 : 0);

  // The parea's own plans still ahead (not another parea's you said yes to).
  const planItems: ChatEventItem[] = plans
    .filter((plan) => plan.groupId === groupId && plan.date >= today && inWindow(plan.createdAt))
    .sort((a, b) => newestFirst(a.createdAt ?? '', b.createdAt ?? ''))
    .slice(0, PLANS_SHOWN)
    .map((plan) => ({ kind: 'plan', id: `plan-${plan.id}`, at: plan.createdAt as string, plan }));
  const shownPlans = new Set(planItems.map((item) => (item.kind === 'plan' ? item.plan.id : '')));

  const openItems: ChatEventItem[] = openVotes
    .filter((vote) => vote.groupId === groupId && vote.status === 'open' && inWindow(vote.createdAt))
    .sort((a, b) => newestFirst(a.createdAt, b.createdAt))
    .slice(0, OPEN_VOTES_SHOWN)
    .map((vote) => ({ kind: 'vote', id: `vote-${vote.id}`, at: vote.createdAt, vote }));

  // A plan vote that passed is the plan itself by now: the plan shows instead.
  const decidedItems: ChatEventItem[] = decidedVotes
    .filter(
      (vote) =>
        vote.groupId === groupId &&
        vote.status !== 'open' &&
        inWindow(vote.closedAt) &&
        now.getTime() - new Date(vote.closedAt as string).getTime() <= DECIDED_FRESH_MS &&
        !(vote.target.type === 'plan' && shownPlans.has(vote.target.event.id)),
    )
    .sort((a, b) => newestFirst(a.closedAt ?? '', b.closedAt ?? ''))
    .slice(0, DECIDED_SHOWN)
    .map((vote) => ({ kind: 'vote', id: `vote-${vote.id}`, at: vote.closedAt as string, vote }));

  const memoryItems: ChatEventItem[] = memories
    .filter(
      (memory) =>
        memory.reason === 'yours' &&
        memory.group.id === groupId &&
        inWindow(memory.photo.createdAt) &&
        now.getTime() - new Date(memory.photo.createdAt).getTime() <= MEMORY_FRESH_MS,
    )
    .sort((a, b) => newestFirst(a.photo.createdAt, b.photo.createdAt))
    .slice(0, MEMORIES_SHOWN)
    .map((memory) => ({ kind: 'memory', id: `memory-${memory.event.id}`, at: memory.photo.createdAt, memory }));

  return [...planItems, ...openItems, ...decidedItems, ...memoryItems];
}
