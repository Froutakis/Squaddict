import { supabase } from "./supabaseClient";
import { GROUP_FIELDS, toGroup, type Group } from "./serviceGroup";
import { keyOf } from "../lib/datetime";
import { effectiveStatus, type VoteKind, type VoteStatus } from "../lib/squadVote";

export type { VoteKind, VoteStatus };

// The public plan a vote is about.
export type VoteEvent = {
  id: string;
  groupId: string;
  groupName: string;
  title: string;
  date: string;
  startTime?: string;
  location?: string;
  placeLabel?: string;
  lat?: number;
  lng?: number;
  coverUrl: string | null;
  isPublic: boolean;
};

export type VoteTarget = { type: "squad"; group: Group } | { type: "event"; event: VoteEvent };

export type SquadVote = {
  id: string;
  groupId: string;
  kind: VoteKind;
  target: VoteTarget;
  targetName: string;
  status: VoteStatus;
  proposedBy: string | null;
  proposerName: string | null;
  yes: number;
  no: number;
  // What the signed-in member voted; null when they have not voted yet.
  myVote: boolean | null;
  closedAt: string | null;
};

export type GoingSquad = { id: string; name: string; avatarUrl: string | null };

const DECIDED_SHOWN = 5;

const VOTE_FIELDS = `id, group_id, kind, status, proposed_by, created_at, closed_at,
  target_group:groups!squad_proposals_target_group_id_fkey(${GROUP_FIELDS}),
  target_event:events!squad_proposals_target_event_id_fkey(id, group_id, title, date, start_time, location, place_label, lat, lng, cover_url, is_public, host:groups!events_group_id_fkey(name)),
  proposer:profiles!squad_proposals_proposed_by_fkey(display_name),
  ballots:squad_ballots(user_id, approve)`;

function toVoteEvent(row: any): VoteEvent {
  return {
    id: row.id,
    groupId: row.group_id,
    groupName: row.host?.name ?? "Squad",
    title: row.title,
    date: row.date,
    startTime: row.start_time?.slice(0, 5) ?? undefined,
    location: row.location ?? undefined,
    placeLabel: row.place_label ?? undefined,
    lat: row.lat ?? undefined,
    lng: row.lng ?? undefined,
    coverUrl: row.cover_url ?? null,
    isPublic: row.is_public ?? false,
  };
}

// Null when the target can no longer be read (a deleted squad or plan).
function toVote(row: any, userId: string, today: string): SquadVote | null {
  const target: VoteTarget | null = row.target_group
    ? { type: "squad", group: toGroup(row.target_group) }
    : row.target_event
      ? { type: "event", event: toVoteEvent(row.target_event) }
      : null;
  if (!target) return null;

  const ballots: { user_id: string; approve: boolean }[] = row.ballots ?? [];
  const mine = ballots.find((ballot) => ballot.user_id === userId);

  return {
    id: row.id,
    groupId: row.group_id,
    kind: row.kind,
    target,
    targetName: target.type === "squad" ? target.group.name : target.event.title,
    status: effectiveStatus(row.status, target.type === "event" ? target.event.date : null, today),
    proposedBy: row.proposed_by ?? null,
    proposerName: row.proposer?.display_name ?? null,
    yes: ballots.filter((ballot) => ballot.approve).length,
    no: ballots.filter((ballot) => !ballot.approve).length,
    myVote: mine ? mine.approve : null,
    closedAt: row.closed_at ?? null,
  };
}

function toVotes(rows: any[] | null, userId: string): SquadVote[] {
  const today = keyOf(new Date());
  return (rows ?? []).map((row) => toVote(row, userId, today)).filter((vote): vote is SquadVote => vote !== null);
}

// The votes still open in a squad, newest first.
export async function getOpenVotes(groupId: string, userId: string): Promise<SquadVote[]> {
  const { data, error } = await supabase
    .from("squad_proposals")
    .select(VOTE_FIELDS)
    .eq("group_id", groupId)
    .eq("status", "open")
    .order("created_at", { ascending: false });
  if (error) throw error;

  return toVotes(data, userId).filter((vote) => vote.status === "open");
}

