import { supabase } from "./supabaseClient";
import { GROUP_FIELDS, toGroup, type Group } from "./serviceGroup";
import { keyOf } from "../lib/datetime";
import { effectiveStatus, inviteExpiry, type VoteKind, type VoteStatus } from "../lib/squadVote";

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

// The member a remove vote is about. Profiles are only readable between
// squadmates, so once they are out the name may be gone: name is null then.
export type VoteUser = { id: string; name: string | null; avatarUrl: string | null };

export type VoteOption = { id: string; label: string; votes: number };

// The link a passed invite vote made. It works once, within a week.
export type InviteLink = { code: string; usedByName: string | null; usedAt: string | null; createdAt: string };

export type VoteTarget =
  | { type: "squad"; group: Group }
  | { type: "event"; event: VoteEvent }
  | { type: "user"; user: VoteUser }
  | { type: "poll"; options: VoteOption[]; myOption: string | null; winnerId: string | null }
  | { type: "setting" }
  | { type: "invite"; link: InviteLink | null };

// What a vote needs to say and apply (squad_proposals.payload).
export type VotePayload = {
  question?: string;
  name?: string;
  url?: string;
  public?: boolean;
  winner?: string;
  winnerId?: string;
};

// One member's ballot: approve on a yes / no vote, optionId on a question.
export type VoteBallot = { userId: string; approve: boolean | null; optionId: string | null };

export type SquadVote = {
  id: string;
  groupId: string;
  // The squad deciding, e.g. for the invite message.
  squadName: string;
  kind: VoteKind;
  target: VoteTarget;
  targetName: string;
  payload: VotePayload;
  status: VoteStatus;
  proposedBy: string | null;
  proposerName: string | null;
  yes: number;
  no: number;
  // Everyone who answered: yes, no, or a choice on a question.
  voted: number;
  // What the signed-in member voted; null when they have not voted yet.
  myVote: boolean | null;
  // Who answered what, current members only (like the counts above): the
  // faces on a vote ticket.
  ballots: VoteBallot[];
  createdAt: string;
  closedAt: string | null;
};

export type GoingSquad = { id: string; name: string; avatarUrl: string | null };

const DECIDED_SHOWN = 5;
const INVITES_SHOWN = 10;

// squad_proposals points at groups and profiles twice each, so every embed
// names its foreign key.
const VOTE_FIELDS = `id, group_id, kind, status, payload, proposed_by, target_user_id, created_at, closed_at,
  squad:groups!squad_proposals_group_id_fkey(name),
  target_group:groups!squad_proposals_target_group_id_fkey(${GROUP_FIELDS}),
  target_event:events!squad_proposals_target_event_id_fkey(id, group_id, title, date, start_time, location, place_label, lat, lng, cover_url, is_public, host:groups!events_group_id_fkey(name)),
  target_user:profiles!squad_proposals_target_user_id_fkey(id, display_name, avatar_url),
  proposer:profiles!squad_proposals_proposed_by_fkey(display_name),
  options:squad_proposal_options!squad_proposal_options_proposal_id_fkey(id, label, position),
  invite:squad_invite_links!squad_invite_links_proposal_id_fkey(code, used_at, created_at, joined:profiles!squad_invite_links_used_by_fkey(display_name)),
  ballots:squad_ballots!squad_ballots_proposal_id_fkey(user_id, approve, option_id)`;

const EVENT_FIELDS =
  "id, group_id, title, date, start_time, location, place_label, lat, lng, cover_url, is_public, host:groups!events_group_id_fkey(name)";

type BallotRow = { user_id: string; approve: boolean | null; option_id: string | null };

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

