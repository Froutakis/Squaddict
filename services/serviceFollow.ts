import { supabase } from "./supabaseClient";
import { requireUser } from "./serviceAuth";
import { UNIQUE_VIOLATION } from "../lib/postgres";
import { GROUP_FIELDS, toGroup, type Group } from "./serviceGroup";

export async function getFollowing(groupId: string): Promise<Group[]> {
  const { data, error } = await supabase
    .from("squad_follows")
    .select(`created_at, followed:groups!squad_follows_followed_group_id_fkey(${GROUP_FIELDS})`)
    .eq("follower_group_id", groupId)
    .order("created_at", { ascending: false });
  if (error) throw error;

  return (data ?? [])
    .filter((row: any) => row.followed)
    .map((row: any) => toGroup(row.followed));
}

export async function getFollowerIds(groupId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from("squad_follows")
    .select("follower_group_id")
    .eq("followed_group_id", groupId);
  if (error) throw error;

  return (data ?? []).map((row: any) => row.follower_group_id as string);
}

export async function isFollowing(from: string, to: string): Promise<boolean> {
  const { data, error } = await supabase
    .from("squad_follows")
    .select("follower_group_id")
    .eq("follower_group_id", from)
    .eq("followed_group_id", to)
    .maybeSingle();
  if (error) throw error;

  return data !== null;
}

export async function followSquad(from: string, to: string): Promise<void> {
  const user = await requireUser();
  const { error } = await supabase
    .from("squad_follows")
    .insert({ follower_group_id: from, followed_group_id: to, created_by: user.id });
  if (error && error.code !== UNIQUE_VIOLATION) throw error;
}

export async function unfollowSquad(from: string, to: string): Promise<void> {
  const { error } = await supabase
    .from("squad_follows")
    .delete()
    .eq("follower_group_id", from)
    .eq("followed_group_id", to);
  if (error) throw error;
}
