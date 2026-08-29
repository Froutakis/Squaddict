 import type { Coords } from "./serviceLocation";

export type Place = {
  label: string;
  lat: number;
  lng: number;
};

const ENDPOINT = "https://nominatim.openstreetmap.org/search";

const REVERSE_ENDPOINT = "https://nominatim.openstreetmap.org/reverse";

const CONTACT = "foutakisdimi7@gmail.com";

const MIN_QUERY = 3;

const HEADERS = {
  Accept: "application/json",
  "User-Agent": CONTACT ? `Parea/1.0 (${CONTACT})` : "Parea/1.0",
};

function identified(url: string): string {
  return CONTACT ? `${url}&email=${encodeURIComponent(CONTACT)}` : url;
}

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

  const url = identified(
    `${ENDPOINT}?q=${encodeURIComponent(trimmed)}&format=jsonv2&limit=6&addressdetails=0`,
  );

  const response = await fetch(url, { signal, headers: HEADERS });
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

export async function reversePlace(coords: Coords, signal?: AbortSignal): Promise<Place | null> {
  const url = identified(
    `${REVERSE_ENDPOINT}?lat=${coords.lat}&lon=${coords.lng}&format=jsonv2&zoom=18`,
  );

  const response = await fetch(url, { signal, headers: HEADERS });
  if (!response.ok) return null;

  const row = (await response.json()) as any;
  if (!row || row.error) return null;

  const label = shortLabel(row);
  if (!label) return null;

  return { label, lat: coords.lat, lng: coords.lng };
}
