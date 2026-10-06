import { supabase } from "./supabaseClient";
import { clearCache } from "./serviceCache";
import { unregisterPush } from "./serviceNotifications";
import { removeAvatar, removeImage } from "./serviceMedia";
import { WEB_URL } from "../lib/config";

export type User = {
  id: string;
  name: string;
  avatarUrl?: string | null;
  joinedAt?: string;
  isOnline: boolean;
}

export async function register(email: string, password: string, displayName: string) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    // The confirmation link brings people back to the web app, signed in.
    options: { data: { display_name: displayName }, emailRedirectTo: WEB_URL },
  });
  if (error) throw error;

  if (!data.user) {
    throw new Error("Could not create your account.");
  }

  return data.user;
}

export async function login(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data.user;
}

// Emails a link to set a new password. The link opens the web app signed in,
// where App shows the new-password screen.
export async function sendPasswordReset(email: string) {
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: WEB_URL });
  if (error) throw error;
}

export async function updatePassword(password: string) {
  const { error } = await supabase.auth.updateUser({ password });
  if (error) throw error;
}

export async function getCurrentUser() {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;

  return data.user;
}

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) throw new Error("Sign in to continue.");

  return user;
}

export async function logout() {
  const { data } = await supabase.auth.getUser();
  if (data.user) {
    await clearCache(data.user.id);
  }

  await unregisterPush().catch(() => {});

  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

// Deletes the account for good. The profile stays behind as "Deleted user"
// so friends' chats keep their history (see supabase/delete_account.sql).
export async function deleteAccount(): Promise<void> {
  const user = await requireUser();

  // Files first, while the rows still say which ones are ours. Best effort:
  // a file that fails to go must not keep the account alive.
  const [{ data: photos }, { data: profile }] = await Promise.all([
    supabase.from("event_photos").select("path").eq("user_id", user.id),
    supabase.from("profiles").select("avatar_url").eq("id", user.id).maybeSingle(),
  ]);
  await Promise.all((photos ?? []).map((photo: { path: string }) => removeImage(photo.path)));
  if (profile?.avatar_url) await removeAvatar(profile.avatar_url).catch(() => {});

  await unregisterPush().catch(() => {});

  const { error } = await supabase.rpc("delete_account");
  if (error) throw error;

  await clearCache(user.id);
  await supabase.auth.signOut({ scope: "local" }).catch(() => {});
}
