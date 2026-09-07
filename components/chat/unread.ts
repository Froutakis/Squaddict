
export const UNREAD_CAP = 99;

export function unreadLabel(count: number): string | null {
  if (!Number.isFinite(count) || count <= 0) {
    return null;
  }
  if (count > UNREAD_CAP) {
    return UNREAD_CAP + '+';
  }
  return String(Math.floor(count));
}
