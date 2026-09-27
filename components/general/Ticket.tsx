import { useEffect, useRef, type ReactNode } from 'react';
import {
  Animated,
  Easing,
  Image,
  Platform,
  Pressable,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { brand, colors, radius, shadow, space } from '../../theme';

const DASH_COUNT = 26;
// Dark enough at the bottom, where the text sits, for white type on any photo.
const COVER_TINT = ['rgba(12,25,38,0.12)', 'rgba(12,25,38,0.55)', 'rgba(12,25,38,0.9)'] as const;
const TEAR_MS = 280;
const TOOTH_COUNT = 80;
const TOOTH_SIZES = [8, 6, 9, 7, 10, 6, 8];
const TOOTH_LIFT = [0, 2, -1, 1, -2, 0, 2, -1, 1, -2, 1];
const TOOTH_TILT = [45, 41, 49, 43, 47];
const TOOTH_GAP = [2, 3, 1, 4, 2, 1, 3];

type TicketProps = {
  children: ReactNode;
  stub?: ReactNode;
  tone?: 'light' | 'ink' | 'brand';
  notches?: boolean;
  torn?: boolean;
  cutColor?: string;
  cover?: string | null;
  coverTint?: readonly [string, string, ...string[]];
  onCoverError?: () => void;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
};

export default function Ticket({
  children,
  stub,
  tone = 'light',
  notches = true,
  torn = false,
  cutColor = colors.bg,
  cover = null,
  coverTint = COVER_TINT,
  onCoverError,
  onPress,
  style,
  accessibilityLabel,
}: TicketProps) {
  const ink = tone !== 'light';
  const toneBg = tone === 'brand' ? brand[0] : tone === 'ink' ? colors.ink : colors.surface;
  const tear = useRef(new Animated.Value(torn ? 1 : 0)).current;

  const mounted = useRef(false);

  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      tear.setValue(torn ? 1 : 0);
      return;
    }

    Animated.timing(tear, {
      toValue: torn ? 1 : 0,
      duration: TEAR_MS,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [torn, tear]);


  const content = (
    <>
      {tone === 'brand' ? (
        <LinearGradient
          colors={brand}
          start={{ x: 0, y: 0 }}
          end={{ x: 0.35, y: 1 }}
          style={[StyleSheet.absoluteFill, styles.fill]}
          pointerEvents="none"
        />
      ) : null}
      {cover ? (
        <View style={[styles.main, styles.covered, !stub && styles.coveredAll]}>
          <Image
            source={{ uri: cover }}
            style={StyleSheet.absoluteFill}
            resizeMode="cover"
            onError={onCoverError}
            accessibilityIgnoresInvertColors
          />
          <LinearGradient
            colors={coverTint}
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
          />
          {children}
        </View>
      ) : (
        <View style={styles.main}>{children}</View>
      )}

      {stub ? (
        <>
          <Animated.View
            style={[
              styles.perf,
              {
                height: tear.interpolate({ inputRange: [0, 1], outputRange: [1.5, 5] }),
                marginHorizontal: torn ? 0 : 14,
                backgroundColor: torn ? cutColor : 'transparent',
              },
            ]}
          >
            {torn ? null : (
              <Dashes color={ink ? 'rgba(255,255,255,0.32)' : colors.borderStrong} />
            )}

            {torn ? (
              <View style={styles.teeth} pointerEvents="none">
                {Array.from({ length: TOOTH_COUNT }, (_, i) => {
                  const size = TOOTH_SIZES[i % TOOTH_SIZES.length];

                  return (
                    <View
                      key={i}
                      style={[
                        styles.tooth,
                        {
                          width: size,
                          height: size,
                          marginTop: TOOTH_LIFT[i % TOOTH_LIFT.length],
                          marginLeft: TOOTH_GAP[i % TOOTH_GAP.length],
                          transform: [{ rotate: `${TOOTH_TILT[i % TOOTH_TILT.length]}deg` }],
                          backgroundColor: cutColor,
                        },
                      ]}
                    />
                  );
                })}
              </View>
            ) : null}

            {notches && !torn ? (
              <>
                <View style={[styles.notch, styles.notchLeft, { backgroundColor: cutColor }]} />
                <View style={[styles.notch, styles.notchRight, { backgroundColor: cutColor }]} />
              </>
            ) : null}

            {torn ? (
              <Animated.View
                pointerEvents="none"
                style={[
                  styles.curtain,
                  {
                    left: tear.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
                    backgroundColor: toneBg,
                  },
                ]}
              />
            ) : null}
          </Animated.View>
          <View style={styles.stub}>{stub}</View>
        </>
      ) : null}
    </>
  );

  if (!onPress) {
    return (
      <View style={[styles.card, ink ? styles.ink : styles.light, ink && { backgroundColor: toneBg }, style]}>
        {content}
      </View>
    );
  }

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole={Platform.OS === 'web' && stub ? undefined : 'button'}
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [
        styles.card,
        ink ? styles.ink : styles.light,
        ink && { backgroundColor: toneBg },
        pressed && styles.pressed,
        style,
      ]}
    >
      {content}
    </Pressable>
  );
}

function Dashes({ color }: { color: string }) {
  return (
    <View style={styles.dashRow}>
      {Array.from({ length: DASH_COUNT }, (_, i) => (
        <View key={i} style={[styles.dash, { backgroundColor: color }]} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.lg, overflow: 'visible' },
  fill: { borderRadius: radius.lg },
  light: { backgroundColor: colors.surface, ...shadow.card },
  ink: { backgroundColor: colors.ink, ...shadow.hero },
  pressed: { opacity: 0.85 },

  main: { paddingHorizontal: space.md, paddingTop: space.md, paddingBottom: space.sm },
  covered: {
    overflow: 'hidden',
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    paddingBottom: space.md,
  },
  coveredAll: { borderBottomLeftRadius: radius.lg, borderBottomRightRadius: radius.lg },
  stub: { paddingHorizontal: space.md, paddingTop: space.sm, paddingBottom: space.md },

  perf: { height: 1.5, marginHorizontal: 14, justifyContent: 'center' },
  dashRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  dash: { width: 5, height: 1.5, borderRadius: 1 },
  teeth: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: -8,
    height: 21,
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'hidden',
  },
  tooth: { flex: 0 },
  curtain: { position: 'absolute', top: -8, right: 0, height: 21 },
  notch: { position: 'absolute', top: -9, width: 18, height: 18, borderRadius: 9 },
  notchLeft: { left: -24 },
  notchRight: { right: -24 },
});
