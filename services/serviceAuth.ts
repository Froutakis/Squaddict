import { supabase } from "./supabaseClient";

export type User = {
  id: string;
  name: string;
  isOnline: boolean;
}

export async function register(email: string, password: string, displayName: string) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { display_name: displayName } },
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
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}
