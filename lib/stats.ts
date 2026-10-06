import { keyOf, parseLocal } from './datetime';

type Night = {
  date: string;
  myStatus?: 'in' | 'maybe' | 'out';
  groupName: string;
  location?: string;
  placeLabel?: string;
};

// Nights you were in, before today, newest first.
export function pastNights<T extends Night>(events: T[], today: string): T[] {
  return events
    .filter((event) => event.myStatus === 'in' && event.date < today)
    .sort((a, b) => b.date.localeCompare(a.date));
}

// The most frequent value, ties broken by what came first.
export function topBy<T>(items: T[], pick: (item: T) => string | undefined): string | null {
  const counts = new Map<string, number>();
  let best: string | null = null;

  for (const item of items) {
    const value = pick(item)?.trim();
    if (!value) continue;

    const count = (counts.get(value) ?? 0) + 1;
    counts.set(value, count);
    if (best === null || count > (counts.get(best) ?? 0)) best = value;
  }

  return best;
}

function weekOf(dateKey: string): string {
  const day = parseLocal(dateKey);
  const monday = new Date(day.getFullYear(), day.getMonth(), day.getDate() - ((day.getDay() + 6) % 7));
  return keyOf(monday);
}

// Weeks in a row with at least one night out. This week still counts as
// "in progress": the streak runs from last week if there's nothing yet.
export function weekStreak(dates: string[], today: string): number {
  const weeks = new Set(dates.map(weekOf));
  const cursor = parseLocal(weekOf(today));

  if (!weeks.has(keyOf(cursor))) cursor.setDate(cursor.getDate() - 7);

  let streak = 0;
  while (weeks.has(keyOf(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 7);
  }
  return streak;
}

export type MonthGroup<T> = { key: string; label: string; items: T[] };

// Newest month first; the year shows only when it isn't this one.
export function byMonth<T extends { date: string }>(items: T[], today: string): MonthGroup<T>[] {
  const groups = new Map<string, MonthGroup<T>>();
  const thisYear = today.slice(0, 4);

  for (const item of items) {
    const key = item.date.slice(0, 7);
    let group = groups.get(key);

    if (!group) {
      const month = parseLocal(`${key}-01`).toLocaleDateString('en-US', { month: 'long' });
      group = { key, label: key.startsWith(thisYear) ? month : `${month} ${key.slice(0, 4)}`, items: [] };
      groups.set(key, group);
    }
    group.items.push(item);
  }

  return [...groups.values()].sort((a, b) => b.key.localeCompare(a.key));
}