// For the Votes sheet: what is open, and the last few that were decided.
export async function getVotes(
  groupId: string,
  userId: string,
): Promise<{ open: SquadVote[]; decided: SquadVote[] }> {
  const [openRows, closedRows] = await Promise.all([
    supabase
      .from("squad_proposals")
      .select(VOTE_FIELDS)
      .eq("group_id", groupId)
      .eq("status", "open")
      .order("created_at", { ascending: false }),
    supabase
      .from("squad_proposals")
      .select(VOTE_FIELDS)
      .eq("group_id", groupId)
      .neq("status", "open")
      .order("closed_at", { ascending: false })
      .limit(DECIDED_SHOWN),
  ]);
  if (openRows.error) throw openRows.error;
  if (closedRows.error) throw closedRows.error;

  const stillOpen = toVotes(openRows.data, userId);
  const decided = [...stillOpen.filter((vote) => vote.status !== "open"), ...toVotes(closedRows.data, userId)]
    .sort((a, b) => (b.closedAt ?? "").localeCompare(a.closedAt ?? ""))
    .slice(0, DECIDED_SHOWN);

  return { open: stillOpen.filter((vote) => vote.status === "open"), decided };
}

export async function getOpenSquadVote(
  groupId: string,
  targetGroupId: string,
  userId: string,
): Promise<SquadVote | null> {
  const { data, error } = await supabase
    .from("squad_proposals")
    .select(VOTE_FIELDS)
    .eq("group_id", groupId)
    .eq("target_group_id", targetGroupId)
    .eq("status", "open")
    .maybeSingle();
  if (error) throw error;

  return data ? toVotes([data], userId)[0] ?? null : null;
}

// The squad's open votes on these plans, by event id.
export async function getOpenEventVotes(
  groupId: string,
  eventIds: string[],
  userId: string,
): Promise<Record<string, SquadVote>> {
  if (eventIds.length === 0) return {};

  const { data, error } = await supabase
    .from("squad_proposals")
    .select(VOTE_FIELDS)
    .eq("group_id", groupId)
    .eq("status", "open")
    .in("target_event_id", eventIds);
  if (error) throw error;

  const byEvent: Record<string, SquadVote> = {};
  for (const vote of toVotes(data, userId)) {
    if (vote.status === "open" && vote.target.type === "event") byEvent[vote.target.event.id] = vote;
  }
  return byEvent;
}

// Per squad, how many open votes the member has not answered yet.
export async function getPendingVoteCounts(userId: string): Promise<Record<string, number>> {
  const { data, error } = await supabase
    .from("squad_proposals")
    .select("group_id, target_event:events!squad_proposals_target_event_id_fkey(date), ballots:squad_ballots(user_id)")
    .eq("status", "open");
  if (error) throw error;

  const today = keyOf(new Date());
  const counts: Record<string, number> = {};
  for (const row of (data ?? []) as any[]) {
    if (effectiveStatus("open", row.target_event?.date ?? null, today) !== "open") continue;
    const voted = (row.ballots ?? []).some((ballot: any) => ballot.user_id === userId);
    if (!voted) counts[row.group_id] = (counts[row.group_id] ?? 0) + 1;
  }
  return counts;
}

// Puts something to the squad's vote with your yes already in. In a squad
// where that is a majority it passes on the spot.
export async function propose(groupId: string, kind: VoteKind, targetId: string): Promise<VoteStatus> {
  const { data, error } = await supabase
    .rpc("propose", { p_group_id: groupId, p_kind: kind, p_target_id: targetId })
    .single();
  if (error) throw error;

  return (data as any).status as VoteStatus;
}

export async function castVote(proposalId: string, approve: boolean): Promise<VoteStatus> {
  const { data, error } = await supabase
    .rpc("vote", { p_proposal_id: proposalId, p_approve: approve })
    .single();
  if (error) throw error;

  return (data as any).status as VoteStatus;
}

export async function cancelVote(proposalId: string): Promise<void> {
  const { error } = await supabase.rpc("cancel_proposal", { p_proposal_id: proposalId });
  if (error) throw error;
}

// Which of your squads are going to each of these plans.
export async function getMyGoing(groupIds: string[], eventIds: string[]): Promise<Record<string, string[]>> {
  if (groupIds.length === 0 || eventIds.length === 0) return {};

  const { data, error } = await supabase
    .from("squad_event_going")
    .select("group_id, event_id")
    .in("group_id", groupIds)
    .in("event_id", eventIds);
  if (error) throw error;

  const byEvent: Record<string, string[]> = {};
  for (const row of (data ?? []) as { group_id: string; event_id: string }[]) {
    (byEvent[row.event_id] ??= []).push(row.group_id);
  }
  return byEvent;
}

// Every squad going to a plan, first to decide first.
export async function getGoingSquads(eventId: string): Promise<GoingSquad[]> {
  const { data, error } = await supabase
    .from("squad_event_going")
    .select("created_at, group:groups(id, name, avatar_url)")
    .eq("event_id", eventId)
    .order("created_at", { ascending: true });
  if (error) throw error;

  return ((data ?? []) as any[])
    .filter((row) => row.group)
    .map((row) => ({ id: row.group.id, name: row.group.name, avatarUrl: row.group.avatar_url ?? null }));
}
