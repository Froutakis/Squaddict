import { getFollowing } from "./serviceFollow";
import { getFeed } from "./serviceFeed";
import { getCrossings } from "./serviceCrossed";
import { getSquadGoingPlans } from "./serviceVotes";
import { features } from "../lib/features";

// Things worth putting to a squad's vote, for a quiet Votes page: a public
// plan of a parea it follows, and a parea it keeps crossing on nights out.
// Built from what the app already reads; nothing here writes. Every part
// fails quietly: no ideas is a fine answer.

export type VoteIdea =
  | {
      kind: "attend";
      // Stable per plan, for "Not now".
      id: string;
      targetId: string;
      title: string;
      host: string;
      date: string;
      startTime?: string;
      place: string | null;
      going: number;
      why: string;
    }
  | {
      kind: "follow";
      id: string;
      targetId: string;
      name: string;
      avatarUrl: string | null;
      // The last night you crossed them.
      date: string;
      place: string | null;
      times: number;
      why: string;
    };

const PLAN_IDEAS = 2;
const FOLLOW_IDEAS = 1;

function crossedWhy(times: number): string {
  if (times <= 1) return "Crossed you lately";
  if (times === 2) return "Crossed you twice";
  return `Crossed you ${times} times`;
}

// The squad's open votes are left out by the screen, which has them already.
export async function getVoteIdeas(groupId: string): Promise<VoteIdea[]> {
  const following = await getFollowing(groupId).catch(() => []);
  const followed = new Set(following.map((one) => one.id));

  const [feed, going, crossings] = await Promise.all([
    following.length > 0
      ? getFeed({ groupIds: [...followed] }).catch(() => null)
      : Promise.resolve(null),
    getSquadGoingPlans(groupId).catch(() => []),
    features.squadFollows ? getCrossings(groupId) : Promise.resolve([]),
  ]);

  const already = new Set(going.map((plan) => plan.id));
  const plans: VoteIdea[] = (feed?.events ?? [])
    .filter((plan) => plan.groupId !== groupId && !already.has(plan.id))
    .sort((a, b) => (a.date + (a.startTime ?? "")).localeCompare(b.date + (b.startTime ?? "")))
    .slice(0, PLAN_IDEAS)
    .map((plan) => ({
      kind: "attend",
      id: `attend:${plan.id}`,
      targetId: plan.id,
      title: plan.title,
      host: plan.groupName,
      date: plan.date,
      startTime: plan.startTime,
      place: plan.placeLabel || plan.location || null,
      going: plan.goingCount,
      why: "A parea you follow",
    }));

  // One row per crossing night: keep each parea once, at its latest night.
  const seen = new Set<string>();
  const follows: VoteIdea[] = crossings
    .filter((one) => {
      if (one.otherGroupId === groupId || followed.has(one.otherGroupId) || seen.has(one.otherGroupId)) return false;
      seen.add(one.otherGroupId);
      return true;
    })
    .sort((a, b) => b.times - a.times || b.night.localeCompare(a.night))
    .slice(0, FOLLOW_IDEAS)
    .map((one) => ({
      kind: "follow",
      id: `follow:${one.otherGroupId}`,
      targetId: one.otherGroupId,
      name: one.otherName,
      avatarUrl: one.otherAvatarUrl,
      date: one.night,
      place: one.place,
      times: one.times,
      why: crossedWhy(one.times),
    }));

  return [...plans, ...follows];
}
