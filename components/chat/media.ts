/** Πάνω από αυτό δεν ανεβάζουμε καν — ο έλεγχος γίνεται και στο bucket. */
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

/** Η μεγαλύτερη πλευρά μετά τη σμίκρυνση. */
export const MAX_DIMENSION = 1600;

/** Πόσο ζει ένας υπογεγραμμένος σύνδεσμος. */
export const SIGNED_URL_TTL_SECONDS = 60 * 60;

/** Ζητάμε νέο σύνδεσμο τόσο πριν λήξει, ώστε να μη σβήσει εικόνα στην οθόνη. */
const RENEW_BEFORE_MS = 5 * 60 * 1000;

/** Οι τύποι που δέχεται το bucket. */
export const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

/** Το συνημμένο ενός μηνύματος. */
export type Attachment = {
  path: string;
  type: string;
  width: number;
  height: number;
};

/**
 * Η διαδρομή του αρχείου.
 *
 * Ο πρώτος φάκελος είναι η Παρέα — πάνω σε αυτόν κρίνει το policy ποιος
 * διαβάζει. Το όνομα είναι το id του μηνύματος, που το φτιάχνει η συσκευή πριν
 * την αποστολή: έτσι η επανάληψη γράφει πάνω στο ίδιο αρχείο αντί να αφήσει
 * δεύτερο.
 */
export function attachmentPath(groupId: string, messageId: string): string {
  return groupId + '/' + messageId + '.jpg';
}

/** Οι διαστάσεις μετά τη σμίκρυνση, με διατήρηση αναλογίας. */
export function fitWithin(
  width: number,
  height: number,
  max: number = MAX_DIMENSION,
): { width: number; height: number } {
  const longest = Math.max(width, height);
  if (longest <= max || longest === 0) {
    return { width, height };
  }

  const scale = max / longest;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

/**
 * Πόσο χώρο πιάνει η εικόνα στη φυσαλίδα.
 *
 * Υπολογίζεται από τις αποθηκευμένες διαστάσεις και όχι από το αρχείο, ώστε η
 * θέση της να είναι γνωστή πριν φορτώσει — αλλιώς η λίστα πηδάει.
 */
export function bubbleSize(
  width: number,
  height: number,
  maxWidth: number,
  maxHeight: number,
): { width: number; height: number } {
  if (width <= 0 || height <= 0) {
    return { width: maxWidth, height: Math.round(maxWidth * 0.75) };
  }

  const scale = Math.min(maxWidth / width, maxHeight / height, 1);
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

/** Είναι αποδεκτό αρχείο για ανέβασμα; */
export function rejectionFor(
  type: string | undefined,
  bytes: number | undefined,
): string | null {
  if (type && !ALLOWED_TYPES.includes(type.toLowerCase())) {
    return 'That file type is not supported.';
  }
  if (bytes !== undefined && bytes > MAX_UPLOAD_BYTES) {
    return 'That photo is larger than 5 MB.';
  }
  return null;
}

/** Ένας υπογεγραμμένος σύνδεσμος και πότε παύει να είναι χρήσιμος. */
export type SignedUrl = { url: string; expiresAt: number };

export type SignedMap = Record<string, SignedUrl>;

/** Χρειάζεται νέα υπογραφή; */
export function needsSigning(entry: SignedUrl | undefined, now: number): boolean {
  return entry === undefined || entry.expiresAt - RENEW_BEFORE_MS <= now;
}

/** Ποιες διαδρομές δεν έχουν χρησιμοποιήσιμο σύνδεσμο αυτή τη στιγμή. */
export function pathsToSign(paths: string[], signed: SignedMap, now: number): string[] {
  const missing: string[] = [];
  for (const path of paths) {
    if (needsSigning(signed[path], now) && !missing.includes(path)) {
      missing.push(path);
    }
  }
  return missing;
}

/** Ίδια αναφορά όταν δεν άλλαξε τίποτα — η λίστα δεν ξαναρενδάρει τζάμπα. */
export function mergeSigned(previous: SignedMap, fresh: SignedMap): SignedMap {
  const keys = Object.keys(fresh);
  if (keys.length === 0) {
    return previous;
  }

  let changed = false;
  for (const key of keys) {
    if (previous[key]?.url !== fresh[key].url) {
      changed = true;
      break;
    }
  }

  return changed ? { ...previous, ...fresh } : previous;
}

/**
 * Τι γράφει η προεπισκόπηση στη λίστα Παρεών.
 *
 * Χωρίς αυτό, ένα μήνυμα που είναι μόνο φωτογραφία εμφανιζόταν ως κενή γραμμή.
 */
export function previewText(content: string, hasPhoto: boolean): string {
  if (!hasPhoto) {
    return content;
  }
  return content.trim().length > 0 ? '📷 ' + content : '📷 Photo';
}
