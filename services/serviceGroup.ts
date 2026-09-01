import { supabase } from "./supabaseClient";
import { requireUser } from "./serviceAuth";

export type Group = {
  id: string;
  handle: string;
  name: string;
  bio: string | null;
  avatarUrl: string | null;
  memberCount: number;
};

const GROUP_FIELDS = "id, handle, name, bio, avatar_url, member_count";

const UNIQUE_VIOLATION = "23505";

export const HANDLE_PATTERN = /^[a-z0-9_]{3,30}$/;

function toGroup(row: any): Group {
  return {
    id: row.id,
    handle: row.handle,
    name: row.name,
    bio: row.bio ?? null,
    avatarUrl: row.avatar_url ?? null,
    memberCount: row.member_count ?? 0,
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

export async function getGroupById(id: string): Promise<Group> {
  const { data, error } = await supabase
    .from("groups")
    .select(GROUP_FIELDS)
    .eq("id", id)
    .single();
  if (error) throw error;

  return toGroup(data);
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

export async function searchSquads(query: string, limit = 20): Promise<Array<Group>> {
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

export async function sendMessage(
  groupId: string,
  senderId: string,
  content: string,
  id?: string,
): Promise<ChatMessage> {
  const row: { group_id: string; sender_id: string; content: string; id?: string } = {
    group_id: groupId,
    sender_id: senderId,
    content,
  };
  if (id) {
    row.id = id;
  }

  const { data, error } = await supabase
    .from("messages")
    .insert(row)
    .select("id, content, sender_id, created_at, profiles(display_name)")
    .single();

  if (error) {
    if (id && error.code === UNIQUE_VIOLATION) {
      const existing = await getMessageById(id);
      if (existing) return existing;
    }
    throw error;
  }

  return toChatMessage(data);
}

export async function getMessageById(id: string): Promise<ChatMessage | null> {
  const { data, error } = await supabase
    .from("messages")
    .select("id, content, sender_id, created_at, profiles(display_name)")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;

  return data ? toChatMessage(data) : null;
}

export type ChatMessage = {
  id: string;
  content: string;
  senderId: string;
  senderName: string;
  createdAt: string;
};

export function toChatMessage(row: any, senderName?: string): ChatMessage {
  return {
    id: row.id,
    content: row.content,
    senderId: row.sender_id,
    senderName: senderName ?? row.profiles?.display_name ?? "",
    createdAt: row.created_at,
  };
}

export const MESSAGE_PAGE_SIZE = 50;

export type MessagePage = {
  messages: ChatMessage[];
  hasMore: boolean;
};

export async function getMessages(
  groupId: string,
  options: { before?: string; limit?: number } = {},
): Promise<MessagePage> {
  const limit = options.limit ?? MESSAGE_PAGE_SIZE;

  let query = supabase
    .from("messages")
    .select("id, content, sender_id, created_at, profiles(display_name)")
    .eq("group_id", groupId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (options.before) {
    query = query.lt("created_at", options.before);
  }

  const { data, error } = await query;
  if (error) throw error;

  const rows = data ?? [];

  return {
    messages: rows.map((row) => toChatMessage(row)).reverse(),
    hasMore: rows.length === limit,
  };
}

export async function getMessagesAfter(
  groupId: string,
  since: string,
  limit: number = MESSAGE_PAGE_SIZE,
): Promise<MessagePage> {
  const { data, error } = await supabase
    .from("messages")
    .select("id, content, sender_id, created_at, profiles(display_name)")
    .eq("group_id", groupId)
    .gt("created_at", since)
    .order("created_at", { ascending: true })
    .limit(limit);

  if (error) throw error;

  const rows = data ?? [];

  return {
    messages: rows.map((row) => toChatMessage(row)),
    hasMore: rows.length === limit,
  };
}

export async function getMemberNames(groupId: string): Promise<Record<string, string>> {
  const members = await getMembers(groupId);

  const names: Record<string, string> = {};
  for (const m of members as any[]) {
    names[m.user_id] = m.profiles?.display_name ?? "";
  }
  return names;
}

export type GroupPreview = {
  content: string;
  senderName: string;
  createdAt: string;
};

export async function getGroupPreviews(
  groupIds: string[],
): Promise<Record<string, GroupPreview>> {
  if (groupIds.length === 0) return {};

  const { data, error } = await supabase
    .from("messages")
    .select("group_id, content, created_at, profiles(display_name)")
    .in("group_id", groupIds)
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw error;

  const previews: Record<string, GroupPreview> = {};
  for (const row of (data ?? []) as any[]) {
    if (previews[row.group_id]) continue;
    previews[row.group_id] = {
      content: row.content,
      senderName: row.profiles?.display_name ?? "",
      createdAt: row.created_at,
    };
  }
  return previews;
}
