import { supabase } from "./supabaseClient";
import { requireUser } from "./serviceAuth";
import { UNIQUE_VIOLATION } from "../lib/postgres";
import type { SquadLook } from "../lib/squadLook";

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
};

const GROUP_FIELDS =
  "id, handle, name, bio, avatar_url, banner_url, wallpaper_url, memories_public, member_count, created_at";

export const HANDLE_PATTERN = /^[a-z0-9_]{3,30}$/;

function toGroup(row: any): Group {
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
  };
}

export function normalizeHandle(handle: string): string {
  return handle.trim().toLowerCase();
}

export async function isHandleAvailable(handle: string): Promise<boolean> {
  const { data, error } = await supabase
    .from("groups")
    .select("id")
    .eq("handle", normalizeHandle(handle))
    .maybeSingle();
  if (error) throw error;

  return data === null;
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

export async function deleteGroup(groupId: string): Promise<void> {
  const { error } = await supabase
    .from("groups")
    .delete()
    .eq("id", groupId);
  if (error) throw error;
}

export async function updateGroupProfile(
  groupId: string,
  changes: { name?: string; bio?: string | null; avatarUrl?: string | null },
): Promise<Group> {
  const patch: Record<string, unknown> = {};
  if (changes.name !== undefined) patch.name = changes.name.trim();
  if (changes.bio !== undefined) patch.bio = changes.bio;
  if (changes.avatarUrl !== undefined) patch.avatar_url = changes.avatarUrl;

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
    .select("user_id, profiles(display_name)")
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
  const term = query.trim();
  if (term.length === 0) return [];

  const pattern = `%${term}%`;
  const { data, error } = await supabase
    .from("groups")
    .select(GROUP_FIELDS)
    .or(`handle.ilike.${pattern},name.ilike.${pattern}`)
    .order("member_count", { ascending: false })
    .limit(limit);
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

export async function getMemberNames(groupId: string): Promise<Record<string, string>> {
  const members = await getMembers(groupId);

  const names: Record<string, string> = {};
  for (const m of members as any[]) {
    names[m.user_id] = m.profiles?.display_name ?? "";
  }
  return names;
}
