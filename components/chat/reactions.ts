// Αντιδράσεις — η λογική χωρίς βάση και χωρίς οθόνη.
//
// Μία αντίδραση ανά άτομο ανά μήνυμα. Το πάτημα του ίδιου emoji τη σβήνει, το
// πάτημα άλλου την αντικαθιστά.

/** Ποιος αντέδρασε και με τι. Ένα άτομο εμφανίζεται το πολύ μία φορά. */
export type Reaction = { messageId: string; userId: string; emoji: string };

/** Οι αντιδράσεις όλων των μηνυμάτων που έχουμε φορτώσει, ανά message id. */
export type ReactionMap = Record<string, Reaction[]>;

/** Ένα emoji με το πλήθος του — έτοιμο για chip κάτω από τη φυσαλίδα. */
export type ReactionCount = { emoji: string; count: number; mine: boolean };

/**
 * Τι πρέπει να γίνει όταν πατηθεί ένα emoji.
 *
 * `clear` όταν ξαναπατάς αυτό που ήδη έβαλες — αλλιώς δεν θα υπήρχε τρόπος να
 * πάρεις πίσω μια αντίδραση.
 */
export function actionFor(mine: string | null, pressed: string): 'clear' | 'set' {
  return mine === pressed ? 'clear' : 'set';
}

/** Η δική μου αντίδραση σε ένα μήνυμα, αν υπάρχει. */
export function myReaction(list: Reaction[] | undefined, myId: string): string | null {
  if (!list) return null;
  const found = list.find((entry) => entry.userId === myId);
  return found ? found.emoji : null;
}

/**
 * Ομαδοποιεί σε chips.
 *
 * Ταξινόμηση: πρώτα τα πολυπληθέστερα, και με ισοπαλία αλφαβητικά στο emoji.
 * Το δεύτερο κριτήριο δεν είναι καλλωπισμός — χωρίς αυτό δύο emoji με ίδιο
 * πλήθος θα άλλαζαν θέση σε κάθε ανανέωση και η σειρά θα αναπηδούσε.
 */
export function summarise(list: Reaction[] | undefined, myId: string): ReactionCount[] {
  if (!list || list.length === 0) {
    return [];
  }

  const counts = new Map<string, { count: number; mine: boolean }>();
  for (const entry of list) {
    const current = counts.get(entry.emoji) ?? { count: 0, mine: false };
    current.count += 1;
    if (entry.userId === myId) {
      current.mine = true;
    }
    counts.set(entry.emoji, current);
  }

  return Array.from(counts, function ([emoji, info]) {
    return { emoji, count: info.count, mine: info.mine };
  }).sort(function (a, b) {
    if (a.count !== b.count) return b.count - a.count;
    return a.emoji < b.emoji ? -1 : a.emoji > b.emoji ? 1 : 0;
  });
}

/**
 * Βάζει ή ενημερώνει μια αντίδραση.
 *
 * Επειδή ένα άτομο έχει το πολύ μία, η εισαγωγή αντικαθιστά τη δική του γραμμή
 * αντί να προστεθεί δίπλα της. Γυρίζει την ΙΔΙΑ αναφορά όταν τίποτα δεν άλλαξε,
 * ώστε το echo της δικής μας ενέργειας να μην ξανασχεδιάζει τη λίστα.
 */
export function putReaction(map: ReactionMap, reaction: Reaction): ReactionMap {
  const list = map[reaction.messageId] ?? [];
  const index = list.findIndex((entry) => entry.userId === reaction.userId);

  if (index !== -1 && list[index].emoji === reaction.emoji) {
    return map;
  }

  const next = list.slice();
  if (index === -1) {
    next.push(reaction);
  } else {
    next[index] = reaction;
  }

  return { ...map, [reaction.messageId]: next };
}

/** Αφαιρεί την αντίδραση ενός ατόμου. */
export function dropReaction(
  map: ReactionMap,
  messageId: string,
  userId: string,
): ReactionMap {
  const list = map[messageId];
  if (!list) {
    return map;
  }

  const next = list.filter((entry) => entry.userId !== userId);
  if (next.length === list.length) {
    return map;
  }

  // Κρατάμε άδειο πίνακα αντί να σβήσουμε το κλειδί: η διαφορά είναι «φορτώθηκε
  // και δεν έχει καμία» έναντι «δεν φορτώθηκε ποτέ», και μόνο η δεύτερη πρέπει
  // να ξαναζητηθεί από τη βάση.
  return { ...map, [messageId]: next };
}

/** Ενώνει ό,τι ήρθε από τη βάση με ό,τι ήδη ξέρουμε. */
export function mergeReactions(map: ReactionMap, incoming: Reaction[]): ReactionMap {
  const byMessage: ReactionMap = {};
  for (const entry of incoming) {
    (byMessage[entry.messageId] ??= []).push(entry);
  }
  return { ...map, ...byMessage };
}
