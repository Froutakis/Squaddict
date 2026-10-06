import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient as SvgGradient, Path, Rect, Stop } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';
import { FAB_CENTER_Y } from '../general/MenuFab';
import { alpha, colors, dusk, scrim, space, sun, textSize, typo } from '../../theme';

export const HERO_HEIGHT = 262;
const PICTURE = 168;
const BG_CLEAR = alpha(colors.bg, 0);
const BG_SOLID = alpha(colors.bg, 0.94);
const LIVE_HEIGHT = 32;
// The pill is drawn 32 high but takes a 44pt tap.
const LIVE_SLOP = (44 - LIVE_HEIGHT) / 2;

type ExploreHeroProps = {
  // "EXPLORE · FRI 9 OCT"
  kicker: string;
  city: string;
  // "tonight", "today"
  when: string;
  // Plans on right now around here: a small sun-lit note top right.
  liveCount: number;
  onPressLive?: () => void;
  // Where the floating menu button's middle is, to sit level with it.
  rowCenter?: number;
};

// The top of Explore: the waterfront at dusk, fading into the page, and the
// city with the time of day as the title. Painted, so nobody is in it.
export default function ExploreHero({ kicker, city, when, liveCount, onPressLive, rowCenter = FAB_CENTER_Y }: ExploreHeroProps) {
  return (
    <View style={styles.hero}>
      <Svg width="100%" height={PICTURE} viewBox="0 0 390 200" preserveAspectRatio="xMidYMax slice" style={styles.picture}>
        <Defs>
          <SvgGradient id="sky" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={dusk.skyTop} />
            <Stop offset="0.45" stopColor={dusk.skyMid} />
            <Stop offset="0.72" stopColor={dusk.skyLow} />
            <Stop offset="1" stopColor={dusk.horizon} />
          </SvgGradient>
          <SvgGradient id="sea" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={dusk.seaTop} />
            <Stop offset="1" stopColor={dusk.seaDeep} />
          </SvgGradient>
        </Defs>
        <Rect width="390" height="200" fill="url(#sky)" />
        <Circle cx="300" cy="150" r="22" fill={dusk.sun} opacity={0.9} />
        <Path
          d="M0 170 L20 170 L20 150 L34 150 L34 160 L52 160 L52 138 L66 138 L66 165 L88 165 L88 146 L104 146 L104 168 L130 168 L130 152 L146 152 L146 140 L160 140 L160 170 L190 170 L190 155 L210 155 L210 172 L250 172 L250 160 L268 160 L268 174 L390 174 L390 200 L0 200Z"
          fill={dusk.city}
          opacity={0.85}
        />
        {/* The tower by the sea. */}
        <Rect x="226" y="120" width="22" height="56" rx="3" fill={dusk.tower} />
        <Rect x="223" y="116" width="28" height="8" rx="2" fill={dusk.tower} />
        <Rect x="0" y="176" width="390" height="24" fill="url(#sea)" />
        <Path d="M0 190 Q60 186 120 192 T240 190 T390 193" stroke={dusk.horizon} strokeOpacity={0.35} strokeWidth={2} fill="none" />
      </Svg>
      <LinearGradient
        colors={[alpha(colors.ink, 0.35), alpha(colors.ink, 0), BG_CLEAR, BG_SOLID, colors.bg]}
        locations={[0, 0.22, 0.36, 0.55, 0.62]}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />

      {liveCount > 0 ? (
        <Pressable
          onPress={onPressLive}
          disabled={!onPressLive}
          hitSlop={LIVE_SLOP}
          accessibilityRole={onPressLive ? 'button' : 'text'}
          accessibilityLabel={`${liveCount} ${liveCount === 1 ? 'plan' : 'plans'} live now${onPressLive ? '. Show them' : ''}`}
          style={({ pressed }) => [styles.live, { top: rowCenter - LIVE_HEIGHT / 2 }, pressed && styles.pressed]}
        >
          <View style={styles.liveDot} />
          <Text style={styles.liveText}>
            {liveCount} {liveCount === 1 ? 'plan' : 'plans'} live now
          </Text>
        </Pressable>
      ) : null}

      <View style={styles.title}>
        <Text style={styles.kicker}>{kicker}</Text>
        <Text style={styles.city} numberOfLines={1} accessibilityRole="header">
          {city}
        </Text>
        <Text style={styles.when}>{when}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { height: HERO_HEIGHT, overflow: 'hidden' },
  picture: { position: 'absolute', top: 0, left: 0, right: 0 },
  // Level with the floating menu button, on the right.
  live: {
    position: 'absolute',
    right: space.md,
    height: LIVE_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: scrim.ink,
  },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: sun },
  liveText: { color: colors.onInk, ...typo.bold, fontSize: textSize.small },
  pressed: { opacity: 0.7 },
  title: { position: 'absolute', left: space.lg - 4, right: space.lg, bottom: space.sm },
  kicker: { color: colors.primary, ...typo.mono, fontSize: textSize.micro, letterSpacing: 1.6 },
  city: { marginTop: 6, color: colors.text, ...typo.display, fontSize: 36, lineHeight: 38, letterSpacing: -1.2 },
  when: { color: colors.textSoft, ...typo.bold, fontSize: 36, lineHeight: 38, letterSpacing: -1.2 },
});
