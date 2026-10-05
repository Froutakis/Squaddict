import { getFollowing } from "./serviceFollow";
import { getCrossings } from "./serviceCrossed";
import { features } from "../lib/features";

// Things worth putting to a squad's vote, for a quiet Votes page: a parea it
// keeps crossing on nights out. (Going to another parea's plan is not a vote
// any more: each member answers it.) Built from what the app already reads;
// nothing here writes. Every part fails quietly: no ideas is a fine answer.

export type VoteIdea = {
  kind: "follow";
  // Stable per parea, for "Not now".
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

  const crossings = features.squadFollows ? await getCrossings(groupId).catch(() => []) : [];

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

  return follows;
}
