import { supabase } from "./supabaseClient";
import type { User } from "./serviceAuth";
import { removeAvatar, squareImage, uploadAvatar, type PickedImage } from "./serviceMedia";

type ProfileRow = {
  id: string;
  display_name: string;
  avatar_url: string | null;
};

function toUser(r: ProfileRow): User {
  return {
    id: r.id,
    name: r.display_name,
    avatarUrl: r.avatar_url,
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
