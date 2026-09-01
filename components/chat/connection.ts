import type { ChatMessage } from '../../services/serviceGroup';

/**
 * Η κατάσταση της δικής μας σύνδεσης με το κανάλι της συνομιλίας.
 * Δεν αφορά το ποιος άλλος είναι online — αυτό είναι επόμενη φάση.
 */
export type Connection = 'connecting' | 'online' | 'offline';

/**
 * Μεταφράζει την κατάσταση που δίνει το Supabase στο .subscribe().
 *
 * Τα CHANNEL_ERROR και TIMED_OUT δεν σημαίνουν παραίτηση: ο client ξαναδοκιμάζει
 * μόνος του. Τα δείχνουμε όμως ως offline, γιατί από τη μεριά του χρήστη αυτό
 * είναι που ισχύει — αυτή τη στιγμή δεν έρχεται τίποτα.
 */
export function connectionFrom(status: string): Connection {
  if (status === 'SUBSCRIBED') {
    return 'online';
  }
  if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
    return 'offline';
  }
  // Ό,τι δεν αναγνωρίζουμε το θεωρούμε ενδιάμεσο και όχι αποτυχία: μια νέα
  // κατάσταση σε μελλοντική έκδοση δεν πρέπει να δείχνει ψεύτικο σφάλμα.
  return 'connecting';
}

/** Το κείμενο της μπάρας — null όταν όλα δουλεύουν, οπότε δεν δείχνουμε τίποτα. */
export function connectionLabel(connection: Connection): string | null {
  if (connection === 'online') return null;
  if (connection === 'connecting') return 'Connecting…';
  return 'Reconnecting…';
}

/**
 * Ενώνει μηνύματα που ήρθαν με το catch-up μέσα σε όσα ήδη κρατάμε.
 *
 * Τα διπλά είναι ο κανόνας, όχι η εξαίρεση: το catch-up ζητάει ό,τι είναι
 * νεότερο από το τελευταίο που ξέρουμε, και στο μεταξύ το κανάλι μπορεί να έχει
 * ήδη παραδώσει κάποια από αυτά. Κρατάμε πάντα την εκδοχή που είχαμε — είναι
 * ίδια γραμμή, και έτσι δεν αλλάζει η ταυτότητα του αντικειμένου χωρίς λόγο.
 */
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

  // Ταξινόμηση με το id ως δεύτερο κριτήριο: δύο μηνύματα με ίδιο createdAt
  // πρέπει να βγαίνουν πάντα με την ίδια σειρά, αλλιώς η λίστα αναπηδά.
  return [...existing, ...fresh].sort(function (a, b) {
    if (a.createdAt !== b.createdAt) {
      return a.createdAt < b.createdAt ? -1 : 1;
    }
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
}

/**
 * Αντικαθιστά ένα μήνυμα που άλλαξε — διορθώθηκε ή σβήστηκε.
 *
 * Δύο πράγματα κρατάει σκόπιμα:
 *
 * 1. Αν το id δεν υπάρχει στη λίστα, γυρίζει την ίδια λίστα αντί να το
 *    προσθέσει. Ένα UPDATE για μήνυμα που δεν έχουμε φορτώσει αφορά παλιότερη
 *    σελίδα ιστορικού· προσθέτοντάς το θα εμφανιζόταν στο τέλος της οθόνης, εκτός
 *    χρονολογικής σειράς.
 * 2. Αν τίποτα δεν άλλαξε πραγματικά, γυρίζει την ΙΔΙΑ αναφορά — έτσι η React
 *    δεν ξανασχεδιάζει τη λίστα για το echo της δικής μας αλλαγής.
 *
 * Η σειρά δεν πειράζεται ποτέ: ο trigger της βάσης απαγορεύει αλλαγή στο
 * created_at, οπότε ένα ενημερωμένο μήνυμα μένει εκεί που ήταν.
 */
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
  // Το όνομα αποστολέα δεν έρχεται με το realtime payload — το κρατάμε από την
  // εκδοχή που ήδη έχουμε, αλλιώς η φυσαλίδα θα έχανε το όνομά της μετά από edit.
  next[index] = { ...updated, senderName: updated.senderName || current.senderName };
  return next;
}
