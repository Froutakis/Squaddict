export const MIN_SQUAD_QUERY = 2;

export function cleanSquadQuery(query: string): string {
  return query.trim().replace(/^@+/, '').trim();
}

// PostgREST `or` filter matching handle or name. The value is double-quoted so
// dots and commas in the query cannot break the filter, and LIKE wildcards are
// escaped so "%" and "_" match literally.
export function squadSearchFilter(query: string): string | null {
  const term = cleanSquadQuery(query);
  if (term.length < MIN_SQUAD_QUERY) return null;

  const like = '%' + term.replace(/[\\%_]/g, (c) => '\\' + c) + '%';
  const quoted = '"' + like.replace(/[\\"]/g, (c) => '\\' + c) + '"';
  return `handle.ilike.${quoted},name.ilike.${quoted}`;
}
