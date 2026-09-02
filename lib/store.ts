import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Τοπική αποθήκευση που δεν πετάει ποτέ.
 *
 * Ό,τι μπαίνει εδώ είναι αντίγραφο — η αλήθεια είναι στη βάση. Μια αποτυχία
 * σημαίνει «δεν έχουμε αντίγραφο», όχι «κάτι χάλασε».
 */

/** Διαβάζει και αποκωδικοποιεί· `null` σε οτιδήποτε πάει στραβά. */
export async function readJson<T>(key: string): Promise<T | null> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw === null ? null : (JSON.parse(raw) as T);
  } catch {
    return null;
  }
}

/** Γράφει· σιωπηλά αγνοεί την αποτυχία. */
export async function writeJson(key: string, value: unknown): Promise<void> {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Γεμάτος δίσκος ή quota — η εφαρμογή δουλεύει χωρίς αντίγραφο.
  }
}

/** Σβήνει ένα κλειδί. */
export async function removeKey(key: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(key);
  } catch {
    // ό,τι δεν σβήστηκε θα ξαναγραφτεί ή θα λήξει με την έκδοση του κλειδιού
  }
}

/** Τα κλειδιά που αρχίζουν από το πρόθεμα. */
export async function keysWithPrefix(prefix: string): Promise<string[]> {
  try {
    const keys = await AsyncStorage.getAllKeys();
    return keys.filter(function (key) {
      return key.startsWith(prefix);
    });
  } catch {
    return [];
  }
}

/** Σβήνει κάθε κλειδί που αρχίζει από το πρόθεμα. */
export async function removeByPrefix(prefix: string): Promise<void> {
  try {
    const mine = await keysWithPrefix(prefix);
    if (mine.length > 0) {
      await AsyncStorage.multiRemove(mine);
    }
  } catch {
    // σιωπηλά
  }
}
