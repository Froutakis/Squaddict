import {
  messagesKey,
  outboxKey,
  squadsKey,
  trimForCache,
  userPrefix,
} from "../components/chat/cache";
import type { OutgoingMessage } from "../components/chat/messageRows";
import { keysWithPrefix, readJson, removeByPrefix, writeJson } from "../lib/store";
import type { ChatMessage, Group, GroupPreview } from "./serviceGroup";

/** Ό,τι χρειάζεται η λίστα Παρεών για να ζωγραφιστεί χωρίς δίκτυο. */
export type CachedSquads = {
  groups: Group[];
  previews: Record<string, GroupPreview>;
};

export async function readSquads(userId: string): Promise<CachedSquads | null> {
  return readJson<CachedSquads>(squadsKey(userId));
}

export async function writeSquads(
  userId: string,
  value: CachedSquads,
): Promise<void> {
  await writeJson(squadsKey(userId), value);
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

/** Κάθε τοπικό αρχείο που διεκδικεί κάποιο outbox, σε όλες τις Παρέες. */
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

/** Σβήνει ό,τι κρατάμε για έναν λογαριασμό. Καλείται στην αποσύνδεση. */
export async function clearCache(userId: string): Promise<void> {
  await removeByPrefix(userPrefix(userId));
}
