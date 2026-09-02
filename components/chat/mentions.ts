import { fold } from './search';

/** Ένα μέλος της Παρέας, όπως το χρειάζονται οι αναφορές. */
export type Member = { id: string; name: string };

/** Πού βρίσκεται μια αναφορά μέσα στο κείμενο, και σε ποιον. */
export type MentionSpan = {
  start: number;
  end: number;
  userId: string;
  name: string;
};

export const MENTION_TRIGGER = '@';
export const MENTION_QUERY_MAX = 32;
export const MENTION_QUERY_SPACES = 2;
export const MENTION_SUGGESTIONS = 6;

const WORDY = /[\p{L}\p{N}_]/u;

/** Είναι γράμμα, ψηφίο ή κάτω παύλα; */
function wordy(ch: string | undefined): boolean {
  return ch !== undefined && WORDY.test(ch);
}

/** Βρίσκει όλες τις αναφορές σε ένα κείμενο, αγνοώντας τόνους και πεζά/κεφαλαία. */
export function findMentions(text: string, members: Member[]): MentionSpan[] {
  if (text.length === 0 || members.length === 0) {
    return [];
  }

  const folded = fold(text);
  const candidates = members
    .filter(function (member) {
      return member.name.trim().length > 0;
    })
    .map(function (member) {
      return { member, folded: fold(member.name) };
    })
    .sort(function (a, b) {
      return b.folded.length - a.folded.length;
    });

  const found: MentionSpan[] = [];
  let at = folded.indexOf(MENTION_TRIGGER);

  while (at !== -1) {
    if (!wordy(text[at - 1])) {
      const match = candidates.find(function (entry) {
        return (
          folded.startsWith(entry.folded, at + 1) &&
          !wordy(text[at + 1 + entry.folded.length])
        );
      });

      if (match) {
        const end = at + 1 + match.folded.length;
        found.push({ start: at, end, userId: match.member.id, name: match.member.name });
        at = folded.indexOf(MENTION_TRIGGER, end);
        continue;
      }
    }

    at = folded.indexOf(MENTION_TRIGGER, at + 1);
  }

  return found;
}

/** Τα ids όσων αναφέρονται, χωρίς επαναλήψεις. */
export function mentionIds(text: string, members: Member[]): string[] {
  const seen: string[] = [];
  for (const span of findMentions(text, members)) {
    if (!seen.includes(span.userId)) {
      seen.push(span.userId);
    }
  }
  return seen;
}

/** Αναφέρεται εμένα αυτό το μήνυμα; */
export function mentionsMe(text: string, members: Member[], meId: string): boolean {
  return findMentions(text, members).some(function (span) {
    return span.userId === meId;
  });
}

/** Ένα κομμάτι κειμένου· `userId` μόνο όταν είναι αναφορά. */
export type MentionPart = { text: string; userId: string | null };

/** Κόβει το κείμενο σε κομμάτια ώστε η οθόνη να τονίσει τις αναφορές. */
export function mentionParts(text: string, members: Member[]): MentionPart[] {
  const spans = findMentions(text, members);
  if (spans.length === 0) {
    return [{ text, userId: null }];
  }

  const parts: MentionPart[] = [];
  let from = 0;

  for (const span of spans) {
    if (span.start > from) {
      parts.push({ text: text.slice(from, span.start), userId: null });
    }
    parts.push({ text: text.slice(span.start, span.end), userId: span.userId });
    from = span.end;
  }

  if (from < text.length) {
    parts.push({ text: text.slice(from), userId: null });
  }

  return parts;
}

/** Τι πληκτρολογείται αυτή τη στιγμή μετά από '@', και από πού ξεκινά. */
export type MentionQuery = { at: number; query: string };

/** Ανοιχτή αναφορά πίσω από τον δρομέα, ή `null` αν δεν υπάρχει. */
export function mentionQuery(text: string, cursor: number): MentionQuery | null {
  const end = Math.max(0, Math.min(cursor, text.length));
  let spaces = 0;

  for (let i = end - 1; i >= 0 && end - i <= MENTION_QUERY_MAX + 1; i--) {
    const ch = text[i];

    if (ch === '\n') {
      return null;
    }

    if (ch === MENTION_TRIGGER) {
      return wordy(text[i - 1]) ? null : { at: i, query: text.slice(i + 1, end) };
    }

    if (ch === ' ') {
      spaces++;
      if (spaces > MENTION_QUERY_SPACES) {
        return null;
      }
    }
  }

  return null;
}

/** Ποιους προτείνει ο κατάλογος — πρώτα όσοι αρχίζουν από το κείμενο, μετά όσοι το περιέχουν. */
export function matchMembers(
  members: Member[],
  query: string,
  exclude?: string,
  limit: number = MENTION_SUGGESTIONS,
): Member[] {
  const needle = fold(query.trim());
  const scored: Array<{ member: Member; rank: number }> = [];

  for (const member of members) {
    if (member.id === exclude || member.name.trim().length === 0) {
      continue;
    }

    const name = fold(member.name);
    if (needle.length === 0 || name.startsWith(needle)) {
      scored.push({ member, rank: 0 });
    } else if (name.includes(needle)) {
      scored.push({ member, rank: 1 });
    }
  }

  scored.sort(function (a, b) {
    if (a.rank !== b.rank) return a.rank - b.rank;
    return a.member.name.localeCompare(b.member.name);
  });

  return scored.slice(0, limit).map(function (entry) {
    return entry.member;
  });
}

/** Το κείμενο μετά την επιλογή, και πού πρέπει να πάει ο δρομέας. */
export type MentionInsert = { text: string; cursor: number };

/** Αντικαθιστά ό,τι γράφτηκε μετά το '@' με το πλήρες όνομα. */
export function applyMention(
  text: string,
  found: MentionQuery,
  member: Member,
): MentionInsert {
  const before = text.slice(0, found.at);
  const after = text.slice(found.at + 1 + found.query.length);
  const inserted = MENTION_TRIGGER + member.name + (after.startsWith(' ') ? '' : ' ');

  return { text: before + inserted + after, cursor: before.length + inserted.length };
}

/** Χάρτης ονομάτων σε λίστα μελών, αλφαβητικά και χωρίς τα ανώνυμα. */
export function toMembers(names: Record<string, string>): Member[] {
  return Object.keys(names)
    .map(function (id) {
      return { id, name: names[id] ?? '' };
    })
    .filter(function (member) {
      return member.name.trim().length > 0;
    })
    .sort(function (a, b) {
      return a.name.localeCompare(b.name);
    });
}