// A one-to-one embed comes back as an object, or as a list on older PostgREST.
function single(value: any): any {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

function toTarget(row: any, payload: VotePayload, ballots: BallotRow[], userId: string): VoteTarget | null {
  switch (row.kind as VoteKind) {
    case "follow":
    case "unfollow":
      return row.target_group ? { type: "squad", group: toGroup(row.target_group) } : null;
    case "attend":
    case "unattend":
      return row.target_event ? { type: "event", event: toVoteEvent(row.target_event) } : null;
    case "remove":
      return {
        type: "user",
        user: {
          id: row.target_user_id,
          name: row.target_user?.display_name ?? null,
          avatarUrl: row.target_user?.avatar_url ?? null,
        },
      };
    case "poll": {
      const options = ((row.options ?? []) as { id: string; label: string; position: number }[])
        .slice()
        .sort((a, b) => a.position - b.position)
        .map((option) => ({
          id: option.id,
          label: option.label,
          votes: ballots.filter((ballot) => ballot.option_id === option.id).length,
        }));
      return {
        type: "poll",
        options,
        myOption: ballots.find((ballot) => ballot.user_id === userId)?.option_id ?? null,
        winnerId: payload.winnerId ?? null,
      };
    }
    case "invite": {
      const link = single(row.invite);
      return {
        type: "invite",
        link: link
          ? toLink(link)
          : null,
      };
    }
    default:
      return { type: "setting" };
  }
}

function toLink(row: any): InviteLink {
  return {
    code: row.code,
    usedByName: single(row.joined)?.display_name ?? null,
    usedAt: row.used_at ?? null,
    createdAt: row.created_at ?? "",
  };
}

function nameOf(kind: VoteKind, target: VoteTarget, payload: VotePayload, squadName: string): string {
  if (target.type === "squad") return target.group.name;
  if (target.type === "event") return target.event.title;
  if (target.type === "user") return target.user.name ?? "a former member";
  if (kind === "poll") return payload.question ?? "A question";
  if (kind === "invite" || kind === "rename") return payload.name ?? "";
  if (kind === "memories") return payload.public ? "public" : "private";
  return squadName;
}

// Null when the target can no longer be read (a deleted squad or plan).
// members: the squad's current members. Like resolve_proposal, only their
// ballots count; someone who left or was removed no longer moves the tally.
function toVote(row: any, userId: string, today: string, members: Set<string> | null): SquadVote | null {
  const payload: VotePayload = row.payload ?? {};
  const cast: BallotRow[] = row.ballots ?? [];
  const ballots = members ? cast.filter((ballot) => members.has(ballot.user_id)) : cast;
  const target = toTarget(row, payload, ballots, userId);
  if (!target) return null;

  const mine = ballots.find((ballot) => ballot.user_id === userId);
  const squadName: string = row.squad?.name ?? "the squad";

  return {
    id: row.id,
    groupId: row.group_id,
    squadName,
    kind: row.kind,
    target,
    targetName: nameOf(row.kind, target, payload, squadName),
    payload,
    status: effectiveStatus(row.status, target.type === "event" ? target.event.date : null, today),
    proposedBy: row.proposed_by ?? null,
    proposerName: row.proposer?.display_name ?? null,
    yes: ballots.filter((ballot) => ballot.approve === true).length,
    no: ballots.filter((ballot) => ballot.approve === false).length,
    voted: ballots.length,
    myVote: mine && mine.approve !== null ? mine.approve : null,
    ballots: ballots.map((ballot) => ({ userId: ballot.user_id, approve: ballot.approve, optionId: ballot.option_id })),
    createdAt: row.created_at ?? "",
    closedAt: row.closed_at ?? null,
  };
}

function toVotes(rows: any[] | null, userId: string, members: Set<string> | null): SquadVote[] {
  const today = keyOf(new Date());
  return (rows ?? [])
    .map((row) => toVote(row, userId, today, members))
    .filter((vote): vote is SquadVote => vote !== null);
}

// Who is in the squad now. Null if that can't be read: then every ballot counts.
async function memberIds(groupId: string): Promise<Set<string> | null> {
  const { data, error } = await supabase.from("group_members").select("user_id").eq("group_id", groupId);
  if (error) return null;
  return new Set(((data ?? []) as { user_id: string }[]).map((row) => row.user_id));
}

// A passed invite whose link is still unused and within its week.
function stillToSend(vote: SquadVote): boolean {
  return (
    vote.target.type === "invite" &&
    vote.target.link !== null &&
    vote.target.link.usedAt === null &&
    !inviteExpiry(vote.target.link.createdAt).expired
  );
}

// Whether the member still has to answer this vote. The member a remove
// vote is about does not vote on it.
export function waitsOnMe(vote: SquadVote, userId: string): boolean {
  if (vote.status !== "open") return false;
  if (vote.target.type === "user" && vote.target.user.id === userId) return false;
  if (vote.target.type === "poll") return vote.target.myOption === null;
  return vote.myVote === null;
}

// The votes still open in a squad, newest first.
export async function getOpenVotes(groupId: string, userId: string): Promise<SquadVote[]> {
  const [{ data, error }, members] = await Promise.all([
    supabase
      .from("squad_proposals")
      .select(VOTE_FIELDS)
      .eq("group_id", groupId)
      .eq("status", "open")
      .order("created_at", { ascending: false }),
    memberIds(groupId),
  ]);
  if (error) throw error;

  return toVotes(data, userId, members).filter((vote) => vote.status === "open");
}

// For the Votes page: what is open, invites that passed and still wait to be
// sent (so their link never scrolls away), and the last few decided.
export async function getVotes(
  groupId: string,
  userId: string,
): Promise<{ open: SquadVote[]; invites: SquadVote[]; decided: SquadVote[] }> {
  const [openRows, closedRows, inviteRows, members] = await Promise.all([
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
    supabase
      .from("squad_proposals")
      .select(VOTE_FIELDS)
      .eq("group_id", groupId)
      .eq("kind", "invite")
      .eq("status", "passed")
      .order("closed_at", { ascending: false })
      .limit(INVITES_SHOWN),
    memberIds(groupId),
  ]);
  if (openRows.error) throw openRows.error;
  if (closedRows.error) throw closedRows.error;
  if (inviteRows.error) throw inviteRows.error;

  const invites = toVotes(inviteRows.data, userId, members).filter(stillToSend);
  const waiting = new Set(invites.map((vote) => vote.id));

  const stillOpen = toVotes(openRows.data, userId, members);
  const decided = [...stillOpen.filter((vote) => vote.status !== "open"), ...toVotes(closedRows.data, userId, members)]
    .filter((vote) => !waiting.has(vote.id))
    .sort((a, b) => (b.closedAt ?? "").localeCompare(a.closedAt ?? ""))
    .slice(0, DECIDED_SHOWN);

  return { open: stillOpen.filter((vote) => vote.status === "open"), invites, decided };
}

// How many votes the squad decided since a moment (e.g. the 1st of the
// month). getVotes() only brings the last few, so this counts them on the
// server. Null when it can't be read; the screen then counts what it has.
export async function countDecidedSince(groupId: string, since: Date): Promise<number | null> {
  const { count, error } = await supabase
    .from("squad_proposals")
    .select("id", { count: "exact", head: true })
    .eq("group_id", groupId)
    .neq("status", "open")
    .gte("closed_at", since.toISOString());
  if (error) return null;
  return count ?? 0;
}

export async function getOpenSquadVote(
  groupId: string,
  targetGroupId: string,
  userId: string,
): Promise<SquadVote | null> {
  const [{ data, error }, members] = await Promise.all([
    supabase
      .from("squad_proposals")
      .select(VOTE_FIELDS)
      .eq("group_id", groupId)
      .eq("target_group_id", targetGroupId)
      .eq("status", "open")
      .maybeSingle(),
    memberIds(groupId),
  ]);
  if (error) throw error;

  return data ? toVotes([data], userId, members)[0] ?? null : null;
}

// The squad's open votes on these plans, by event id.
export async function getOpenEventVotes(
  groupId: string,
  eventIds: string[],
  userId: string,
): Promise<Record<string, SquadVote>> {
  if (eventIds.length === 0) return {};

  const [{ data, error }, members] = await Promise.all([
    supabase
      .from("squad_proposals")
      .select(VOTE_FIELDS)
      .eq("group_id", groupId)
      .eq("status", "open")
      .in("target_event_id", eventIds),
    memberIds(groupId),
  ]);
  if (error) throw error;

  const byEvent: Record<string, SquadVote> = {};
  for (const vote of toVotes(data, userId, members)) {
    if (vote.status === "open" && vote.target.type === "event") byEvent[vote.target.event.id] = vote;
  }
  return byEvent;
}

// Per squad, how many open votes the member has not answered yet.
export async function getPendingVoteCounts(userId: string): Promise<Record<string, number>> {
  const { data, error } = await supabase
    .from("squad_proposals")
    .select(
      "group_id, target_user_id, target_event:events!squad_proposals_target_event_id_fkey(date), ballots:squad_ballots!squad_ballots_proposal_id_fkey(user_id)",
    )
    .eq("status", "open");
  if (error) throw error;

  const today = keyOf(new Date());
  const counts: Record<string, number> = {};
  for (const row of (data ?? []) as any[]) {
    if (effectiveStatus("open", row.target_event?.date ?? null, today) !== "open") continue;
    // Nobody votes on their own removal.
    if (row.target_user_id === userId) continue;
    const voted = (row.ballots ?? []).some((ballot: any) => ballot.user_id === userId);
    if (!voted) counts[row.group_id] = (counts[row.group_id] ?? 0) + 1;
  }
  return counts;
}

// Puts something to the squad's vote. targetId is the squad, plan or member it
// is about; payload carries the rest ({question, options}, {name}, {url},
// {public}). Your yes is already in, except on a question, where you pick like
// everyone else. In a squad where that is a majority it passes on the spot.
export async function propose(
  groupId: string,
  kind: VoteKind,
  targetId: string | null = null,
  payload: Record<string, unknown> | null = null,
): Promise<VoteStatus> {
  const { data, error } = await supabase
    .rpc("propose", { p_group_id: groupId, p_kind: kind, p_target_id: targetId, p_payload: payload })
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

// A choice on a question. Picking again changes your answer while it is open.
export async function castOption(proposalId: string, optionId: string): Promise<VoteStatus> {
  const { data, error } = await supabase
    .rpc("vote", { p_proposal_id: proposalId, p_option_id: optionId })
    .single();
  if (error) throw error;

  return (data as any).status as VoteStatus;
}

export async function cancelVote(proposalId: string): Promise<void> {
  const { error } = await supabase.rpc("cancel_proposal", { p_proposal_id: proposalId });
  if (error) throw error;
}

// The link of a passed invite vote, read fresh right before it is shared, so
// a link someone used in the meantime is not sent again.
export async function getVoteLink(proposalId: string): Promise<InviteLink | null> {
  const { data, error } = await supabase
    .from("squad_invite_links")
    .select("code, used_at, created_at, joined:profiles!squad_invite_links_used_by_fkey(display_name)")
    .eq("proposal_id", proposalId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;

  return toLink(data);
}

// Plans this squad voted to go to that are still ahead: what it can vote to skip.
export async function getSquadGoingPlans(groupId: string): Promise<VoteEvent[]> {
  const { data, error } = await supabase
    .from("squad_event_going")
    .select(`event:events!squad_event_going_event_id_fkey(${EVENT_FIELDS})`)
    .eq("group_id", groupId);
  if (error) throw error;

  const today = keyOf(new Date());
  return ((data ?? []) as any[])
    .map((row) => single(row.event))
    .filter((event) => event && event.date >= today)
    .map(toVoteEvent)
    .sort((a, b) => (a.date + (a.startTime ?? "")).localeCompare(b.date + (b.startTime ?? "")));
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
