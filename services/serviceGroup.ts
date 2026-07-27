import { supabase } from "./supabaseClient";
import { Group } from "../models/main";

export async function createGroup(name: string): Promise<Group> {
  const { data: existing, error: existingError } = await supabase
    .from("groups")
    .select("id")
    .ilike("name", name)
    .maybeSingle();
  if (existingError) throw existingError;
  if (existing) throw new Error(`Υπάρχει ήδη παρέα με το όνομα "${name}".`);

  const { data, error } = await supabase
    .from("groups")
    .insert({ name })
    .select()
    .single();
  if (error) throw error;

  return new Group(data.id, data.name);
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

  return new Group(data.id, data.name);
}

export async function getAllGroups(): Promise<Array<Group>> {
  const { data, error } = await supabase
    .from("groups")
    .select("*");
  if (error) throw error;

  return data.map((g) => new Group(g.id, g.name));
}

export async function getGroupsForUser(userId: string): Promise<Array<Group>> {
  const { data, error } = await supabase
    .from("group_members")
    .select("groups(id, name)")
    .eq("user_id", userId);
  if (error) throw error;

  return data.map((row: any) => new Group(row.groups.id, row.groups.name));
}

export async function sendMessage(groupId: string, senderId: string, content: string): Promise<void> {
  const { error } = await supabase
    .from("messages")
    .insert({ group_id: groupId, sender_id: senderId, content });
  if (error) throw error;
}

export async function getMessages(groupId: string) {
  const { data, error } = await supabase
    .from("messages")
    .select("content, profiles(display_name)")
    .eq("group_id", groupId)
    .order("created_at");
  if (error) throw error;
  return data;
}

export async function joinByInviteCode(inviteCode: string, userId: string): Promise<Group> {
  const { data: group, error } = await supabase
    .from("groups")
    .select("*")
    .eq("invite_code", inviteCode)
    .maybeSingle();
  if (error) throw error;
  if (!group) throw new Error(`Δεν βρέθηκε παρέα με κωδικό "${inviteCode}".`);

  await addMember(group.id, userId);

  return new Group(group.id, group.name);
}
