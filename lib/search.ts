// What the person typed, cleaned up for a server-side search.
export function searchTerm(query: string): string | null {
  const term = query.replace(/\s+/g, ' ').trim().replace(/^@/, '').slice(0, 60);
  return term.length === 0 ? null : term;
}

