
export const TYPING_TTL_MS = 4000;

export const TYPING_THROTTLE_MS = 1500;

export type Typist = {
  id: string;
  name: string;
  at: number;
};

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
  next[index] = { ...event, name: event.name || current.name };
  return next;
}

export function activeTypists(entries: Typist[], now: number): Typist[] {
  return entries
    .filter((entry) => now - entry.at < TYPING_TTL_MS)
    .sort(function (a, b) {
      if (a.name !== b.name) return a.name < b.name ? -1 : 1;
      return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
    });
}

export function typingLabel(names: string[]): string | null {
  if (names.length === 0) {
    return null;
  }

  const shown = names.map((name) => name.trim() || 'Someone');

  if (shown.length === 1) {
    return `${shown[0]} is typing…`;
  }
  if (shown.length === 2) {
    return `${shown[0]} and ${shown[1]} are typing…`;
  }
  return `${shown.length} people are typing…`;
}

export function presenceLabel(members: number, online: number): string {
  const base = `${members} ${members === 1 ? 'member' : 'members'}`;
  if (online < 2) {
    return base;
  }
  return `${base} · ${online} online`;
}
