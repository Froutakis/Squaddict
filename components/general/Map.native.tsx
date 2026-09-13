import { useEffect, useRef } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_DEFAULT } from 'react-native-maps';
import { colors, radius, space, textSize, typo } from '../../theme';
import { regionFor, type MapProps } from './mapShared';

export type { MapCoord, MapPin, MapProps } from './mapShared';

const FIT_PADDING = { top: 220, right: 48, bottom: 240, left: 48 };

export default function Map({
  pins,
  route,
  showsUserLocation = false,
  height = 180,
  spanKm = 1.2,
  interactive = false,
  onPressPin,
  onPress,
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
            title={pin.label}
            pinColor={pin.color ?? colors.primary}
            onPress={onPressPin ? () => onPressPin(pin.id) : undefined}
          />
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
  blank: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: space.md },
  blankText: { color: colors.textFaint, ...typo.medium, fontSize: textSize.small },
});
