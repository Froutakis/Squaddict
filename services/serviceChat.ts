import { supabase } from "./supabaseClient";
import { requireUser } from "./serviceAuth";
import { isSearchable } from "../components/chat/search";
import { previewText, type Attachment } from "../components/chat/media";
import type { Reaction } from "../components/chat/reactions";
import { UNIQUE_VIOLATION } from "../lib/postgres";

const SENDER = "profiles!sender_id(display_name)";

const REPLIED =
  "replied:messages!reply_to(id, content, sender_id, deleted_at, " + SENDER + ")";

const ATTACHMENT =
  "attachment_path, attachment_type, attachment_width, attachment_height";

const MESSAGE_FIELDS =
  "id, content, sender_id, created_at, edited_at, deleted_at, reply_to, " +
  ATTACHMENT + ", " + SENDER + ", " + REPLIED;

export async function sendMessage(
  groupId: string,
  senderId: string,
  content: string,
  id?: string,
  replyTo?: string | null,
  attachment?: Attachment | null,
): Promise<ChatMessage> {
  const row: {
    group_id: string;
    sender_id: string;
    content: string;
    id?: string;
    reply_to?: string;
    attachment_path?: string;
    attachment_type?: string;
    attachment_width?: number;
    attachment_height?: number;
  } = {
    group_id: groupId,
    sender_id: senderId,
    content,
  };
  if (id) {
    row.id = id;
  }
  if (replyTo) {
    row.reply_to = replyTo;
  }
  if (attachment) {
    row.attachment_path   = attachment.path;
    row.attachment_type   = attachment.type;
    row.attachment_width  = attachment.width;
    row.attachment_height = attachment.height;
  }

  const { data, error } = await supabase
    .from("messages")
    .insert(row)
    .select(MESSAGE_FIELDS)
    .single();

  if (error) {
    if (id && error.code === UNIQUE_VIOLATION) {
      const existing = await getMessageById(id);
      if (existing) return existing;
    }
    throw error;
  }

  return toChatMessage(data);
}

export async function editMessage(id: string, content: string): Promise<ChatMessage> {
  const { data, error } = await supabase
    .from("messages")
    .update({ content })
    .eq("id", id)
    .select(MESSAGE_FIELDS)
    .single();
  if (error) throw error;

  return toChatMessage(data);
}

export async function deleteMessage(id: string): Promise<ChatMessage> {
  const { data, error } = await supabase
    .from("messages")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id)
    .select(MESSAGE_FIELDS)
    .single();
  if (error) throw error;

  return toChatMessage(data);
}

export async function getMessageById(id: string): Promise<ChatMessage | null> {
  const { data, error } = await supabase
    .from("messages")
    .select(MESSAGE_FIELDS)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;

  return data ? toChatMessage(data) : null;
}

export type ReplyQuote = {
  id: string;
  senderName: string;
  content: string;
  deleted: boolean;
};

export type ChatMessage = {
  id: string;
  content: string;
  senderId: string;
  senderName: string;
  createdAt: string;
  editedAt: string | null;
  deletedAt: string | null;
  replyTo: string | null;
  reply: ReplyQuote | null;
  attachment: Attachment | null;
};

export function toChatMessage(row: any, senderName?: string): ChatMessage {
  return {
    id: row.id,
    content: row.content,
    senderId: row.sender_id,
    senderName: senderName ?? row.profiles?.display_name ?? "",
    createdAt: row.created_at,
    editedAt: row.edited_at ?? null,
    deletedAt: row.deleted_at ?? null,
    replyTo: row.reply_to ?? null,
    reply:
      row.replied && !Array.isArray(row.replied) ? toQuote(row.replied) : null,
    attachment: toAttachment(row),
  };
}

function toAttachment(row: any): Attachment | null {
  if (!row.attachment_path) {
    return null;
  }
  return {
    path: row.attachment_path,
    type: row.attachment_type ?? "image/jpeg",
    width: row.attachment_width ?? 0,
    height: row.attachment_height ?? 0,
  };
}

export function toQuote(row: any): ReplyQuote {
  const deleted = row.deleted_at !== null && row.deleted_at !== undefined;
  return {
    id: row.id,
    senderName: row.profiles?.display_name ?? "",
    content: deleted ? "" : row.content,
    deleted,
  };
}

export const MESSAGE_PAGE_SIZE = 50;

export type MessagePage = {
  messages: ChatMessage[];
  hasMore: boolean;
};

