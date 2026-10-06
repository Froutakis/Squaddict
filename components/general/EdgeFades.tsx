import { Animated, StyleSheet, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { alpha, colors } from '../../theme';

const EDGE = 110;
// The page's own colour, see-through, so the fades melt into it.
const BG_CLEAR = alpha(colors.bg, 0);
const BG_HALF = alpha(colors.bg, 0.7);

// How far down the page the top fade is fully in.
export const EDGE_FADE_IN = 60;

type EdgeFadesProps = {
  // 0 at the top of the page, 1 once it has scrolled EDGE_FADE_IN down: the
  // top edge only blurs what has gone under it.
  top: Animated.Value;
};

// A line that runs off the screen: the page blurs and fades out at the top
// and the bottom instead of being cut. Laid over a scrolling page.
export default function EdgeFades({ top }: EdgeFadesProps) {
  return (
    <>
      <Animated.View pointerEvents="none" style={[styles.top, { opacity: top }]}>
        <BlurView intensity={10} tint="light" style={styles.blurTop} />
        <LinearGradient colors={[colors.bg, BG_HALF, BG_CLEAR]} locations={[0, 0.35, 1]} style={StyleSheet.absoluteFill} />
      </Animated.View>
      <View pointerEvents="none" style={styles.bottom}>
        <BlurView intensity={10} tint="light" style={styles.blurBottom} />
        <LinearGradient colors={[BG_CLEAR, BG_HALF, colors.bg]} locations={[0, 0.65, 1]} style={StyleSheet.absoluteFill} />
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  top: { position: 'absolute', top: 0, left: 0, right: 0, height: EDGE },
  bottom: { position: 'absolute', bottom: 0, left: 0, right: 0, height: EDGE },
  blurTop: { position: 'absolute', top: 0, left: 0, right: 0, height: EDGE * 0.35 },
  blurBottom: { position: 'absolute', bottom: 0, left: 0, right: 0, height: EDGE * 0.35 },
});
