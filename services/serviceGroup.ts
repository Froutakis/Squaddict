import { supabase } from "./supabaseClient";
import { requireUser } from "./serviceAuth";
import { Group } from "../models/main";

/** Τα δημόσια πεδία μιας Παρέας — όσα επιτρέπεται να δει και ένας μη-μέλος. */
const GROUP_FIELDS = "id, handle, name, bio, avatar_url, member_count";

/** Ο κωδικός σφάλματος της Postgres για παραβίαση unique constraint. */
const UNIQUE_VIOLATION = "23505";

export const HANDLE_PATTERN = /^[a-z0-9_]{3,30}$/;

/** Μετατρέπει μια γραμμή του πίνακα groups σε Group. */
function toGroup(row: any): Group {
  return {
    id: row.id,
    handle: row.handle,
    name: row.name,
    bio: row.bio ?? null,
    avatarUrl: row.avatar_url ?? null,
    memberCount: row.member_count ?? 0,
  };
}

/**
 * Το handle γράφεται πάντα πεζό. Η βάση το επιβάλλει με check constraint —
 * εδώ το κάνουμε ώστε ο χρήστης να μη φάει σφάλμα επειδή πάτησε Shift.
 */
export function normalizeHandle(handle: string): string {
  return handle.trim().toLowerCase();
}

/**
 * Είναι ελεύθερο το handle; Ο έλεγχος είναι βοήθεια στον χρήστη, ΟΧΙ εγγύηση:
 * ανάμεσα σε αυτό και το insert μπορεί να το πάρει κάποιος άλλος. Η αληθινή
 * εγγύηση είναι το unique constraint, και γι' αυτό η createGroup πιάνει το 23505.
 */
export async function isHandleAvailable(handle: string): Promise<boolean> {
  const { data, error } = await supabase
    .from("groups")
    .select("id")
    .eq("handle", normalizeHandle(handle))
    .maybeSingle();
  if (error) throw error;

  return data === null;
}

export async function createGroup(handle: string, name: string): Promise<Group> {
  const user = await requireUser();
  const cleanHandle = normalizeHandle(handle);

  if (!HANDLE_PATTERN.test(cleanHandle)) {
    throw new Error("A squad handle is 3-30 characters: a-z, 0-9 and _ only.");
  }

  const { data, error } = await supabase
    .from("groups")
    .insert({ handle: cleanHandle, name: name.trim(), created_by: user.id })
    .select(GROUP_FIELDS)
    .single();

  if (error) {
    // Η κούρσα που περιγράφει η isHandleAvailable: κάποιος πρόλαβε.
    if (error.code === UNIQUE_VIOLATION) {
      throw new Error(`@${cleanHandle} is already taken.`);
    }
    throw error;
  }

  // Ο δημιουργός είναι και το πρώτο μέλος — και πρέπει να είναι, γιατί το
  // policy του group_invites απαιτεί να είσαι μέλος για να φτιάξεις κωδικό.
  await addMember(data.id, user.id);
  await rotateInviteCode(data.id);

  return toGroup(data);
}

export async function deleteGroup(groupId: string): Promise<void> {
  const { error } = await supabase
    .from("groups")
    .delete()
    .eq("id", groupId);
  if (error) throw error;
}

