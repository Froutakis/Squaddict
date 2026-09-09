import type { EventPhoto, MyEvent } from '../../services/serviceEvents';
import { userPrefix } from '../chat/cache';
import { colors, sun } from '../../theme';

export type MemoryNight = {
  event: MyEvent;
  cover: EventPhoto;
};

export type SeenNights = Record<string, true>;

export const MEMORY_LIMIT = 12;

export function toMemoryNights(
  events: MyEvent[],
  covers: Record<string, EventPhoto>,
  today: string,
): MemoryNight[] {
  const nights: MemoryNight[] = [];

  for (const event of events) {
    const cover = covers[event.id];
    if (event.date < today && cover) {
      nights.push({ event, cover });
    }
  }

  return nights.reverse();
}

export function ringFor(night: MemoryNight, seen: boolean): string {
  if (night.event.myStatus === 'in') return sun;
  return seen ? colors.border : colors.primary;
}

export function seenNightsKey(userId: string): string {
  return userPrefix(userId) + 'seen:nights';
}

export function markSeen(seen: SeenNights, eventId: string): SeenNights {
  if (seen[eventId]) return seen;
  return { ...seen, [eventId]: true };
}

export function pruneSeen(seen: SeenNights, nights: MemoryNight[]): SeenNights {
  const live: SeenNights = {};

  for (const night of nights) {
    if (seen[night.event.id]) live[night.event.id] = true;
  }

  return live;
}

export function nightLabel(night: MemoryNight, seen: boolean): string {
  const parts = [night.event.groupName, night.event.title];
  if (night.event.myStatus === 'in') parts.push('you were in');
  else if (!seen) parts.push('new');
  return parts.join(', ');
}
