import { supabase } from "./supabaseClient";
import { GROUP_FIELDS, toGroup, type Group } from "./serviceGroup";
import type { FollowAction } from "../lib/followVote";

export type VoteStatus = "open" | "passed" | "rejected" | "cancelled";

// An open vote in one squad on following (or unfollowing) another.
export type FollowVote = {
  id: string;
  groupId: string;
  target: Group;
  action: FollowAction;
  proposedBy: string | null;
  proposerName: string | null;
  yes: number;
  no: number;
  // What the signed-in member voted; null when they have not voted yet.
  myVote: boolean | null;
};

const VOTE_FIELDS = `id, group_id, action, proposed_by,
  target:groups!squad_follow_proposals_target_group_id_fkey(${GROUP_FIELDS}),
  proposer:profiles!squad_follow_proposals_proposed_by_fkey(display_name),
  ballots:squad_follow_ballots(user_id, approve)`;

function toVote(row: any, userId: string): FollowVote {
  const ballots: { user_id: string; approve: boolean }[] = row.ballots ?? [];
  const mine = ballots.find((ballot) => ballot.user_id === userId);

  return {
    id: row.id,
    groupId: row.group_id,
    target: toGroup(row.target),
    action: row.action,
    proposedBy: row.proposed_by ?? null,
    proposerName: row.proposer?.display_name ?? null,
    yes: ballots.filter((ballot) => ballot.approve).length,
    no: ballots.filter((ballot) => !ballot.approve).length,
    myVote: mine ? mine.approve : null,
  };
}

export async function getFollowing(groupId: string): Promise<Group[]> {
  const { data, error } = await supabase
    .from("squad_follows")
    .select(`created_at, followed:groups!squad_follows_followed_group_id_fkey(${GROUP_FIELDS})`)
    .eq("follower_group_id", groupId)
    .order("created_at", { ascending: false });
  if (error) throw error;

  return (data ?? [])
    .filter((row: any) => row.followed)
    .map((row: any) => toGroup(row.followed));
}

export async function getFollowerIds(groupId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from("squad_follows")
    .select("follower_group_id")
    .eq("followed_group_id", groupId);
  if (error) throw error;

  return (data ?? []).map((row: any) => row.follower_group_id as string);
}

export async function isFollowing(from: string, to: string): Promise<boolean> {
  const { data, error } = await supabase
    .from("squad_follows")
    .select("follower_group_id")
    .eq("follower_group_id", from)
    .eq("followed_group_id", to)
    .maybeSingle();
  if (error) throw error;

  return data !== null;
}

// The votes still open in a squad, newest first.
export async function getOpenVotes(groupId: string, userId: string): Promise<FollowVote[]> {
  const { data, error } = await supabase
    .from("squad_follow_proposals")
    .select(VOTE_FIELDS)
    .eq("group_id", groupId)
    .eq("status", "open")
    .order("created_at", { ascending: false });
  if (error) throw error;

  return (data ?? []).filter((row: any) => row.target).map((row: any) => toVote(row, userId));
}

export async function getOpenVote(
  groupId: string,
  targetId: string,
  userId: string,
): Promise<FollowVote | null> {
  const { data, error } = await supabase
    .from("squad_follow_proposals")
    .select(VOTE_FIELDS)
    .eq("group_id", groupId)
    .eq("target_group_id", targetId)
    .eq("status", "open")
    .maybeSingle();
  if (error) throw error;

  return data && (data as any).target ? toVote(data, userId) : null;
}

// Per squad, how many open votes the member has not answered yet.
export async function getPendingVoteCounts(userId: string): Promise<Record<string, number>> {
  const { data, error } = await supabase
    .from("squad_follow_proposals")
    .select("group_id, ballots:squad_follow_ballots(user_id)")
    .eq("status", "open");
  if (error) throw error;

  const counts: Record<string, number> = {};
  for (const row of (data ?? []) as any[]) {
    const voted = (row.ballots ?? []).some((ballot: any) => ballot.user_id === userId);
    if (!voted) counts[row.group_id] = (counts[row.group_id] ?? 0) + 1;
  }
  return counts;
}

// Puts a follow (or unfollow) to the squad's vote, with your yes already in.
// In a squad where that is a majority it passes on the spot.
export async function proposeFollow(
  from: string,
  to: string,
  action: FollowAction,
): Promise<VoteStatus> {
  const { data, error } = await supabase
    .rpc("propose_follow", { p_group_id: from, p_target_id: to, p_action: action })
    .single();
  if (error) throw error;

  return (data as any).status as VoteStatus;
}

export async function castVote(proposalId: string, approve: boolean): Promise<VoteStatus> {
  const { data, error } = await supabase
    .rpc("vote_follow", { p_proposal_id: proposalId, p_approve: approve })
    .single();
  if (error) throw error;

  return (data as any).status as VoteStatus;
}

export async function cancelVote(proposalId: string): Promise<void> {
  const { error } = await supabase.rpc("cancel_follow_proposal", { p_proposal_id: proposalId });
  if (error) throw error;
}
