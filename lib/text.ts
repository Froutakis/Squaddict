// "member" / "members"
export function pluralWord(count: number, one: string, many: string): string {
  return count === 1 ? one : many;
}

// "1 member" / "3 members"
export function plural(count: number, one: string, many: string): string {
  return `${count} ${pluralWord(count, one, many)}`;
}
