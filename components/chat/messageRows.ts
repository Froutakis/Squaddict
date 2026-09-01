import type { ChatMessage } from '../../services/serviceGroup';

export type OutgoingMessage = {
  id: string;
  content: string;
  createdAt: string;
  status: 'pending' | 'failed';
};

export type Row =
  | { kind: 'date'; id: string; label: string }
  | {
      kind: 'message';
      id: string;
      message: ChatMessage;
      isFirst: boolean;
      isLast: boolean;
      status?: 'pending' | 'failed';
    };

function dayKey(date: Date) {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

function dayLabel(date: Date) {
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  if (dayKey(date) === dayKey(today)) return 'Today';
  if (dayKey(date) === dayKey(yesterday)) return 'Yesterday';

  return date.toLocaleDateString('en-US', {
    day: 'numeric',
    month: 'short',
    ...(date.getFullYear() === today.getFullYear() ? {} : { year: 'numeric' }),
  });
}

export function buildRows(
  messages: ChatMessage[],
  outgoing: OutgoingMessage[] = [],
  me?: { id: string; name: string },
): Row[] {
  const pendingStatus = new Map<string, 'pending' | 'failed'>();
  const asMessages: ChatMessage[] = outgoing.map((item) => {
    pendingStatus.set(item.id, item.status);
    return {
      id: item.id,
      content: item.content,
      senderId: me?.id ?? '',
      senderName: me?.name ?? '',
      createdAt: item.createdAt,
    };
  });

  const all = outgoing.length === 0 ? messages : [...messages, ...asMessages];
  const rows: Row[] = [];

  all.forEach((message, i) => {
    const date = new Date(message.createdAt);
    const prev = all[i - 1];
    const next = all[i + 1];

    const startsDay = !prev || dayKey(new Date(prev.createdAt)) !== dayKey(date);
    const endsDay = !next || dayKey(new Date(next.createdAt)) !== dayKey(date);

    if (startsDay) {
      rows.push({ kind: 'date', id: `date-${message.id}`, label: dayLabel(date) });
    }

    rows.push({
      kind: 'message',
      id: message.id,
      message,
      isFirst: startsDay || prev.senderId !== message.senderId,
      isLast: endsDay || next.senderId !== message.senderId,
      status: pendingStatus.get(message.id),
    });
  });

  return rows;
}
