import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { BlurView } from 'expo-blur';
import { radius as radii } from '../../theme';

type GlassProps = {
  children?: ReactNode;
  radius?: number;
  style?: StyleProp<ViewStyle>;
};

export default function Glass({ children, radius = radii.xl, style }: GlassProps) {
  return (
    <View style={[styles.island, { borderRadius: radius }, style]}>
      <BlurView intensity={40} tint="light" style={[styles.fill, { borderRadius: radius }]} />
      <View style={[styles.fill, styles.sheen, { borderRadius: radius }]} pointerEvents="none" />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  island: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.7)',
    shadowColor: '#0C1926',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.14,
    shadowRadius: 24,
  },
  fill: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    overflow: 'hidden',
  },
  sheen: { backgroundColor: 'rgba(255,255,255,0.45)' },
});
