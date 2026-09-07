
export type Reaction = { messageId: string; userId: string; emoji: string };

export type ReactionMap = Record<string, Reaction[]>;

export type ReactionCount = { emoji: string; count: number; mine: boolean };

export function actionFor(mine: string | null, pressed: string): 'clear' | 'set' {
  return mine === pressed ? 'clear' : 'set';
}

export function myReaction(list: Reaction[] | undefined, myId: string): string | null {
  if (!list) return null;
  const found = list.find((entry) => entry.userId === myId);
  return found ? found.emoji : null;
}

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

  return { ...map, [messageId]: next };
}

export function mergeReactions(map: ReactionMap, incoming: Reaction[]): ReactionMap {
  const byMessage: ReactionMap = {};
  for (const entry of incoming) {
    (byMessage[entry.messageId] ??= []).push(entry);
  }
  return { ...map, ...byMessage };
}