export async function getMessages(
  groupId: string,
  options: { before?: string; limit?: number } = {},
): Promise<MessagePage> {
  const limit = options.limit ?? MESSAGE_PAGE_SIZE;

  let query = supabase
    .from("messages")
    .select(MESSAGE_FIELDS)
    .eq("group_id", groupId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (options.before) {
    query = query.lt("created_at", options.before);
  }

  const { data, error } = await query;
  if (error) throw error;

  const rows = data ?? [];

  return {
    messages: rows.map((row) => toChatMessage(row)).reverse(),
    hasMore: rows.length === limit,
  };
}

export async function getMessagesAfter(
  groupId: string,
  since: string,
  limit: number = MESSAGE_PAGE_SIZE,
): Promise<MessagePage> {
  const { data, error } = await supabase
    .from("messages")
    .select(MESSAGE_FIELDS)
    .eq("group_id", groupId)
    .gt("created_at", since)
    .order("created_at", { ascending: true })
    .limit(limit);

  if (error) throw error;

  const rows = data ?? [];

  return {
    messages: rows.map((row) => toChatMessage(row)),
    hasMore: rows.length === limit,
  };
}

export type GroupPreview = {
  content: string;
  senderName: string;
  createdAt: string;
};

export async function getGroupPreviews(
  groupIds: string[],
): Promise<Record<string, GroupPreview>> {
  if (groupIds.length === 0) return {};

  const { data, error } = await supabase
    .from("messages")
    .select("group_id, content, created_at, attachment_path, " + SENDER)
    .in("group_id", groupIds)
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw error;

  const previews: Record<string, GroupPreview> = {};
  for (const row of (data ?? []) as any[]) {
    if (previews[row.group_id]) continue;
    previews[row.group_id] = {
      content: previewText(row.content, !!row.attachment_path),
      senderName: row.profiles?.display_name ?? "",
      createdAt: row.created_at,
    };
  }
  return previews;
}

export async function markGroupRead(groupId: string): Promise<void> {
  const { error } = await supabase.rpc("mark_group_read", {
    target_group: groupId,
  });
  if (error) throw error;
}

export async function getUnreadCounts(): Promise<Record<string, number>> {
  const { data, error } = await supabase.rpc("unread_counts");
  if (error) throw error;

  const counts: Record<string, number> = {};
  for (const row of (data ?? []) as any[]) {
    counts[row.squad] = row.unread;
  }
  return counts;
}

export type SearchHit = {
  id: string;
  content: string;
  senderId: string;
  senderName: string;
  createdAt: string;
};

export async function searchMessages(
  groupId: string,
  term: string,
  limit: number = 30,
): Promise<SearchHit[]> {
  if (!isSearchable(term)) return [];

  const { data, error } = await supabase.rpc("search_messages", {
    target_group: groupId,
    term: term.trim(),
    max_rows: limit,
  });
  if (error) throw error;

  return ((data ?? []) as any[]).map(function (row) {
    return {
      id: row.msg_id,
      content: row.msg_content,
      senderId: row.msg_sender_id,
      senderName: row.msg_sender_name ?? "",
      createdAt: row.msg_created_at,
    };
  });
}

export function toReaction(row: any): Reaction {
  return {
    messageId: row.message_id,
    userId: row.user_id,
    emoji: row.emoji,
  };
}

export async function getReactions(messageIds: string[]): Promise<Reaction[]> {
  if (messageIds.length === 0) return [];

  const { data, error } = await supabase
    .from("message_reactions")
    .select("message_id, user_id, emoji")
    .in("message_id", messageIds);
  if (error) throw error;

  return (data ?? []).map(toReaction);
}

export async function setReaction(messageId: string, emoji: string): Promise<void> {
  const user = await requireUser();

  const { error } = await supabase
    .from("message_reactions")
    .upsert(
      { message_id: messageId, user_id: user.id, emoji },
      { onConflict: "message_id,user_id" },
    );
  if (error) throw error;
}

export async function clearReaction(messageId: string): Promise<void> {
  const user = await requireUser();

  const { error } = await supabase
    .from("message_reactions")
    .delete()
    .eq("message_id", messageId)
    .eq("user_id", user.id);
  if (error) throw error;
}

export async function setMentions(
  messageId: string,
  userIds: string[],
): Promise<void> {
  try {
    let remove = supabase.from("message_mentions").delete().eq("message_id", messageId);
    if (userIds.length > 0) {
      remove = remove.not("user_id", "in", '("' + userIds.join('","') + '")');
    }

    const { error: gone } = await remove;
    if (gone) throw gone;

    if (userIds.length === 0) {
      return;
    }

    const { error } = await supabase.from("message_mentions").upsert(
      userIds.map(function (id) {
        return { message_id: messageId, user_id: id };
      }),
      { onConflict: "message_id,user_id", ignoreDuplicates: true },
    );
    if (error) throw error;
  } catch (problem) {
    console.error("[squaddict] οι αναφορές δεν καταγράφηκαν:", problem);
  }
}

export async function getMentionCounts(): Promise<Record<string, number>> {
  const { data, error } = await supabase.rpc("mention_counts");
  if (error) throw error;

  const counts: Record<string, number> = {};
  for (const row of (data ?? []) as any[]) {
    counts[row.squad] = row.mentions;
  }
  return counts;
}

