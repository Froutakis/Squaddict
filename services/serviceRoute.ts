import type { Coords } from "./serviceLocation";

export type Route = {
  points: Coords[];
  distanceM: number;
  durationS: number;
};

const FOOT = "https://routing.openstreetmap.de/routed-foot/route/v1/foot";

export async function getWalkingRoute(from: Coords, to: Coords): Promise<Route | null> {
  const url = `${FOOT}/${from.lng},${from.lat};${to.lng},${to.lat}?overview=full&geometries=geojson`;

  const response = await fetch(url);
  if (!response.ok) return null;

  const body = await response.json();
  const route = body?.routes?.[0];
  if (body?.code !== "Ok" || !route) return null;

  return {
    points: route.geometry.coordinates.map(([lng, lat]: [number, number]) => ({ lat, lng })),
    distanceM: route.distance,
    durationS: route.duration,
  };
}
