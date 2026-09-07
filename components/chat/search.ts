
export const MIN_SEARCH_LENGTH = 2;

export function isSearchable(term: string): boolean {
  return term.trim().length >= MIN_SEARCH_LENGTH;
}

export function fold(text: string): string {
  return Array.from(text)
    .map(function (ch) {
      const lower = ch.toLowerCase();
      const step1 = lower.length === ch.length ? lower : ch;

      const bare = step1.normalize('NFD').replace(/[̀-ͯ]/g, '');
      const step2 = bare.length === step1.length ? bare : step1;

      const again = step2.toLowerCase();
      const step3 = again.length === step2.length ? again : step2;

      return step3 === 'ς' ? 'σ' : step3;
    })
    .join('');
}

export type Part = { text: string; match: boolean };

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
    parts.push({ text: text.slice(at, at + needle.length), match: true });
    from = at + needle.length;
  }

  if (from < text.length) {
    parts.push({ text: text.slice(from), match: false });
  }

  return parts.length === 0 ? [{ text, match: false }] : parts;
}

export function snippet(text: string, term: string, radius: number = 40): string {
  const needle = fold(term.trim());
  const at = needle.length === 0 ? -1 : fold(text).indexOf(needle);

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
