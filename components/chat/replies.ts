// Απαντήσεις — η λογική που δεν αφορά ούτε βάση ούτε οθόνη.

import type { ChatMessage, ReplyQuote } from '../../services/serviceGroup';

/** Φτιάχνει παράθεση από ένα μήνυμα που έχουμε ήδη στη λίστα. */
export function quoteOf(message: ChatMessage): ReplyQuote {
  const deleted = message.deletedAt !== null;
  return {
    id: message.id,
    senderName: message.senderName,
    // Σβησμένο μήνυμα δεν παραθέτει κείμενο, ό,τι κι αν κρατάμε στη μνήμη.
    content: deleted ? '' : message.content,
    deleted,
  };
}

/**
 * Συμπληρώνει την παράθεση ενός μηνύματος που ήρθε από το realtime.
 *
 * Τα payload του postgres_changes είναι σκέτες γραμμές του πίνακα — δεν
 * περνούν από joins. Οπότε ένα μήνυμα που φτάνει ζωντανά έχει `replyTo` αλλά
 * `reply` κενό, και η παράθεση θα έλειπε μέχρι το επόμενο άνοιγμα.
 *
 * Το πρωτότυπο σχεδόν πάντα το έχουμε: απαντάς σε κάτι που βλέπεις. Όταν δεν
 * το έχουμε — απάντηση σε πολύ παλιό μήνυμα εκτός φορτωμένης σελίδας —
 * γυρίζουμε το μήνυμα ως έχει· η οθόνη δείχνει ουδέτερη ένδειξη αντί να
 * εφεύρει περιεχόμενο.
 *
 * Γυρίζει την ΙΔΙΑ αναφορά όποτε δεν υπάρχει τίποτα να συμπληρωθεί.
 */
export function resolveQuote(message: ChatMessage, known: ChatMessage[]): ChatMessage {
  if (message.replyTo === null || message.reply !== null) {
    return message;
  }

  const original = known.find((entry) => entry.id === message.replyTo);
  if (!original) {
    return message;
  }

  return { ...message, reply: quoteOf(original) };
}

/**
 * Ενημερώνει τις παραθέσεις που δείχνουν σε ένα μήνυμα που μόλις άλλαξε.
 *
 * Αυτό είναι το τίμημα της ζωντανής παράθεσης: όταν κάποιος διορθώσει ή σβήσει
 * ένα μήνυμα, κάθε απάντηση που το παραθέτει πρέπει να το δείξει. Η βάση το
 * κάνει μόνη της στο επόμενο φόρτωμα· εδώ το κάνουμε χωρίς να ξαναρωτήσουμε.
 *
 * Ίδια αναφορά όταν καμία παράθεση δεν δείχνει σε αυτό το μήνυμα — που είναι
 * και η συνηθισμένη περίπτωση.
 */
export function refreshQuotes(messages: ChatMessage[], changed: ChatMessage): ChatMessage[] {
  const quote = quoteOf(changed);

  let touched = false;
  const next = messages.map(function (entry) {
    if (entry.replyTo !== changed.id) {
      return entry;
    }
    if (
      entry.reply &&
      entry.reply.content === quote.content &&
      entry.reply.deleted === quote.deleted &&
      entry.reply.senderName === quote.senderName
    ) {
      return entry;
    }
    touched = true;
    return { ...entry, reply: quote };
  });

  return touched ? next : messages;
}

/**
 * Συμπληρώνει τις παραθέσεις μιας ολόκληρης σελίδας, η μία από την άλλη.
 *
 * Χρειάζεται επειδή δεν εμπιστευόμαστε πια το ενσωματωμένο πρωτότυπο του
 * ερωτήματος: σε αυτο-αναφορική σχέση το PostgREST μπορεί να γυρίσει την
 * ανάποδη κατεύθυνση, και μια λάθος παράθεση είναι χειρότερη από καμία.
 *
 * Ό,τι δεν βρεθεί μέσα στη σελίδα μένει κενό και η φυσαλίδα το λέει ρητά.
 */
export function resolveQuotes(messages: ChatMessage[]): ChatMessage[] {
  let touched = false;
  const next = messages.map(function (entry) {
    const filled = resolveQuote(entry, messages);
    if (filled !== entry) touched = true;
    return filled;
  });
  return touched ? next : messages;
}
