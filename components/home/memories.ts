import type { EventPhoto, MyEvent } from '../../services/serviceEvents';
import { userPrefix } from '../chat/cache';
import { colors, sun } from '../../theme';

export type MemoryNight = {
  event: MyEvent;
  cover: EventPhoto;
  // Set for Explore highlights, where strangers cannot list who was in.
  goingCount?: number;
  // When the newest photo of the night was added.
  latestAt?: string;
};

// Per night: when its newest photo was when you watched it (true: older, unknown).
export type SeenNights = Record<string, true | string>;

export const MEMORY_LIMIT = 12;

export function toMemoryNights(
  events: MyEvent[],
  covers: Record<string, EventPhoto & { latestAt?: string }>,
  today: string,
): MemoryNight[] {
  const nights: MemoryNight[] = [];

  for (const event of events) {
    const cover = covers[event.id];
    if (event.date < today && cover) {
      nights.push({ event, cover, latestAt: cover.latestAt });
    }
  }

  return nights.reverse();
}

export function ringFor(night: MemoryNight, seen: boolean): string {
  if (night.event.myStatus === 'in') return sun;
  return seen ? colors.border : colors.primary;
}

export function seenNightsKey(userId: string, scope: 'home' | 'explore' = 'home'): string {
  return userPrefix(userId) + (scope === 'home' ? 'seen:nights' : 'seen:highlights');
}

// Seen, unless photos were added after you watched it.
export function isSeen(seen: SeenNights, night: MemoryNight): boolean {
  const mark = seen[night.event.id];
  if (!mark) return false;
  if (mark === true || !night.latestAt) return true;
  return mark >= night.latestAt;
}

export function markSeen(seen: SeenNights, night: MemoryNight): SeenNights {
  if (isSeen(seen, night) && seen[night.event.id] !== true) return seen;
  return { ...seen, [night.event.id]: night.latestAt ?? true };
}

export function pruneSeen(seen: SeenNights, nights: MemoryNight[]): SeenNights {
  const live: SeenNights = {};

  for (const night of nights) {
    const mark = seen[night.event.id];
    if (mark) live[night.event.id] = mark;
  }

  return live;
}

export function nightLabel(night: MemoryNight, seen: boolean): string {
  const parts = [night.event.groupName, night.event.title];
  if (night.event.myStatus === 'in') parts.push('you were in');
  else if (!seen) parts.push('new');
  return parts.join(', ');
}
