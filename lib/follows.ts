type Named = { name: string; handle: string };

export function filterSquads<T extends Named>(list: T[], query: string): T[] {
  const term = query.trim().replace(/^@/, '').trim().toLowerCase();
  if (term.length === 0) return list;

  return list.filter(
    (group) => group.name.toLowerCase().includes(term) || group.handle.toLowerCase().includes(term),
  );
}

export function markMutual<T extends { id: string }>(
  list: T[],
  followerIds: string[],
): { group: T; mutual: boolean }[] {
  const back = new Set(followerIds);
  return list.map((group) => ({ group, mutual: back.has(group.id) }));
}

export function countMutual<T extends { id: string }>(list: T[], followerIds: string[]): number {
  return markMutual(list, followerIds).filter((row) => row.mutual).length;
}

export function followButtonLabel(following: boolean, actingName: string): string {
  return following ? `${actingName} follows them` : `Follow as ${actingName}`;
}
