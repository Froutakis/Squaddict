import { useEffect, useRef } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { colors, radius, space, textSize, typo } from '../../theme';
import { PIN, PIN_SELECTED_SCALE, regionFor, type MapPin, type MapProps, type MapRegion } from './mapShared';

export type { MapCoord, MapPin, MapProps } from './mapShared';

const MAPTILER_KEY = process.env.EXPO_PUBLIC_MAPTILER_KEY;
const MAPTILER_STYLE = 'base-v4';

const TILES = MAPTILER_KEY
  ? `https://api.maptiler.com/maps/${MAPTILER_STYLE}/256/{z}/{x}/{y}{r}.png?key=${MAPTILER_KEY}`
  : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
const ATTRIBUTION = MAPTILER_KEY ? '© MapTiler © OpenStreetMap contributors' : '© OpenStreetMap';

function pinIcon(pin: MapPin) {
  const color = pin.color ?? colors.primary;
  const pinColor = pin.color ?? colors.accent;

  if (pin.badge) {
    return L.divIcon({
      className: '',
      html: `<div style="width:30px;height:30px;border-radius:15px;background:${color};border:2.5px solid #FFFFFF;box-shadow:0 1px 5px rgba(12,25,38,0.45);display:flex;align-items:center;justify-content:center;color:#FFFFFF;font:700 13px system-ui,sans-serif">${escapeHtml(pin.badge)}</div>`,
      iconSize: [30, 30],
      iconAnchor: [15, 15],
    });
  }

  const k = pin.selected ? PIN_SELECTED_SCALE : 1;
  const { body, dot, shadow } = PIN;

  return L.divIcon({
    className: '',
    html: `<svg width="${PIN.width * k}" height="${PIN.height * k}" viewBox="0 0 ${PIN.width} ${PIN.height}" style="overflow:visible;display:block;filter:drop-shadow(0 3px 4px rgba(12,25,38,${pin.selected ? 0.35 : 0.22}))">
      <defs>
        <linearGradient id="pinSheen" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#FFFFFF" stop-opacity="0.32"/>
          <stop offset="0.55" stop-color="#FFFFFF" stop-opacity="0"/>
        </linearGradient>
      </defs>
      <ellipse cx="${shadow.cx}" cy="${shadow.cy}" rx="${shadow.rx}" ry="${shadow.ry}" fill="#0C1926" fill-opacity="0.25"/>
      <path d="${body}" fill="${pinColor}" stroke="#FFFFFF" stroke-width="2" stroke-linejoin="round"/>
      <path d="${body}" fill="url(#pinSheen)"/>
      <circle cx="${dot.cx}" cy="${dot.cy}" r="${dot.r}" fill="#FFFFFF"/>
    </svg>`,
    iconSize: [PIN.width * k, PIN.height * k],
    iconAnchor: [(PIN.width / 2) * k, PIN.tipY * k],
  });
}

function boundsOf(region: MapRegion): L.LatLngBoundsExpression {
  const halfLat = region.latitudeDelta / 2;
  const halfLng = region.longitudeDelta / 2;

  return [
    [region.latitude - halfLat, region.longitude - halfLng],
    [region.latitude + halfLat, region.longitude + halfLng],
  ];
}

