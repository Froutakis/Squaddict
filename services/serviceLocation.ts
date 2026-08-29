import { Platform } from "react-native";
import * as Location from "expo-location";

export type Coords = {
  lat: number;
  lng: number;
};

export type LocationResult =
  | { ok: true; coords: Coords }
  | { ok: false; reason: "denied" | "unavailable" };

const MAX_CACHE_AGE_MS = 5 * 60 * 1000;

function toCoords(position: Location.LocationObject): Coords {
  return { lat: position.coords.latitude, lng: position.coords.longitude };
}

export async function getCurrentCoords(): Promise<LocationResult> {
  try {
    const enabled = await Location.hasServicesEnabledAsync();
    const before = await Location.getForegroundPermissionsAsync();
    const asked = await Location.requestForegroundPermissionsAsync();

    console.log("DIAG platform:", Platform.OS, "| services enabled:", enabled);
    console.log("DIAG permission before:", JSON.stringify(before));
    console.log("DIAG permission after ask:", JSON.stringify(asked));

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
