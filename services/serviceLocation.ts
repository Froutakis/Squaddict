import * as Location from "expo-location";

export type Coords = {
  lat: number;
  lng: number;
};

export type LocationResult =
  | { ok: true; coords: Coords }
  | { ok: false; reason: "denied" | "unavailable" };

export type LocationState = "asking" | "on" | "off";

const MAX_CACHE_AGE_MS = 5 * 60 * 1000;
const WATCH_INTERVAL_MS = 15 * 1000;
const WATCH_DISTANCE_M = 15;

function toCoords(position: Location.LocationObject): Coords {
  return { lat: position.coords.latitude, lng: position.coords.longitude };
}

export async function getCurrentCoords(): Promise<LocationResult> {
  try {
    const asked = await Location.requestForegroundPermissionsAsync();

    const { status } = asked;
    if (status !== "granted") return { ok: false, reason: "denied" };

    const cached = await Location.getLastKnownPositionAsync({ maxAge: MAX_CACHE_AGE_MS });
    if (cached) return { ok: true, coords: toCoords(cached) };

    const fresh = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });

    return { ok: true, coords: toCoords(fresh) };
  } catch {
    return { ok: false, reason: "unavailable" };
  }
}

export async function watchCoords(onCoords: (coords: Coords) => void): Promise<(() => void) | null> {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== "granted") return null;

    const subscription = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.Balanced,
        timeInterval: WATCH_INTERVAL_MS,
        distanceInterval: WATCH_DISTANCE_M,
      },
      (position) => onCoords(toCoords(position)),
    );

    return () => subscription.remove();
  } catch {
    return null;
  }
}
