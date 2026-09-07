import type { ChatMessage } from '../../services/serviceGroup';

export type Connection = 'connecting' | 'online' | 'offline';

export function connectionFrom(status: string): Connection {
  if (status === 'SUBSCRIBED') {
    return 'online';
  }
  if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
    return 'offline';
  }
  return 'connecting';
}

export function connectionLabel(connection: Connection): string | null {
  if (connection === 'online') return null;
  if (connection === 'connecting') return 'Connecting…';
  return 'Reconnecting…';
}

export function mergeNewMessages(
  existing: ChatMessage[],
  incoming: ChatMessage[],
): ChatMessage[] {
  if (incoming.length === 0) {
    return existing;
  }

  const known = new Set(existing.map((message) => message.id));
  const fresh = incoming.filter((message) => !known.has(message.id));

  if (fresh.length === 0) {
    return existing;
  }

  return [...existing, ...fresh].sort(function (a, b) {
    if (a.createdAt !== b.createdAt) {
      return a.createdAt < b.createdAt ? -1 : 1;
    }
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
}

export function applyMessageUpdate(
  existing: ChatMessage[],
  updated: ChatMessage,
): ChatMessage[] {
  const index = existing.findIndex((message) => message.id === updated.id);
  if (index === -1) {
    return existing;
  }

  const current = existing[index];
  const same =
    current.content === updated.content &&
    current.editedAt === updated.editedAt &&
    current.deletedAt === updated.deletedAt;
  if (same) {
    return existing;
  }

  const next = existing.slice();
  next[index] = { ...updated, senderName: updated.senderName || current.senderName };
  return next;
}
