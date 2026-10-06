import { supabase } from "./supabaseClient";
import { requireUser } from "./serviceAuth";

export type ReportKind = "message" | "photo" | "plan" | "parea" | "person";

export type ReportTarget = {
  kind: ReportKind;
  id: string;
  // The person behind it, when there is one: they can be blocked too.
  userId?: string | null;
  userName?: string | null;
  // What is being reported, in words: "Marina's photo", "Jazz night".
  label: string;
};

// Who you blocked, kept in memory so the chat and the feeds can leave them out
// without asking the server each time. Loaded on sign in.
let blocked = new Set<string>();
const listeners = new Set<() => void>();

export function isBlocked(userId: string | null | undefined): boolean {
  return !!userId && blocked.has(userId);
}

export function onBlocksChanged(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function changed() {
  for (const listener of listeners) listener();
}

const LOAD_TRIES = 3;
const RETRY_MS = 1500;

function isMissingTable(error: { code?: string; message?: string }): boolean {
  const message = error.message ?? "";
  return error.code === "42P01" || error.code === "PGRST205" || (/user_blocks/.test(message) && /exist|schema cache/.test(message));
}

export async function loadBlocks(): Promise<void> {
  for (let attempt = 1; attempt <= LOAD_TRIES; attempt++) {
    const { data, error } = await supabase.from("user_blocks").select("blocked_id");
    if (!error) {
      blocked = new Set(((data ?? []) as { blocked_id: string }[]).map((row) => row.blocked_id));
      changed();
      return;
    }
    // Before safety.sql has run there is no table: nobody is blocked.
    if (isMissingTable(error)) return;
    // A bad connection at sign in must not quietly show blocked people again.
    if (attempt < LOAD_TRIES) await new Promise((resolve) => setTimeout(resolve, RETRY_MS * attempt));
  }
}

export type BlockedPerson = {
  id: string;
  // Null when their profile is out of reach (no shared parea any more).
  name: string | null;
  avatarUrl: string | null;
};

// The people you blocked, newest first, for Settings. Names come from profiles,
// which you can read only for people in a parea with you: the rest stay nameless.
export async function getBlockedPeople(): Promise<BlockedPerson[]> {
  const { data, error } = await supabase
    .from("user_blocks")
    .select("blocked_id, created_at")
    .order("created_at", { ascending: false });
  if (error) throw error;
  const ids = ((data ?? []) as { blocked_id: string }[]).map((row) => row.blocked_id);
  if (ids.length === 0) return [];

  const { data: profiles } = await supabase.from("profiles").select("id, display_name, avatar_url").in("id", ids);
  const byId = new Map(
    ((profiles ?? []) as { id: string; display_name: string | null; avatar_url: string | null }[]).map((p) => [p.id, p]),
  );
  return ids.map((id) => ({
    id,
    name: byId.get(id)?.display_name?.trim() || null,
    avatarUrl: byId.get(id)?.avatar_url ?? null,
  }));
}

export function forgetBlocks() {
  blocked = new Set();
  changed();
}

export async function blockUser(userId: string): Promise<void> {
  const user = await requireUser();
  if (userId === user.id) return;
  const { error } = await supabase
    .from("user_blocks")
    .upsert({ blocker_id: user.id, blocked_id: userId }, { onConflict: "blocker_id,blocked_id", ignoreDuplicates: true });
  if (error) throw error;
  blocked = new Set(blocked).add(userId);
  changed();
}

export async function unblockUser(userId: string): Promise<void> {
  const user = await requireUser();
  const { error } = await supabase.from("user_blocks").delete().eq("blocker_id", user.id).eq("blocked_id", userId);
  if (error) throw error;
  const next = new Set(blocked);
  next.delete(userId);
  blocked = next;
  changed();
}

export async function reportContent(target: ReportTarget, reason: string, note?: string): Promise<void> {
  const user = await requireUser();
  const { error } = await supabase.from("content_reports").insert({
    reporter_id: user.id,
    kind: target.kind,
    target_id: target.id,
    target_user_id: target.userId ?? null,
    reason,
    note: note?.trim() ? note.trim().slice(0, 500) : null,
  });
  if (error) throw error;
}
