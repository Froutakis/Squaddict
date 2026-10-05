import { useCallback, useEffect, useMemo, useRef, type ReactNode } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  PanResponder,
  Platform,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { colors } from '../../theme';

const OPEN_MS = 300;
const CLOSE_MS = 220;
// How wide the strip along the left edge is that a swipe back starts from.
// It stops where the back button starts, so it never takes its taps.
const EDGE = 16;

type ChatSlideProps = {
  // Called once the chat is out of sight.
  onClosed: () => void;
  // The chat, given a close that slides it away first.
  children: (close: () => void) => ReactNode;
};

// The chat comes in from the right over Parea, like a page pushed on iOS,
// and goes back the same way: with its back button, or on iOS by swiping from
// the left edge. Reduce Motion skips the slide.
export default function ChatSlide({ onClosed, children }: ChatSlideProps) {
  const { width } = useWindowDimensions();
  const x = useRef(new Animated.Value(width)).current;
  const reduce = useRef(false);
  const closing = useRef(false);
  const widthRef = useRef(width);
  widthRef.current = width;
  const closedRef = useRef(onClosed);
  closedRef.current = onClosed;

  useEffect(() => {
    let alive = true;
    Animated.timing(x, {
      toValue: 0,
      duration: OPEN_MS,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
    // In place even if frames were held back while it slid.
    const settle = setTimeout(() => {
      if (!closing.current) x.setValue(0);
    }, OPEN_MS + 150);
    AccessibilityInfo.isReduceMotionEnabled()
      .then((on) => {
        if (!alive || !on) return;
        reduce.current = true;
        x.stopAnimation();
        x.setValue(0);
      })
      .catch(() => {});
    return () => {
      alive = false;
      clearTimeout(settle);
    };
  }, [x]);

  const close = useCallback(
    function close() {
      if (closing.current) return;
      closing.current = true;
      if (reduce.current) {
        closedRef.current();
        return;
      }
      // Closed once, when the slide ends, or a little after in case frames
      // are held back (a tab in the background) and it never gets there.
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        closedRef.current();
      };
      setTimeout(finish, CLOSE_MS + 150);
      Animated.timing(x, {
        toValue: widthRef.current,
        duration: CLOSE_MS,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }).start(finish);
    },
    [x],
  );

  const edge = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: (_, g) => g.dx > 4 && Math.abs(g.dx) > Math.abs(g.dy),
        onPanResponderMove: (_, g) => {
          if (!closing.current) x.setValue(Math.max(0, g.dx));
        },
        onPanResponderRelease: (_, g) => {
          if (g.dx > widthRef.current * 0.33 || g.vx > 0.6) {
            close();
          } else {
            Animated.spring(x, { toValue: 0, useNativeDriver: true, bounciness: 0 }).start();
          }
        },
        onPanResponderTerminate: () => {
          Animated.spring(x, { toValue: 0, useNativeDriver: true, bounciness: 0 }).start();
        },
      }),
    [x, close],
  );

  return (
    // Clipped, so the page never scrolls sideways while it slides (web).
    <View style={styles.frame} pointerEvents="box-none">
      <Animated.View style={[styles.slide, { transform: [{ translateX: x }] }]}>
        {children(close)}
        {Platform.OS === 'ios' ? <View style={styles.edge} {...edge.panHandlers} /> : null}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, overflow: 'hidden' },
  slide: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: colors.bg,
    shadowColor: colors.ink,
    shadowOffset: { width: -14, height: 0 },
    shadowOpacity: 0.16,
    shadowRadius: 30,
  },
  edge: { position: 'absolute', top: 0, bottom: 0, left: 0, width: EDGE },
});
