import {
  messagesKey,
  outboxKey,
  groupsKey,
  trimForCache,
  userPrefix,
} from "../components/chat/cache";
import type { OutgoingMessage } from "../components/chat/messageRows";
import { keysWithPrefix, readJson, removeByPrefix, writeJson } from "../lib/store";
import type { Group } from "./serviceGroup";
import type { ChatMessage, GroupPreview } from "./serviceChat";

export type CachedGroups = {
  groups: Group[];
  previews: Record<string, GroupPreview>;
};

export async function readGroups(userId: string): Promise<CachedGroups | null> {
  return readJson<CachedGroups>(groupsKey(userId));
}

export async function writeGroups(
  userId: string,
  value: CachedGroups,
): Promise<void> {
  await writeJson(groupsKey(userId), value);
}

export async function readMessages(
  userId: string,
  groupId: string,
): Promise<ChatMessage[] | null> {
  return readJson<ChatMessage[]>(messagesKey(userId, groupId));
}

export async function writeMessages(
  userId: string,
  groupId: string,
  messages: ChatMessage[],
): Promise<void> {
  await writeJson(messagesKey(userId, groupId), trimForCache(messages));
}

export async function readOutbox(
  userId: string,
  groupId: string,
): Promise<OutgoingMessage[] | null> {
  return readJson<OutgoingMessage[]>(outboxKey(userId, groupId));
}

export async function writeOutbox(
  userId: string,
  groupId: string,
  outbox: OutgoingMessage[],
): Promise<void> {
  await writeJson(outboxKey(userId, groupId), outbox);
}

export async function referencedImages(userId: string): Promise<string[]> {
  const prefix = userPrefix(userId) + "out:";
  const uris: string[] = [];

  for (const key of await keysWithPrefix(prefix)) {
    const outbox = await readJson<OutgoingMessage[]>(key);
    for (const item of outbox ?? []) {
      if (item.image) {
        uris.push(item.image.uri);
      }
    }
  }
  return uris;
}

export async function clearCache(userId: string): Promise<void> {
  await removeByPrefix(userPrefix(userId));
}
