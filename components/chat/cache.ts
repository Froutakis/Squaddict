import type { ChatMessage } from '../../services/serviceChat';
import type { OutgoingMessage } from './messageRows';

export const CACHE_VERSION = 1;

export const CACHED_MESSAGES = 50;

const PREFIX = 'sq' + CACHE_VERSION + ':';

export function userPrefix(userId: string): string {
  return PREFIX + userId + ':';
}

export function groupsKey(userId: string): string {
  return userPrefix(userId) + 'squads';
}

export function messagesKey(userId: string, groupId: string): string {
  return userPrefix(userId) + 'msg:' + groupId;
}

export function outboxKey(userId: string, groupId: string): string {
  return userPrefix(userId) + 'out:' + groupId;
}

export function trimForCache(messages: ChatMessage[]): ChatMessage[] {
  return messages.length <= CACHED_MESSAGES
    ? messages
    : messages.slice(messages.length - CACHED_MESSAGES);
}

export function dropMissingImages(
  outbox: OutgoingMessage[],
  exists: (uri: string) => boolean,
): OutgoingMessage[] {
  const kept: OutgoingMessage[] = [];

  for (const item of outbox) {
    if (!item.image || exists(item.image.uri)) {
      kept.push(item);
      continue;
    }
    if (item.content.trim().length > 0) {
      kept.push({ ...item, image: undefined });
    }
  }

  return kept;
}

export function restoreOutbox(
  saved: OutgoingMessage[],
  history: ChatMessage[],
): OutgoingMessage[] {
  const confirmed = new Set(
    history.map(function (message) {
      return message.id;
    }),
  );

  return saved
    .filter(function (item) {
      return !confirmed.has(item.id);
    })
    .map(function (item) {
      return item.status === 'failed' ? item : { ...item, status: 'failed' as const };
    });
}
