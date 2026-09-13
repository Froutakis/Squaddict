import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius, space, textSize, typo } from '../../theme';
import { regionFor, type MapProps } from './mapShared';

export type { MapPin, MapProps } from './mapShared';

export default function Map({
  pins,
  height = 180,
  spanKm = 1.2,
  onPress,
  style,
}: MapProps) {
  const region = regionFor(pins, spanKm);
  const label = region === undefined ? 'No location on this one' : 'Open the map on your phone';

  const body = (
    <View style={[styles.frame, { height }, styles.blank, style]}>
      <Text style={styles.blankText}>{label}</Text>
    </View>
  );

  if (onPress && region !== undefined) {
    return (
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel="Open the map"
        style={({ pressed }) => (pressed ? styles.pressed : null)}
      >
        {body}
      </Pressable>
    );
  }

  return body;
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
