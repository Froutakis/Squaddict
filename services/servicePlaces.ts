export type Place = {
  label: string;
  lat: number;
  lng: number;
};

const ENDPOINT = "https://nominatim.openstreetmap.org/search";

const CONTACT = "parea-app@example.com";

const MIN_QUERY = 3;

function shortLabel(row: any): string {
  const name = typeof row.name === "string" && row.name.trim() ? row.name.trim() : null;
  const parts = String(row.display_name ?? "").split(",").map((p: string) => p.trim());

  if (!name) return parts.slice(0, 2).join(", ");

  const context = parts.find((p: string) => p && p !== name);

  return context ? `${name}, ${context}` : name;
}

export async function searchPlaces(query: string, signal?: AbortSignal): Promise<Place[]> {
  const trimmed = query.trim();
  if (trimmed.length < MIN_QUERY) return [];

  const url =
    `${ENDPOINT}?q=${encodeURIComponent(trimmed)}` +
    `&format=jsonv2&limit=6&addressdetails=0&email=${encodeURIComponent(CONTACT)}`;

  const response = await fetch(url, {
    signal,
    headers: { Accept: "application/json" },
  });
  if (!response.ok) throw new Error(`Place search failed (${response.status})`);

  const rows = (await response.json()) as any[];

  return rows
    .filter((r) => r && r.lat && r.lon)
    .map((r) => ({
      label: shortLabel(r),
      lat: Number(r.lat),
      lng: Number(r.lon),
    }))
    .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng));
}
