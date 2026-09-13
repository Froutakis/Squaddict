import type { StyleProp, ViewStyle } from 'react-native';

export type MapCoord = {
  lat: number;
  lng: number;
};

export type MapPin = MapCoord & {
  id: string;
  label?: string;
  color?: string;
};

export type MapProps = {
  pins: MapPin[];
  route?: MapCoord[];
  showsUserLocation?: boolean;
  height?: number;
  spanKm?: number;
  interactive?: boolean;
  onPressPin?: (id: string) => void;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
};

export type MapRegion = {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
};

export function regionFor(pins: MapPin[], spanKm: number): MapRegion | undefined {
  if (pins.length === 0) return undefined;

  let minLat = pins[0].lat;
  let maxLat = pins[0].lat;
  let minLng = pins[0].lng;
  let maxLng = pins[0].lng;

  for (const pin of pins) {
    minLat = Math.min(minLat, pin.lat);
    maxLat = Math.max(maxLat, pin.lat);
    minLng = Math.min(minLng, pin.lng);
    maxLng = Math.max(maxLng, pin.lng);
  }

  const floor = spanKm / 111;
  const padding = 1.6;

  return {
    latitude: (minLat + maxLat) / 2,
    longitude: (minLng + maxLng) / 2,
    latitudeDelta: Math.max(floor, (maxLat - minLat) * padding),
    longitudeDelta: Math.max(floor, (maxLng - minLng) * padding),
  };
}
