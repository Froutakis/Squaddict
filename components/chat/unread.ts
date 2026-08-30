// Η ετικέτα του badge αδιάβαστων.
//
// Ξεχωριστό αρχείο για τον ίδιο λόγο με το connection.ts: είναι καθαρή
// συνάρτηση, άρα δοκιμάζεται χωρίς να σηκωθεί οθόνη.

/** Πάνω από αυτό δεν δείχνουμε αριθμό αλλά "99+". */
export const UNREAD_CAP = 99;

/**
 * `null` σημαίνει «μη δείξεις badge». Επιστρέφουμε null αντί για κενό string
 * ώστε η οθόνη να ελέγχει την ύπαρξη και όχι το μήκος.
 *
 * Το μηδέν και οι αρνητικοί αριθμοί δίνουν null: αρνητικό δεν πρέπει να έρθει
 * ποτέ από τη βάση, αλλά ένα badge που γράφει "-3" είναι χειρότερο από κανένα.
 */
export function unreadLabel(count: number): string | null {
  if (!Number.isFinite(count) || count <= 0) {
    return null;
  }
  if (count > UNREAD_CAP) {
    return UNREAD_CAP + '+';
  }
  return String(Math.floor(count));
}
