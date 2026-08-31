// Αναζήτηση μηνυμάτων — η λογική που δεν αφορά ούτε βάση ούτε οθόνη.

/**
 * Κάτω από δύο χαρακτήρες δεν ψάχνουμε. Ένα γράμμα ταιριάζει σχεδόν παντού και
 * το αποτέλεσμα δεν λέει τίποτα — απλώς κοστίζει μια σάρωση.
 */
export const MIN_SEARCH_LENGTH = 2;

export function isSearchable(term: string): boolean {
  return term.trim().length >= MIN_SEARCH_LENGTH;
}

/**
 * Ισοπεδώνει πεζά/κεφαλαία ΚΑΙ τόνους.
 *
 * Τα ελληνικά κεφαλαία δεν έχουν τόνο: το «ΚΑΛΗΜΕΡΑ» σε πεζά γίνεται
 * «καλημερα», άτονο, και δεν ταιριάζει με το «καλημέρα» που πληκτρολόγησε ο
 * χρήστης. Χωρίς αυτό, η αναζήτηση χάνει κάθε μήνυμα γραμμένο με κεφαλαία —
 * και κάθε χρήστη που δεν μπαίνει στον κόπο να βάλει τόνους.
 *
 * ΚΡΙΣΙΜΟ: διατηρεί το μήκος. Η highlightParts κόβει το ΑΡΧΙΚΟ κείμενο με
 * δείκτες που βρίσκει πάνω στο ισοπεδωμένο — αν το ένα κοντύναινε, ο τονισμός
 * θα έπεφτε σε λάθος σημείο. Γι' αυτό κάθε βήμα γίνεται χαρακτήρα-χαρακτήρα και
 * κρατιέται μόνο αν δεν άλλαξε το μήκος.
 */
export function fold(text: string): string {
  return Array.from(text)
    .map(function (ch) {
      // Το toLowerCase δεν είναι αθώο: το 'İ' γίνεται ΔΥΟ χαρακτήρες. Ένα
      // σωστότερο γράμμα δεν αξίζει έναν τονισμό που πέφτει αλλού.
      const lower = ch.toLowerCase();
      const step1 = lower.length === ch.length ? lower : ch;

      const bare = step1.normalize('NFD').replace(/[̀-ͯ]/g, '');
      const step2 = bare.length === step1.length ? bare : step1;

      // Ξαναδοκιμάζουμε πεζά: η αποσύνθεση μπορεί να αποκάλυψε κεφαλαίο.
      const again = step2.toLowerCase();
      const step3 = again.length === step2.length ? again : step2;

      // Το τελικό σίγμα είναι ο ίδιος ήχος με το μεσαίο· κανείς δεν το
      // σκέφτεται όταν ψάχνει.
      return step3 === 'ς' ? 'σ' : step3;
    })
    .join('');
}

/** Ένα κομμάτι κειμένου, σημειωμένο ως ταίριασμα ή όχι. */
export type Part = { text: string; match: boolean };

/**
 * Κόβει το κείμενο στα σημεία που ταιριάζει ο όρος, ώστε η οθόνη να τα
 * τονίσει. Case-insensitive, όπως και η ίδια η αναζήτηση.
 *
 * Επιστρέφει το αρχικό κείμενο κομμάτι-κομμάτι, ΠΟΤΕ αλλαγμένο: ενώνοντας τα
 * `text` όλων των κομματιών παίρνεις πίσω ακριβώς την είσοδο. Έτσι δεν υπάρχει
 * περίπτωση να «διορθωθούν» τα πεζά/κεφαλαία του μηνύματος στην οθόνη.
 */
export function highlightParts(text: string, term: string): Part[] {
  const needle = term.trim();
  if (needle.length === 0 || text.length === 0) {
    return [{ text, match: false }];
  }

  const haystackLower = fold(text);
  const needleLower = fold(needle);

  const parts: Part[] = [];
  let from = 0;

  for (;;) {
    const at = haystackLower.indexOf(needleLower, from);
    if (at === -1) {
      break;
    }

    if (at > from) {
      parts.push({ text: text.slice(from, at), match: false });
    }
    // Κόβουμε με βάση το ΜΗΚΟΣ του όρου πάνω στο αρχικό κείμενο — όχι το ίδιο το
    // needle — ώστε να κρατηθούν τα κεφαλαία του μηνύματος.
    parts.push({ text: text.slice(at, at + needle.length), match: true });
    from = at + needle.length;
  }

  if (from < text.length) {
    parts.push({ text: text.slice(from), match: false });
  }

  return parts.length === 0 ? [{ text, match: false }] : parts;
}

/**
 * Κόβει ένα μεγάλο μήνυμα γύρω από το πρώτο ταίριασμα.
 *
 * Χωρίς αυτό, ένα μήνυμα 500 χαρακτήρων θα εμφανιζόταν με τον όρο κρυμμένο
 * κάπου έξω από την ορατή γραμμή — το αποτέλεσμα θα φαινόταν άσχετο.
 */
export function snippet(text: string, term: string, radius: number = 40): string {
  const needle = fold(term.trim());
  const at = needle.length === 0 ? -1 : fold(text).indexOf(needle);

  // Χωρίς ταίριασμα δεν μαντεύουμε — δείχνουμε την αρχή.
  if (at === -1) {
    return text.length > radius * 2 ? text.slice(0, radius * 2).trimEnd() + '…' : text;
  }

  const start = Math.max(0, at - radius);
  const end = Math.min(text.length, at + needle.length + radius);

  let out = text.slice(start, end);
  if (start > 0) out = '…' + out;
  if (end < text.length) out = out + '…';
  return out;
}
