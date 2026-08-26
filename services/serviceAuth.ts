import { supabase } from "./supabaseClient";

/**
 * Το προφίλ ΔΕΝ φτιάχνεται εδώ. Το φτιάχνει ο trigger `on_auth_user_created`
 * μέσα στην ίδια συναλλαγή με τον χρήστη, διαβάζοντας το display_name από τα
 * metadata που στέλνουμε παρακάτω.
 *
 * Ο λόγος: με email confirmation ανοιχτό δεν υπάρχει session αμέσως μετά το
 * signUp, οπότε ένα insert από τη συσκευή θα το απέρριπτε το RLS — και ο
 * χρήστης θα έμενε με λογαριασμό χωρίς προφίλ. Επειδή το group_members και το
 * messages έχουν foreign key προς το profiles, ένας τέτοιος λογαριασμός δεν
 * μπορεί ούτε να μπει σε Παρέα ούτε να στείλει μήνυμα, για πάντα.
 */
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