function escapeHtml(text: string) {
  return text.replace(/[&<>"']/g, (ch) => `&#${ch.charCodeAt(0)};`);
}

export default function Map({
  pins,
  showsUserLocation = false,
  height = 180,
  spanKm = 1.2,
  interactive = false,
  onPressPin,
  onPress,
  insets,
  fallbackCenter,
  style,
}: MapProps) {
  const host = useRef<HTMLDivElement | null>(null);
  const map = useRef<L.Map | null>(null);
  const pressPin = useRef(onPressPin);
  pressPin.current = onPressPin;
  const refit = useRef<(() => void) | null>(null);
  const pressMap = useRef(onPress);
  pressMap.current = onPress;
  const framed = useRef(false);
  const region = regionFor(pins, spanKm, fallbackCenter);
  const sized = 'height' in (StyleSheet.flatten(style) ?? {}) ? null : { height };

  const pinsKey = pins
    .map((pin) => `${pin.id}:${pin.lat}:${pin.lng}:${pin.color ?? ''}:${pin.badge ?? ''}:${pin.selected ? 1 : 0}`)
    .join('|');
  const anchor = pins[0];
  const insetTop = insets?.top ?? 0;
  const insetBottom = insets?.bottom ?? 0;
  const anchorKey = anchor ? `${anchor.id}:${anchor.lat}:${anchor.lng}` : '';

  useEffect(() => {
    if (host.current === null || region === undefined || map.current !== null) return;

    map.current = L.map(host.current, {
      zoomControl: false,
      dragging: interactive,
      scrollWheelZoom: interactive,
      doubleClickZoom: interactive,
      touchZoom: interactive,
      attributionControl: true,
      keyboard: interactive,
    });

    map.current.fitBounds(boundsOf(region));
    L.tileLayer(TILES, { attribution: ATTRIBUTION, maxZoom: 19 }).addTo(map.current);
    if (interactive) {
      L.control.zoom({ position: 'bottomright' }).addTo(map.current);
      map.current.on('click', () => pressMap.current?.());
    }

    const resize = new ResizeObserver(() => {
      map.current?.invalidateSize();
      if (!framed.current) refit.current?.();
    });
    resize.observe(host.current);

    const instance = map.current;
    let me: L.CircleMarker | null = null;

    if (showsUserLocation) {
      instance.on('locationfound', (found: L.LocationEvent) => {
        if (me === null) {
          me = L.circleMarker(found.latlng, {
            radius: 7,
            color: '#FFFFFF',
            weight: 3,
            fillColor: colors.primary,
            fillOpacity: 1,
          }).addTo(instance);
        } else {
          me.setLatLng(found.latlng);
        }
      });
      instance.locate({ watch: true, setView: false, enableHighAccuracy: false });
    }

    return () => {
      resize.disconnect();
      instance.stopLocate();
      map.current?.remove();
      map.current = null;
    };
  }, [region === undefined, interactive, showsUserLocation]);

  useEffect(() => {
    const instance = map.current;
    if (instance === null) return;

    const markers = pins.map(function (pin) {
      const marker = L.marker([pin.lat, pin.lng], {
        icon: pinIcon(pin),
        zIndexOffset: pin.selected ? 1000 : 0,
      }).addTo(instance);
      marker.on('click', () => pressPin.current?.(pin.id));
      return marker;
    });

    return () => markers.forEach((marker) => marker.remove());
  }, [pinsKey]);

  useEffect(() => {
    const instance = map.current;
    if (instance === null || anchor === undefined || region === undefined) return;

    const frame = () => {
      const box = instance.getContainer();
      framed.current = box.clientWidth > 0 && box.clientHeight > 0;
      if (!framed.current) return;

      instance.fitBounds(boundsOf(region), {
        paddingTopLeft: [16, insetTop],
        paddingBottomRight: [16, insetBottom],
      });
    };

    frame();
    refit.current = frame;

    return () => {
      refit.current = null;
    };
  }, [anchorKey, insetTop, insetBottom]);

  useEffect(() => {
    host.current?.querySelectorAll<HTMLElement>('.leaflet-bottom').forEach((corner) => {
      corner.style.bottom = `${insetBottom}px`;
    });
  }, [insetBottom, region === undefined, interactive]);

  if (region === undefined) {
    return (
      <View style={[styles.frame, sized, styles.blank, style]}>
        <Text style={styles.blankText}>No location on this one</Text>
      </View>
    );
  }

  const canvas = (
    <View style={[styles.frame, sized, style]}>
      <div ref={host} style={{ position: 'absolute', inset: 0, isolation: 'isolate' }} />
    </View>
  );

  if (onPress && !interactive) {
    return (
      <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel="Open the map">
        {canvas}
      </Pressable>
    );
  }

  return canvas;
}

const styles = StyleSheet.create({
  frame: {
    borderRadius: radius.md,
    overflow: 'hidden',
    backgroundColor: colors.surfaceAlt,
  },
  blank: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: space.md },
  blankText: { color: colors.textFaint, ...typo.medium, fontSize: textSize.small },
});
