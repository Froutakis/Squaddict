import type { ChatMessage } from '../../services/serviceGroup';

/** Ό,τι μπαίνει στη λίστα: είτε μήνυμα, είτε διαχωριστικό ημέρας. */
export type Row =
  | { kind: 'date'; id: string; label: string }
  | { kind: 'message'; id: string; message: ChatMessage; isFirst: boolean; isLast: boolean };

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

/**
 * Χτίζει τη λίστα: διαχωριστικό σε κάθε αλλαγή ημέρας, και σημάδια για το πρώτο
 * και το τελευταίο μήνυμα κάθε σερί του ίδιου αποστολέα — εκεί μπαίνουν όνομα,
 * avatar και ώρα, ώστε τα ενδιάμεσα να κολλάνε μεταξύ τους.
 */
export function buildRows(messages: ChatMessage[]): Row[] {
  const rows: Row[] = [];

  messages.forEach((message, i) => {
    const date = new Date(message.createdAt);
    const prev = messages[i - 1];
    const next = messages[i + 1];

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
    });
  });

  return rows;
}
