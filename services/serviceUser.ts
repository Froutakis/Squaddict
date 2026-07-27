import { supabase } from "./supabaseClient";
import { User } from "../models/main";

export async function getUserById(id: string): Promise<User | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;

  return new User(data.id, data.display_name, false);
}

export async function getAllUsers(): Promise<User[]> {
  const { data, error } = await supabase.from("profiles").select("*");
  if (error) throw error;

  return data.map((d) => new User(d.id, d.display_name, false));
}

export async function updateDisplayName(id: string, newName: string): Promise<void> {
  const { error } = await supabase
    .from("profiles")
    .update({ display_name: newName })
    .eq("id", id);
  if (error) throw error;
}
