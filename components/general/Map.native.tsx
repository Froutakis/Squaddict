import { useEffect, useRef } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_DEFAULT } from 'react-native-maps';
import { colors, radius, space, textSize, typo } from '../../theme';
import Svg, { Circle, Defs, Ellipse, LinearGradient, Path, Stop } from 'react-native-svg';
import { PIN, PIN_SELECTED_SCALE, regionFor, type MapProps } from './mapShared';

export type { MapCoord, MapPin, MapProps } from './mapShared';

const FIT_PADDING = { top: 220, right: 48, bottom: 240, left: 48 };
const PIN_ANCHOR = { x: 0.5, y: PIN.tipY / PIN.height };

function pinOffset(selected?: boolean) {
  const k = selected ? PIN_SELECTED_SCALE : 1;
  return { x: 0, y: -(PIN.tipY - PIN.height / 2) * k };
}

function Pin({ color, selected }: { color: string; selected: boolean }) {
  const k = selected ? PIN_SELECTED_SCALE : 1;
  const { body, dot, shadow } = PIN;

  return (
    <Svg width={PIN.width * k} height={PIN.height * k} viewBox={`0 0 ${PIN.width} ${PIN.height}`}>
      <Defs>
        <LinearGradient id="pinSheen" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0.32} />
          <Stop offset="0.55" stopColor="#FFFFFF" stopOpacity={0} />
        </LinearGradient>
      </Defs>
      <Ellipse cx={shadow.cx} cy={shadow.cy} rx={shadow.rx} ry={shadow.ry} fill="#0C1926" fillOpacity={0.25} />
      <Path d={body} fill={color} stroke="#FFFFFF" strokeWidth={2} strokeLinejoin="round" />
      <Path d={body} fill="url(#pinSheen)" />
      <Circle cx={dot.cx} cy={dot.cy} r={dot.r} fill="#FFFFFF" />
    </Svg>
  );
}

export default function Map({
  pins,
  route,
  showsUserLocation = false,
  height = 180,
  spanKm = 1.2,
  interactive = false,
  onPressPin,
  onPress,
  insets,
  style,
}: MapProps) {
  const mapRef = useRef<MapView>(null);
  const region = regionFor(pins, spanKm);

  useEffect(() => {
    if (!route || route.length < 2) return;

    mapRef.current?.fitToCoordinates(
      route.map((point) => ({ latitude: point.lat, longitude: point.lng })),
      { edgePadding: FIT_PADDING, animated: true },
    );
  }, [route]);

  if (region === undefined) {
    return (
      <View style={[styles.frame, { height }, styles.blank, style]}>
        <Text style={styles.blankText}>No location on this one</Text>
      </View>
    );
  }

  const map = (
    <MapView
      ref={mapRef}
      provider={PROVIDER_DEFAULT}
      style={StyleSheet.absoluteFill}
      initialRegion={region}
      scrollEnabled={interactive}
      zoomEnabled={interactive}
      rotateEnabled={false}
      pitchEnabled={false}
      toolbarEnabled={false}
      showsCompass={false}
      showsMyLocationButton={false}
      showsUserLocation={showsUserLocation}
      mapPadding={{ top: insets?.top ?? 0, right: 0, bottom: insets?.bottom ?? 0, left: 0 }}
      onPress={
        interactive && onPress
          ? (e) => {
              if (e.nativeEvent.action !== 'marker-press') onPress();
            }
          : undefined
      }
    >
      {route && route.length > 1 ? (
        <Polyline
          coordinates={route.map((point) => ({ latitude: point.lat, longitude: point.lng }))}
          strokeColor={colors.primary}
          strokeWidth={4}
        />
      ) : null}

      {pins.map(function (pin) {
        return (
          <Marker
            key={pin.id}
            coordinate={{ latitude: pin.lat, longitude: pin.lng }}
            anchor={pin.badge ? { x: 0.5, y: 0.5 } : PIN_ANCHOR}
            centerOffset={pin.badge ? undefined : pinOffset(pin.selected)}
            zIndex={pin.selected ? 1 : 0}
            onPress={onPressPin ? () => onPressPin(pin.id) : undefined}
          >
            {pin.badge ? (
              <View style={[styles.badge, { backgroundColor: pin.color ?? colors.primary }]}>
                <Text style={styles.badgeText}>{pin.badge}</Text>
              </View>
            ) : (
              <Pin color={pin.color ?? colors.accent} selected={pin.selected === true} />
            )}
          </Marker>
        );
      })}
    </MapView>
  );

  if (onPress && !interactive) {
    return (
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel="Open the map"
        style={({ pressed }) => [styles.frame, { height }, pressed && styles.pressed, style]}
      >
        {map}
      </Pressable>
    );
  }

  return <View style={[styles.frame, { height }, style]}>{map}</View>;
}

const styles = StyleSheet.create({
  frame: {
    borderRadius: radius.md,
    overflow: 'hidden',
    backgroundColor: colors.surfaceAlt,
  },
  pressed: { opacity: 0.85 },
  badge: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 2.5,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { color: '#FFFFFF', ...typo.bold, fontSize: 13 },
  blank: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: space.md },
  blankText: { color: colors.textFaint, ...typo.medium, fontSize: textSize.small },
});
