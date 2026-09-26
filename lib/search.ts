export function searchPattern(query: string): string | null {
  const term = query
    .replace(/[,()%*\\"]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^@/, '')
    .slice(0, 60);

  return term.length === 0 ? null : `%${term}%`;
}
