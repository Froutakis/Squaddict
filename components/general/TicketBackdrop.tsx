import { memo } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Defs, G, Path, Pattern, RadialGradient, Rect, Stop } from 'react-native-svg';
import { colors } from '../../theme';

// One small ticket stub: notched sides and a dashed tear line near the end.
const STUB = 'M3 0H33A3 3 0 0 1 36 3V7A4 4 0 0 0 36 15V19A3 3 0 0 1 33 22H3A3 3 0 0 1 0 19V15A4 4 0 0 0 0 7V3A3 3 0 0 1 3 0Z';
const TEAR = 'M26 3V19';

type TicketBackdropProps = {
  // 'page': the light page with a soft cobalt glow top right and faint blue
  // stubs. 'night': only white stubs, laid over the cobalt sign-in sky.
  tone?: 'page' | 'night';
  style?: StyleProp<ViewStyle>;
};

// The page behind Home, Explore, Chat and You: faint tilted ticket stubs
// drifting on the page colour, with a little cobalt light in the top right.
// It sits behind everything and never takes a tap.
function TicketBackdrop({ tone = 'page', style }: TicketBackdropProps) {
  const night = tone === 'night';
  const tile = night ? 130 : 150;
  const stroke = night ? '#FFFFFF' : colors.primary;
  const opacity = night ? 0.16 : 0.1;
  const id = night ? 'stubs-night' : 'stubs-page';

  return (
    <View style={[StyleSheet.absoluteFill, !night && styles.page, style]} pointerEvents="none">
      <Svg width="100%" height="100%">
        <Defs>
          <RadialGradient id="glow" cx="100%" cy="0%" rx="120%" ry="50%" fx="100%" fy="0%" gradientUnits="objectBoundingBox">
            <Stop offset="0" stopColor={colors.primary} stopOpacity={0.07} />
            <Stop offset="0.6" stopColor={colors.primary} stopOpacity={0} />
          </RadialGradient>
          <Pattern id={id} patternUnits="userSpaceOnUse" width={tile} height={tile}>
            <G fill="none" stroke={stroke} strokeOpacity={opacity} strokeWidth={1.4}>
              <G transform={night ? 'translate(14 22) rotate(-14)' : 'translate(18 26) rotate(-14)'}>
                <Path d={STUB} />
                <Path d={TEAR} strokeDasharray="2 2.5" />
              </G>
              <G transform={night ? 'translate(78 82) rotate(12)' : 'translate(92 92) rotate(11)'}>
                <Path d={STUB} />
                <Path d={TEAR} strokeDasharray="2 2.5" />
              </G>
            </G>
          </Pattern>
        </Defs>
        {night ? null : <Rect x="0" y="0" width="100%" height="100%" fill="url(#glow)" />}
        <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${id})`} />
      </Svg>
    </View>
  );
}

export default memo(TicketBackdrop);

const styles = StyleSheet.create({
  page: { backgroundColor: colors.bg },
});
