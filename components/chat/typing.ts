// «Ο Χ γράφει…» — η καθαρή λογική, χωριστά από την οθόνη.
//
// Το typing δεν περνάει από πίνακα: είναι εφήμερο, και μια γραμμή ανά
// πληκτρολόγηση θα ήταν παράλογη. Ταξιδεύει σαν broadcast πάνω στο κανάλι της
// συνομιλίας, που σημαίνει ότι δεν υπάρχει «σβήσιμο» — μόνο σιωπή.
//
// Γι' αυτό κάθε ένδειξη λήγει μόνη της. Αν κάποιος κλείσει το tab στη μέση μιας
// λέξης, το «γράφει…» θα έμενε για πάντα αναμμένο.

/** Πόσο ζει μια ένδειξη από τη στιγμή που ήρθε. */
export const TYPING_TTL_MS = 4000;

/**
 * Πόσο συχνά στέλνουμε ενώ κάποιος πληκτρολογεί. Πρέπει να είναι αισθητά
 * μικρότερο από το TTL, αλλιώς η ένδειξη σβήνει ανάμεσα σε δύο αποστολές και
 * το «γράφει…» αναβοσβήνει.
 */
export const TYPING_THROTTLE_MS = 1500;

export type Typist = {
  id: string;
  /** Μπορεί να είναι κενό: το broadcast δεν ξέρει τα profiles. */
  name: string;
  /** Πότε ήρθε το τελευταίο σημάδι ζωής, σε ms. */
  at: number;
};

/**
 * Καταγράφει ένα σημάδι ζωής. Ένας χρήστης εμφανίζεται μία φορά — το νέο
 * γεγονός ανανεώνει το `at` του αντί να προσθέσει δεύτερη εγγραφή.
 *
 * Γυρίζει την ΙΔΙΑ αναφορά όταν τίποτα δεν άλλαξε ουσιαστικά, ώστε η οθόνη να
 * μην ξανασχεδιάζεται σε κάθε πάτημα πλήκτρου του άλλου.
 */
export function noteTyping(entries: Typist[], event: Typist): Typist[] {
  const index = entries.findIndex((entry) => entry.id === event.id);
  if (index === -1) {
    return [...entries, event];
  }

  const current = entries[index];
  if (current.at === event.at && current.name === event.name) {
    return entries;
  }

  const next = entries.slice();
  // Το όνομα κρατιέται αν το νέο γεγονός ήρθε χωρίς — δεν το χάνουμε στη μέση.
  next[index] = { ...event, name: event.name || current.name };
  return next;
}

/**
 * Όσοι γράφουν ακόμα, σε σταθερή σειρά.
 *
 * Ταξινομούμε με το όνομα και όχι με τον χρόνο άφιξης: αλλιώς το «Άννα και
 * Βασίλης» θα γινόταν «Βασίλης και Άννα» μόλις ο Βασίλης πατούσε ένα πλήκτρο.
 */
export function activeTypists(entries: Typist[], now: number): Typist[] {
  return entries
    .filter((entry) => now - entry.at < TYPING_TTL_MS)
    .sort(function (a, b) {
      if (a.name !== b.name) return a.name < b.name ? -1 : 1;
      return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
    });
}

/** `null` σημαίνει «μη δείξεις τίποτα». */
export function typingLabel(names: string[]): string | null {
  if (names.length === 0) {
    return null;
  }

  // Το broadcast δεν κάνει join με τα profiles, οπότε ένα όνομα μπορεί να λείπει.
  const shown = names.map((name) => name.trim() || 'Someone');

  if (shown.length === 1) {
    return `${shown[0]} is typing…`;
  }
  if (shown.length === 2) {
    return `${shown[0]} and ${shown[1]} are typing…`;
  }
  // Από τρεις και πάνω τα ονόματα δεν χωράνε σε μία γραμμή.
  return `${shown.length} people are typing…`;
}

/**
 * «5 members · 2 online». Το online μπαίνει μόνο όταν λέει κάτι: με έναν
 * παρόντα, αυτός είσαι εσύ, και το «1 online» είναι θόρυβος.
 */
export function presenceLabel(members: number, online: number): string {
  const base = `${members} ${members === 1 ? 'member' : 'members'}`;
  if (online < 2) {
    return base;
  }
  return `${base} · ${online} online`;
}
