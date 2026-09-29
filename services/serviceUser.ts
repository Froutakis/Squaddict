import { supabase } from "./supabaseClient";
import type { User } from "./serviceAuth";
import { getGroupsForUser, type Group } from "./serviceGroup";
import { pickActing } from "../lib/acting";
import { removeAvatar, squareImage, uploadAvatar, type PickedImage } from "./serviceMedia";

type ProfileRow = {
  id: string;
  display_name: string;
  avatar_url: string | null;
  created_at?: string | null;
};

function toUser(r: ProfileRow): User {
  return {
    id: r.id,
    name: r.display_name,
    avatarUrl: r.avatar_url,
    joinedAt: r.created_at ?? undefined,
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

export async function updateDisplayName(userId: string, name: string): Promise<void> {
  const { error } = await supabase
    .from("profiles")
    .update({ display_name: name.trim() })
    .eq("id", userId);

  // display_name is unique across Squaddict.
  if (error?.code === "23505") throw new Error("Someone already goes by that name. Try another.");
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

export async function setAvatar(
  userId: string,
  picked: PickedImage,
  previousUrl?: string | null,
): Promise<string> {
  const square = await squareImage(picked);
  const url = await uploadAvatar(userId, square);

  const { error } = await supabase.from("profiles").update({ avatar_url: url }).eq("id", userId);
  if (error) {
    await removeAvatar(url).catch(() => {});
    throw error;
  }

  if (previousUrl) await removeAvatar(previousUrl).catch(() => {});
  return url;
}

export async function clearAvatar(userId: string, previousUrl?: string | null): Promise<void> {
  const { error } = await supabase.from("profiles").update({ avatar_url: null }).eq("id", userId);
  if (error) throw error;

  if (previousUrl) await removeAvatar(previousUrl).catch(() => {});
}