/** Αλλαγή του δημόσιου προφίλ. Το handle δεν αλλάζει — το κλειδώνει trigger. */
export async function updateGroupProfile(
  groupId: string,
  changes: { name?: string; bio?: string | null; avatarUrl?: string | null },
): Promise<Group> {
  const patch: Record<string, unknown> = {};
  if (changes.name !== undefined) patch.name = changes.name.trim();
  if (changes.bio !== undefined) patch.bio = changes.bio;
  if (changes.avatarUrl !== undefined) patch.avatar_url = changes.avatarUrl;

  const { data, error } = await supabase
    .from("groups")
    .update(patch)
    .eq("id", groupId)
    .select(GROUP_FIELDS)
    .single();
  if (error) throw error;

  return toGroup(data);
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

/** Φεύγω από την Παρέα. Το μόνο που επιτρέπεται σε κάθε μέλος για τον εαυτό του. */
export async function leaveGroup(groupId: string): Promise<void> {
  const user = await requireUser();
  await removeMember(groupId, user.id);
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
    .select(GROUP_FIELDS)
    .eq("id", id)
    .single();
  if (error) throw error;

  return toGroup(data);
}

export async function getGroupByHandle(handle: string): Promise<Group | null> {
  const { data, error } = await supabase
    .from("groups")
    .select(GROUP_FIELDS)
    .eq("handle", normalizeHandle(handle))
    .maybeSingle();
  if (error) throw error;

  return data ? toGroup(data) : null;
}

/**
 * Αναζήτηση Παρέας με handle ή όνομα. Αντικαθιστά το παλιό getAllGroups: το
 * "φέρε τα πάντα" δεν έχει θέση όταν οι Παρέες είναι λογαριασμοί.
 */
export async function searchSquads(query: string, limit = 20): Promise<Array<Group>> {
  const term = query.trim();
  if (term.length === 0) return [];

  const pattern = `%${term}%`;
  const { data, error } = await supabase
    .from("groups")
    .select(GROUP_FIELDS)
    .or(`handle.ilike.${pattern},name.ilike.${pattern}`)
    .order("member_count", { ascending: false })
    .limit(limit);
  if (error) throw error;

  return (data ?? []).map(toGroup);
}

export async function getGroupsForUser(userId: string): Promise<Array<Group>> {
  const { data, error } = await supabase
    .from("group_members")
    .select(`groups(${GROUP_FIELDS})`)
    .eq("user_id", userId);
  if (error) throw error;

  return (data ?? []).map((row: any) => toGroup(row.groups));
}

/** Ο κωδικός πρόσκλησης. Ορατός μόνο στα μέλη — το RLS τον κρύβει από τους άλλους. */
export async function getInviteCode(groupId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from("group_invites")
    .select("code")
    .eq("group_id", groupId)
    .maybeSingle();
  if (error) throw error;

  return data?.code ?? null;
}

/**
 * Ακυρώνει τον παλιό κωδικό και φτιάχνει καινούργιο, σε μία συναλλαγή — αλλιώς
 * μια διακοπή στη μέση αφήνει την Παρέα χωρίς κανέναν κωδικό πρόσκλησης.
 */
export async function rotateInviteCode(groupId: string): Promise<string> {
  const { data, error } = await supabase
    .rpc("rotate_invite_code", { target_group: groupId });
  if (error) throw error;

  return data as string;
}

/**
 * Μπαίνω σε Παρέα με κωδικό. Περνά υποχρεωτικά από RPC: ένας μη-μέλος δεν
 * βλέπει ούτε τον πίνακα των κωδικών ούτε μπορεί να γραφτεί μέλος σε Παρέα που
 * δεν του άνοιξε ο κωδικός.
 */
export async function joinByInviteCode(inviteCode: string): Promise<Group> {
  const { data, error } = await supabase
    .rpc("join_squad", { invite_code: inviteCode.trim().toUpperCase() });
  // Ένα και μόνο μήνυμα για κάθε αποτυχία: αν ξεχωρίζαμε το "λάθος κωδικός" από
  // το "δεν υπάρχει", ο κωδικός θα γινόταν μαντεύσιμος με δοκιμές.
  if (error || !data) throw new Error("That invite code is not valid.");

  return toGroup(data);
}

export async function sendMessage(groupId: string, senderId: string, content: string): Promise<void> {
  const { error } = await supabase
    .from("messages")
    .insert({ group_id: groupId, sender_id: senderId, content });
  if (error) throw error;
}

export type ChatMessage = {
  id: string;
  content: string;
  senderId: string;
  senderName: string;
  createdAt: string;
};

/** Μετατρέπει μια γραμμή του πίνακα messages σε ChatMessage. */
export function toChatMessage(row: any, senderName?: string): ChatMessage {
  return {
    id: row.id,
    content: row.content,
    senderId: row.sender_id,
    senderName: senderName ?? row.profiles?.display_name ?? "",
    createdAt: row.created_at,
  };
}

export async function getMessages(groupId: string): Promise<ChatMessage[]> {
  const { data, error } = await supabase
    .from("messages")
    .select("id, content, sender_id, created_at, profiles(display_name)")
    .eq("group_id", groupId)
    .order("created_at");
  if (error) throw error;

  return (data ?? []).map((row) => toChatMessage(row));
}

/** Χάρτης user_id → όνομα, για τα μηνύματα που έρχονται από το realtime (δεν φέρνουν προφίλ). */
export async function getMemberNames(groupId: string): Promise<Record<string, string>> {
  const members = await getMembers(groupId);

  const names: Record<string, string> = {};
  for (const m of members as any[]) {
    names[m.user_id] = m.profiles?.display_name ?? "";
  }
  return names;
}

/** Το τελευταίο μήνυμα μιας παρέας — για την προεπισκόπηση στη λίστα των chat. */
export type GroupPreview = {
  content: string;
  senderName: string;
  createdAt: string;
};

/**
 * Το τελευταίο μήνυμα κάθε παρέας, σε ένα ερώτημα. Φέρνουμε τα πιο πρόσφατα
 * μηνύματα όλων των παρεών μαζί και κρατάμε το πρώτο που συναντάμε ανά παρέα —
 * επειδή είναι ταξινομημένα από το νεότερο, αυτό είναι και το τελευταίο.
 */
export async function getGroupPreviews(
  groupIds: string[],
): Promise<Record<string, GroupPreview>> {
  if (groupIds.length === 0) return {};

  const { data, error } = await supabase
    .from("messages")
    .select("group_id, content, created_at, profiles(display_name)")
    .in("group_id", groupIds)
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw error;

  const previews: Record<string, GroupPreview> = {};
  for (const row of (data ?? []) as any[]) {
    if (previews[row.group_id]) continue;
    previews[row.group_id] = {
      content: row.content,
      senderName: row.profiles?.display_name ?? "",
      createdAt: row.created_at,
    };
  }
  return previews;
}
