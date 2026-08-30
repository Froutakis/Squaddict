import type { ChatMessage } from '../../services/serviceGroup';

/**
 * Μήνυμα που έχει εμφανιστεί στην οθόνη αλλά δεν έχει επιβεβαιωθεί από τη βάση.
 * Ζει χωριστά από τα ChatMessage ώστε ο τύπος του service να μη γεμίσει
 * καταστάσεις που αφορούν μόνο την οθόνη.
 */
export type OutgoingMessage = {
  id: string;
  content: string;
  createdAt: string;
  status: 'pending' | 'failed';
};

/** Ό,τι μπαίνει στη λίστα: είτε μήνυμα, είτε διαχωριστικό ημέρας. */
export type Row =
  | { kind: 'date'; id: string; label: string }
  | {
      kind: 'message';
      id: string;
      message: ChatMessage;
      isFirst: boolean;
      isLast: boolean;
      /** Λείπει για όσα έχουν επιβεβαιωθεί. */
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

/**
 * Χτίζει τη λίστα: διαχωριστικό σε κάθε αλλαγή ημέρας, και σημάδια για το πρώτο
 * και το τελευταίο μήνυμα κάθε σερί του ίδιου αποστολέα — εκεί μπαίνουν όνομα,
 * avatar και ώρα, ώστε τα ενδιάμεσα να κολλάνε μεταξύ τους.
 *
 * Τα `outgoing` είναι δικά μου μηνύματα που δεν έχουν επιβεβαιωθεί ακόμα. Μπαίνουν
 * στο τέλος — είναι πάντα τα νεότερα — αλλά περνούν από την ΙΔΙΑ λογική σερί με
 * τα υπόλοιπα. Αν τα κολλούσαμε απ' έξω, ένα μήνυμα που μόλις έστειλες δεν θα
 * ένωνε με τα προηγούμενα δικά σου, και η στήλη θα έσπαγε στα δύο μπροστά σου.
 */
export function buildRows(
  messages: ChatMessage[],
  outgoing: OutgoingMessage[] = [],
  me?: { id: string; name: string },
): Row[] {
  // Τα ανεπιβεβαίωτα φορούν σχήμα ChatMessage για να περάσουν από την ίδια
  // λογική· το status τα ξεχωρίζει ξανά μόλις φτιαχτεί η γραμμή.
  const pendingStatus = new Map<string, 'pending' | 'failed'>();
  const asMessages: ChatMessage[] = outgoing.map((item) => {
    pendingStatus.set(item.id, item.status);
    return {
      id: item.id,
      content: item.content,
      senderId: me?.id ?? '',
      senderName: me?.name ?? '',
      createdAt: item.createdAt,
      // Ένα μήνυμα που δεν έχει φτάσει ακόμα στη βάση δεν έχει διορθωθεί ούτε
      // σβηστεί — και δεν μπορεί: το μενού ανοίγει μόνο σε επιβεβαιωμένα.
      editedAt: null,
      deletedAt: null,
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
