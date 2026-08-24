import { supabase } from "./supabaseClient";
import { requireUser } from "./serviceAuth";

type GroupRow = {
  id: string;
  name: string;
  handle: string;
  created_by: string;
  created_at: string;
};

export type Group = {
  id: string;
  name: string;
  handle: string;
};

export function toGroup(r: Pick<GroupRow, "id" | "name" | "handle">): Group {
  return {
    id: r.id,
    name: r.name,
    handle: r.handle,
  };
}

export async function createGroup(name: string): Promise<Group> {
  const user = await requireUser();

  const { data, error } = await supabase
    .from("groups")
    .insert({ name })
    .select()
    .single();
  if (error) throw error;

  await addMember(data.id, user.id);

  return toGroup(data as GroupRow);
}

export async function deleteGroup(groupId: string): Promise<void> {
  const { error } = await supabase
    .from("groups")
    .delete()
    .eq("id", groupId);
  if (error) throw error;
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
    .select("*")
    .eq("id", id)
    .single();
  if (error) throw error;

  return toGroup(data as GroupRow);
}

export async function getAllGroups(): Promise<Array<Group>> {
  const { data, error } = await supabase
    .from("groups")
    .select("*");
  if (error) throw error;

  return (data as GroupRow[]).map(toGroup);
}

export async function getGroupsForUser(userId: string): Promise<Array<Group>> {
  const { data, error } = await supabase
    .from("group_members")
    .select("groups(id, name, handle)")
    .eq("user_id", userId);
  if (error) throw error;

  return data.map((row: any) => toGroup(row.groups));
}

export async function sendMessage(groupId: string, senderId: string, content: string): Promise<void> {
  const { error } = await supabase
    .from("messages")
    .insert({ group_id: groupId, sender_id: senderId, content });
  if (error) throw error;
}

export type ChatMessage = {
  id: string;
  content: string;
  senderId: string;
  senderName: string;
  createdAt: string;
};

/** Μετατρέπει μια γραμμή του πίνακα messages σε ChatMessage. */
export function toChatMessage(row: any, senderName?: string): ChatMessage {
  return {
    id: row.id,
    content: row.content,
    senderId: row.sender_id,
    senderName: senderName ?? row.profiles?.display_name ?? "",
    createdAt: row.created_at,
  };
}

export async function getMessages(groupId: string): Promise<ChatMessage[]> {
  const { data, error } = await supabase
    .from("messages")
    .select("id, content, sender_id, created_at, profiles(display_name)")
    .eq("group_id", groupId)
    .order("created_at");
  if (error) throw error;

  return (data ?? []).map((row) => toChatMessage(row));
}

/** Χάρτης user_id → όνομα, για τα μηνύματα που έρχονται από το realtime (δεν φέρνουν προφίλ). */
export async function getMemberNames(groupId: string): Promise<Record<string, string>> {
  const members = await getMembers(groupId);

  const names: Record<string, string> = {};
  for (const m of members as any[]) {
    names[m.user_id] = m.profiles?.display_name ?? "";
  }
  return names;
}

export async function joinByInviteCode(inviteCode: string, userId: string): Promise<Group> {
  const code = inviteCode.trim().toLowerCase();

  const { data: group, error } = await supabase
    .from("groups")
    .select("*")
    .eq("handle", code)
    .maybeSingle();
  if (error) throw error;
  if (!group) throw new Error(`No squad found with code "${code}".`);

  const { data: existing, error: memberError } = await supabase
    .from("group_members")
    .select("user_id")
    .eq("group_id", group.id)
    .eq("user_id", userId)
    .maybeSingle();
  if (memberError) throw memberError;
  if (existing) throw new Error(`You are already in "${group.name}".`);

  await addMember(group.id, userId);

  return toGroup(group as GroupRow);
}
