import { supabase } from "./supabaseClient";
import { requireUser } from "./serviceAuth";
import { UNIQUE_VIOLATION } from "../lib/postgres";
import { searchTerm } from "../lib/search";
import type { Person } from "../lib/people";
export type Group = {
  id: string;
  handle: string;
  name: string;
  bio: string | null;
  avatarUrl: string | null;
  memberCount: number;
  followerCount?: number;
};

const GROUP_FIELDS = "id, handle, name, bio, avatar_url, member_count, parea_follower_count";

export const HANDLE_PATTERN = /^[a-z0-9_]{3,30}$/;

function toGroup(row: any): Group {
  return {
    id: row.id,
    handle: row.handle,
    name: row.name,
    bio: row.bio ?? null,
    avatarUrl: row.avatar_url ?? null,
    memberCount: row.member_count ?? 0,
    followerCount: row.parea_follower_count ?? 0,
  };
}

export async function getFollowedIds(): Promise<string[]> {
  const { data, error } = await supabase.from("parea_follows").select("group_id");
  if (error) throw error;

  return (data ?? []).map((row: { group_id: string }) => row.group_id);
}

export async function followGroup(groupId: string): Promise<void> {
  const user = await requireUser();

  const { error } = await supabase
    .from("parea_follows")
    .upsert({ group_id: groupId, user_id: user.id }, { onConflict: "group_id,user_id", ignoreDuplicates: true });
  if (error) throw error;
}

export async function unfollowGroup(groupId: string): Promise<void> {
  const user = await requireUser();

  const { error } = await supabase
    .from("parea_follows")
    .delete()
    .eq("group_id", groupId)
    .eq("user_id", user.id);
  if (error) throw error;
}

export function normalizeHandle(handle: string): string {
  return handle.trim().toLowerCase();
}

export async function createGroup(handle: string, name: string): Promise<Group> {
  const user = await requireUser();
  const cleanHandle = normalizeHandle(handle);

  if (!HANDLE_PATTERN.test(cleanHandle)) {
    throw new Error("A squad handle is 3-30 characters: a-z, 0-9 and _ only.");
  }

  const { data, error } = await supabase
    .from("groups")
    .insert({ handle: cleanHandle, name: name.trim(), created_by: user.id })
    .select(GROUP_FIELDS)
    .single();

  if (error) {
    if (error.code === UNIQUE_VIOLATION) {
      throw new Error(`@${cleanHandle} is already taken.`);
    }
    throw error;
  }

  await addMember(data.id, user.id);
  await rotateInviteCode(data.id);

  return toGroup(data);
}

export async function addMember(groupId: string, userId: string): Promise<void> {
  const { error } = await supabase
    .from("group_members")
    .insert({ group_id: groupId, user_id: userId });
  if (error) throw error;
}

export async function removeMember(groupId: string, userId: string): Promise<void> {
  const { error } = await supabase
    .from("group_members")
    .delete()
    .eq("group_id", groupId)
    .eq("user_id", userId);
  if (error) throw error;
}

export async function leaveGroup(groupId: string): Promise<void> {
  const user = await requireUser();
  await removeMember(groupId, user.id);
}

export async function getMembers(groupId: string) {
  const { data, error } = await supabase
    .from("group_members")
    .select("user_id, profiles(display_name, avatar_url)")
    .eq("group_id", groupId)
    .order("display_name", { referencedTable: "profiles" });
  if (error) throw error;

  return data;
}

export async function searchGroups(query: string, limit = 20): Promise<Array<Group>> {
  const term = searchTerm(query);
  if (term === null) return [];

  const { data, error } = await supabase.rpc("search_groups_folded", { needle: term, lim: limit });
  if (error) throw error;

  return (data ?? []).map(toGroup);
}

export async function getGroupsForUser(userId: string): Promise<Array<Group>> {
  const { data, error } = await supabase
    .from("group_members")
    .select(`groups(${GROUP_FIELDS})`)
    .eq("user_id", userId);
  if (error) throw error;

  return (data ?? []).map((row: any) => toGroup(row.groups));
}

export async function getInviteCode(groupId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from("group_invites")
    .select("code")
    .eq("group_id", groupId)
    .maybeSingle();
  if (error) throw error;

  return data?.code ?? null;
}

export async function rotateInviteCode(groupId: string): Promise<string> {
  const { data, error } = await supabase
    .rpc("rotate_invite_code", { target_group: groupId });
  if (error) throw error;

  return data as string;
}

export async function joinByInviteCode(inviteCode: string): Promise<Group> {
  const { data, error } = await supabase
    .rpc("join_squad", { invite_code: inviteCode.trim().toUpperCase() });
  if (error || !data) throw new Error("That invite code is not valid.");

  return toGroup(data);
}

export async function getMemberProfiles(groupId: string): Promise<Person[]> {
  const members = await getMembers(groupId);

  return (members as any[]).map((m) => ({
    id: m.user_id,
    name: m.profiles?.display_name ?? "",
    avatarUrl: m.profiles?.avatar_url ?? null,
  }));
}
