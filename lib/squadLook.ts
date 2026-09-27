import type { EventPhoto, MyEvent } from '../services/serviceEvents';

export type SquadImageKind = 'avatar' | 'banner' | 'wallpaper';

export const SQUADS_BUCKET = 'squads';

const PUBLIC_MARKER = `/storage/v1/object/public/${SQUADS_BUCKET}/`;

export type SquadLook = {
  avatarUrl: string | null;
  bannerUrl: string | null;
  wallpaperUrl: string | null;
  memoriesPublic: boolean;
};

const FIELD: Record<SquadImageKind, 'avatarUrl' | 'bannerUrl' | 'wallpaperUrl'> = {
  avatar: 'avatarUrl',
  banner: 'bannerUrl',
  wallpaper: 'wallpaperUrl',
};

export function squadImagePath(groupId: string, kind: SquadImageKind, stamp: number): string {
  return `${groupId}/${kind}-${stamp}.jpg`;
}

export function squadPathFromUrl(url: string): string | null {
  const at = url.indexOf(PUBLIC_MARKER);
  if (at < 0) return null;

  const path = url.slice(at + PUBLIC_MARKER.length).split('?')[0];
  return path.length > 0 ? decodeURIComponent(path) : null;
}

export function urlOf(look: SquadLook, kind: SquadImageKind): string | null {
  return look[FIELD[kind]];
}

export function withImage(look: SquadLook, kind: SquadImageKind, url: string | null): SquadLook {
  return { ...look, [FIELD[kind]]: url };
}

export type SquadMemory = {
  event: MyEvent;
  cover: EventPhoto;
  photoCount: number;
};

export function toSquadMemories(
  events: MyEvent[],
  photos: EventPhoto[],
  today: string,
): SquadMemory[] {
  const byEvent: Record<string, EventPhoto[]> = {};
  for (const photo of photos) {
    (byEvent[photo.eventId] ??= []).push(photo);
  }

  const memories: SquadMemory[] = [];
  for (const event of events) {
    const roll = byEvent[event.id];
    if (event.date >= today || !roll || roll.length === 0) continue;

    let cover = roll[0];
    for (const photo of roll) {
      if (photo.createdAt < cover.createdAt) cover = photo;
    }
    memories.push({ event, cover, photoCount: roll.length });
  }

  return memories.sort((a, b) => (a.event.date < b.event.date ? 1 : a.event.date > b.event.date ? -1 : 0));
}

export function nightsLabel(count: number): string {
  return `${count} ${count === 1 ? 'night' : 'nights'}`;
}
