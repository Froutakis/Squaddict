import type { ChatMessage } from '../../services/serviceChat';
import { dayLabel, keyOf } from '../../lib/datetime';
import type { ChatEventItem } from './chatEvents';

export type OutgoingMessage = {
  id: string;
  content: string;
  createdAt: string;
  status: 'pending' | 'failed';
  replyTo?: string | null;
  image?: LocalImage;
};

export type LocalImage = { uri: string; width: number; height: number };

// Messages from one person run together while they keep writing; a pause
// longer than this starts a new run, with its own name and time.
export const RUN_GAP_MS = 10 * 60 * 1000;

export type Row =
  | { kind: 'date'; id: string; label: string; day: string; today: boolean }
  | {
      kind: 'message';
      id: string;
      message: ChatMessage;
      isFirst: boolean;
      isLast: boolean;
      status?: 'pending' | 'failed';
      image?: LocalImage;
    }
  // A plan, a vote or a memory of the parea, in its place in time.
  | { kind: 'event'; id: string; event: ChatEventItem };

type Item = { type: 'message'; at: string; message: ChatMessage } | { type: 'event'; at: string; event: ChatEventItem };

export function buildRows(
  messages: ChatMessage[],
  outgoing: OutgoingMessage[] = [],
  me?: { id: string; name: string },
  events: ChatEventItem[] = [],
): Row[] {
  const pendingStatus = new Map<string, 'pending' | 'failed'>();
  const pendingImage = new Map<string, LocalImage>();
  const asMessages: ChatMessage[] = outgoing.map((item) => {
    pendingStatus.set(item.id, item.status);
    if (item.image) {
      pendingImage.set(item.id, item.image);
    }
    return {
      id: item.id,
      content: item.content,
      senderId: me?.id ?? '',
      senderName: me?.name ?? '',
      createdAt: item.createdAt,
      editedAt: null,
      deletedAt: null,
      replyTo: null,
      reply: null,
      attachment: null,
    };
  });

  const all = outgoing.length === 0 ? messages : [...messages, ...asMessages];

  // The messages keep their order; each event goes in before the first
  // message written after it.
  const queue = events.slice().sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0));
  const items: Item[] = [];
  let next = 0;
  for (const message of all) {
    while (next < queue.length && queue[next].at < message.createdAt) {
      items.push({ type: 'event', at: queue[next].at, event: queue[next] });
      next += 1;
    }
    items.push({ type: 'message', at: message.createdAt, message });
  }
  for (; next < queue.length; next++) {
    items.push({ type: 'event', at: queue[next].at, event: queue[next] });
  }

  const todayKey = keyOf(new Date());
  const rows: Row[] = [];

  items.forEach((item, i) => {
    const date = new Date(item.at);
    const prev = items[i - 1];
    const after = items[i + 1];

    const startsDay = !prev || keyOf(new Date(prev.at)) !== keyOf(date);
    const endsDay = !after || keyOf(new Date(after.at)) !== keyOf(date);

    if (startsDay) {
      const day = keyOf(date);
      rows.push({ kind: 'date', id: `date-${itemId(item)}`, label: dayLabel(date), day, today: day === todayKey });
    }

    if (item.type === 'event') {
      rows.push({ kind: 'event', id: `event-${item.event.id}`, event: item.event });
      return;
    }

    const message = item.message;
    rows.push({
      kind: 'message',
      id: message.id,
      message,
      isFirst: startsDay || !sameRun(prev, item),
      isLast: endsDay || !sameRun(item, after),
      status: pendingStatus.get(message.id),
      image: pendingImage.get(message.id),
    });
  });

  return rows;
}

function itemId(item: Item): string {
  return item.type === 'message' ? item.message.id : item.event.id;
}

// Two messages in a row from the same person, close enough in time.
function sameRun(a: Item | undefined, b: Item | undefined): boolean {
  if (!a || !b || a.type !== 'message' || b.type !== 'message') return false;
  if (a.message.senderId !== b.message.senderId) return false;
  return new Date(b.at).getTime() - new Date(a.at).getTime() <= RUN_GAP_MS;
}
