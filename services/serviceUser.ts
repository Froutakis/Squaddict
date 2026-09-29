import { supabase } from "./supabaseClient";
import type { User } from "./serviceAuth";
import { getGroupsForUser, type Group } from "./serviceGroup";
import { pickActing } from "../lib/acting";

type ProfileRow = {
  id: string;
  display_name: string;
};

function toUser(r: ProfileRow): User {
  return {
    id: r.id,
    name: r.display_name,
    isOnline: false,
  };
}

export async function getUserById(id: string): Promise<User | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;

  return toUser(data as ProfileRow);
}

export async function updateDisplayName(id: string, newName: string): Promise<void> {
  const { error } = await supabase
    .from("profiles")
    .update({ display_name: newName })
    .eq("id", id);
  if (error) throw error;
}

export async function getActingGroupId(userId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from("user_prefs")
    .select("acting_group_id")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;

  return (data as { acting_group_id: string | null } | null)?.acting_group_id ?? null;
}

export async function setActingGroup(userId: string, groupId: string | null): Promise<void> {
  const { error } = await supabase
    .from("user_prefs")
    .upsert({ user_id: userId, acting_group_id: groupId }, { onConflict: "user_id" });
  if (error) throw error;
}

export async function getActingSquad(userId: string): Promise<Group | null> {
  const [groups, actingId] = await Promise.all([
    getGroupsForUser(userId),
    getActingGroupId(userId).catch(() => null),
  ]);

  return pickActing(groups, actingId);
}
