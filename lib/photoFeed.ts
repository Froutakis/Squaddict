// The photo feed on Home: which photos make it in, and how reactions add up.

export const REACTIONS = ['🔥', '😂', '😍', '🍻'] as const;
export type ReactionEmoji = (typeof REACTIONS)[number];

// What a double tap on a photo gives.
export const QUICK_REACTION: ReactionEmoji = '🔥';

export type PhotoReaction = {
  photoId: string;
  userId: string;
  emoji: string;
  name: string;
  avatarUrl: string | null;
  groupId: string | null;
  groupName: string | null;
};

export type Reactor = Omit<PhotoReaction, 'photoId' | 'emoji'>;

// A night with twenty photos should not take over the feed: keep the newest
// few of each night, in the order they came.
export function capPerNight<T extends { eventId: string }>(photos: T[], perNight: number): T[] {
  const seen = new Map<string, number>();

  return photos.filter(function (photo) {
    const count = seen.get(photo.eventId) ?? 0;
    seen.set(photo.eventId, count + 1);
    return count < perNight;
  });
}

// Why a night is in a parea's feed, closest first (feed_nights in feed_nights.sql).
export type FeedReason = 'yours' | 'following' | 'member_went' | 'followed_went' | 'similar' | 'public';

// Your own circle: the parea's nights and the pareas it follows.
export function isOwnCircle(reason: FeedReason): boolean {
  return reason === 'yours' || reason === 'following';
}

// The feed stays yours: after every `every` posts of your own circle comes one
// from another parea. A parea with few nights of its own still gets a couple
// at the end, and one with none yet gets all of them.
export function mixFeed<T>(items: T[], isOwn: (item: T) => boolean, every = 3, atLeast = 2): T[] {
  const own = items.filter(isOwn);
  const others = items.filter((item) => !isOwn(item));
  if (own.length === 0) return others;

  const allowed = Math.min(others.length, Math.max(atLeast, Math.floor(own.length / every)));
  const mixed: T[] = [];
  let next = 0;
  own.forEach(function (item, index) {
    mixed.push(item);
    if ((index + 1) % every === 0 && next < allowed) mixed.push(others[next++]);
  });
  while (next < allowed) mixed.push(others[next++]);
  return mixed;
}

export type Tally = {
  counts: Record<string, number>;
  total: number;
  mine: string | null;
};

export function tallyReactions(reactions: PhotoReaction[], userId: string): Tally {
  const counts: Record<string, number> = {};
  let mine: string | null = null;

  for (const reaction of reactions) {
    counts[reaction.emoji] = (counts[reaction.emoji] ?? 0) + 1;
    if (reaction.userId === userId) mine = reaction.emoji;
  }

  return { counts, total: reactions.length, mine };
}

// Tapping the emoji you already gave takes it back; any other replaces it.
export function applyReaction(
  reactions: PhotoReaction[],
  photoId: string,
  me: Reactor,
  emoji: string,
): PhotoReaction[] {
  const current = reactions.find((one) => one.userId === me.userId);
  const others = reactions.filter((one) => one.userId !== me.userId);

  if (current?.emoji === emoji) return others;
  return [...others, { ...me, photoId, emoji }];
}

// "you", "Manos", "you and 3 others": who reacted, newest first, you in front.
export function reactorsLine(reactions: PhotoReaction[], userId: string): string {
  if (reactions.length === 0) return '';

  const mine = reactions.some((one) => one.userId === userId);
  const newest = [...reactions].reverse().find((one) => one.userId !== userId);
  const lead = mine ? 'you' : firstName(newest?.name ?? 'Someone');
  const others = reactions.length - 1;

  if (others === 0) return lead;
  if (others === 1 && mine && newest) return `you and ${firstName(newest.name)}`;
  return `${lead} and ${others} ${others === 1 ? 'other' : 'others'}`;
}

function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] || 'Someone';
}

// "Just now", "5 minutes ago", "3 hours ago", "2 days ago", then the date.
export function postedAgo(iso: string, now: Date): string {
  const then = new Date(iso);
  const minutes = Math.floor((now.getTime() - then.getTime()) / 60000);

  if (!Number.isFinite(minutes) || minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes} ${minutes === 1 ? 'minute' : 'minutes'} ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} ${hours === 1 ? 'hour' : 'hours'} ago`;

  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} ${days === 1 ? 'day' : 'days'} ago`;

  return then.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: then.getFullYear() === now.getFullYear() ? undefined : 'numeric',
  });
}

// Photos keep their own shape, within what a feed can take: no taller than
// 4:5, no wider than 1.91:1.
export function postRatio(width: number, height: number): number {
  if (!(width > 0) || !(height > 0)) return 1;
  return Math.min(1.91, Math.max(0.8, width / height));
}
