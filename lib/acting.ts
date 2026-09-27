export function pickActing<T extends { id: string }>(groups: T[], actingId: string | null): T | null {
  if (groups.length === 0) return null;
  return groups.find((group) => group.id === actingId) ?? groups[0];
}

export function switchList<T extends { id: string }>(groups: T[], acting: T | null): T[] {
  if (!acting) return groups;
  return groups.filter((group) => group.id !== acting.id);
}

export function splitVisible<T>(list: T[], visible = 3): { shown: T[]; more: number } {
  return { shown: list.slice(0, visible), more: Math.max(0, list.length - visible) };
}

export function sinceYear(createdAt: string | null | undefined): string | null {
  if (!createdAt) return null;
  const date = new Date(createdAt);
  return Number.isNaN(date.getTime()) ? null : String(date.getFullYear());
}
