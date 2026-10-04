import { supabase } from "./supabaseClient";
import { requireUser } from "./serviceAuth";
import { UNIQUE_VIOLATION } from "../lib/postgres";
import type { SquadLook } from "../lib/squadLook";
import { searchTerm } from "../lib/search";
import type { Person } from "../lib/people";

export type Group = {
  id: string;
  handle: string;
  name: string;
  bio: string | null;
  avatarUrl: string | null;
  bannerUrl: string | null;
  wallpaperUrl: string | null;
  memoriesPublic: boolean;
  memberCount: number;
  createdAt: string;
  followerCount?: number;
};

export const GROUP_FIELDS =
  "id, handle, name, bio, avatar_url, banner_url, wallpaper_url, memories_public, member_count, created_at, parea_follower_count";

export const HANDLE_PATTERN = /^[a-z0-9_]{3,30}$/;

export function toGroup(row: any): Group {
  return {
    id: row.id,
    handle: row.handle,
    name: row.name,
    bio: row.bio ?? null,
    avatarUrl: row.avatar_url ?? null,
    bannerUrl: row.banner_url ?? null,
    wallpaperUrl: row.wallpaper_url ?? null,
    memoriesPublic: row.memories_public ?? false,
    memberCount: row.member_count ?? 0,
    createdAt: row.created_at ?? '',
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

  // No open invite code any more: the creator is the whole squad, so their
  // own invite vote passes at once and gives a link that works once.
  await addMember(data.id, user.id);

  return toGroup(data);
}

export async function deleteGroup(groupId: string): Promise<void> {
  const { error } = await supabase
    .from("groups")
    .delete()
    .eq("id", groupId);
  if (error) throw error;
}

// The bio only: the name and photo change by a vote (propose 'rename' /
// 'photo'), and the database refuses them here (lock_voted_squad_fields).
export async function updateGroupProfile(
  groupId: string,
  changes: { bio?: string | null },
): Promise<Group> {
  const patch: Record<string, unknown> = {};
  if (changes.bio !== undefined) patch.bio = changes.bio;

  const { data, error } = await supabase
    .from("groups")
    .update(patch)
    .eq("id", groupId)
    .select(GROUP_FIELDS)
    .single();
  if (error) throw error;

  return toGroup(data);
}

export function lookOf(group: Group): SquadLook {
  return {
    avatarUrl: group.avatarUrl ?? null,
    bannerUrl: group.bannerUrl ?? null,
    wallpaperUrl: group.wallpaperUrl ?? null,
    memoriesPublic: group.memoriesPublic ?? false,
  };
}

export async function updateSquadLook(groupId: string, look: SquadLook): Promise<Group> {
  const { data, error } = await supabase
    .rpc("update_squad_look", {
      p_group_id: groupId,
      p_avatar_url: look.avatarUrl,
      p_banner_url: look.bannerUrl,
      p_wallpaper_url: look.wallpaperUrl,
      p_memories_public: look.memoriesPublic,
    })
    .single();
  if (error) throw error;

  return toGroup(data);
}

// Read on its own (not in GROUP_FIELDS) so the app keeps working before the
// banner_focus_y column exists: then this just falls back to the middle.
export async function getBannerFocus(groupId: string): Promise<number> {
  const { data, error } = await supabase
    .from("groups")
    .select("banner_focus_y")
    .eq("id", groupId)
    .maybeSingle();
  if (error) throw error;

  const value = (data as { banner_focus_y?: number } | null)?.banner_focus_y;
  return typeof value === "number" ? value : 0.5;
}

export async function setBannerFocus(groupId: string, focus: number): Promise<void> {
  const { error } = await supabase.rpc("set_banner_focus", { p_group_id: groupId, p_focus: focus });
  if (error) throw error;
}

export async function getNightsKept(groupId: string): Promise<number> {
  const { data, error } = await supabase.rpc("squad_nights_kept", { p_group_id: groupId });
  if (error) throw error;

  return typeof data === "number" ? data : 0;
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

export async function getGroupById(groupId: string): Promise<Group | null> {
  const { data, error } = await supabase
    .from("groups")
    .select(GROUP_FIELDS)
    .eq("id", groupId)
    .maybeSingle();
  if (error) throw error;

  return data ? toGroup(data) : null;
}

export async function getGroupByHandle(handle: string): Promise<Group | null> {
  const { data, error } = await supabase
    .from("groups")
    .select(GROUP_FIELDS)
    .eq("handle", normalizeHandle(handle))
    .maybeSingle();
  if (error) throw error;

  return data ? toGroup(data) : null;
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
    .eq("user_id", userId)
    .order("joined_at", { ascending: true });
  if (error) throw error;

  return (data ?? []).map((row: any) => toGroup(row.groups));
}

// The code of a link from a passed invite vote. Each works once, so the
// database's own reason (not valid, used already) is passed on.
export async function joinByInviteCode(inviteCode: string): Promise<Group> {
  const { data, error } = await supabase
    .rpc("join_squad", { invite_code: inviteCode.trim().toUpperCase() });
  if (error || !data) throw new Error(error?.message || "That invite is not valid.");

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
