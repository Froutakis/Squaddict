import { supabase } from "./supabaseClient";
import type { User } from "./serviceAuth";

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
    .from("profiles")
    .select("acting_group_id")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw error;

  return (data as { acting_group_id: string | null } | null)?.acting_group_id ?? null;
}

export async function setActingGroup(userId: string, groupId: string | null): Promise<void> {
  const { error } = await supabase
    .from("profiles")
    .update({ acting_group_id: groupId })
    .eq("id", userId);
  if (error) throw error;
}
