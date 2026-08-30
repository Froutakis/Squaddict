import { StyleSheet, View } from 'react-native';
import { colors, sun } from '../../theme';

export type PunchState = 'open' | 'in' | 'out';

type PunchProps = {
  state: PunchState;
  size?: number;
  onDark?: boolean;
  holeColor?: string;
};

export default function Punch({ state, size = 26, onDark = false, holeColor }: PunchProps) {
  const base = { width: size, height: size, borderRadius: size / 2 };

  if (state === 'in') {
    return (
      <View
        style={[
          base,
          styles.hole,
          {
            backgroundColor: holeColor ?? (onDark ? '#05090D' : colors.bg),
            borderWidth: Math.max(2.5, Math.round(size * 0.12)),
          },
        ]}
      />
    );
  }

  if (state === 'out') {
    return (
      <View style={[base, styles.out, onDark ? styles.outDark : styles.outLight]}>
        <View style={[styles.bar, { width: size * 0.42 }, onDark ? styles.barDark : styles.barLight]} />
      </View>
    );
  }

  return <View style={[base, styles.open, onDark ? styles.openDark : styles.openLight]} />;
}

const styles = StyleSheet.create({
  hole: { borderColor: sun },

  open: { borderWidth: 1.6, borderStyle: 'dashed' },
  openLight: { borderColor: colors.borderStrong },
  openDark: { borderColor: 'rgba(255,255,255,0.42)' },

  out: { alignItems: 'center', justifyContent: 'center', borderWidth: 1.6 },
  outLight: { backgroundColor: colors.surfaceAlt, borderColor: colors.border },
  outDark: { backgroundColor: 'rgba(255,255,255,0.12)', borderColor: 'rgba(255,255,255,0.22)' },

  bar: { height: 2, borderRadius: 1 },
  barLight: { backgroundColor: colors.textFaint },
  barDark: { backgroundColor: 'rgba(255,255,255,0.65)' },
});
