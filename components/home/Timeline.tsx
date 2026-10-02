import { useEffect, useRef, type ReactNode } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import Monogram from '../general/Monogram';
import { parseDateKey } from '../../lib/datetime';
import { colors, radius, space, textSize, typo } from '../../theme';

// The memories page is one line through time: the dates down the left, a
// dashed perforation joining them, and each night hanging off its date. Coming
// plans sit above TODAY, the nights that happened below it.

export const RAIL_WIDTH = 72;
const LINE = '#B9C6F3';
const DASHES = 120;

type RowProps = {
  // What sits on the line for this row: a date, TODAY, a group marker.
  node?: ReactNode;
  children: ReactNode;
  // The first row of the page draws no line above its node.
  first?: boolean;
  // Rows come in one after another on the first load.
  enterIndex?: number;
};

export function TimelineRow({ node, children, first = false, enterIndex }: RowProps) {
  const enter = useRef(new Animated.Value(enterIndex === undefined ? 1 : 0)).current;

  useEffect(() => {
    if (enterIndex === undefined) return;
    Animated.timing(enter, {
      toValue: 1,
      duration: 320,
      delay: Math.min(enterIndex, 8) * 60,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [enter, enterIndex]);

  return (
    <Animated.View
      style={[
        styles.row,
        {
          opacity: enter,
          transform: [{ translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) }],
        },
      ]}
    >
      <View style={styles.rail}>
        <View style={[styles.line, first && styles.lineFromNode]} pointerEvents="none">
          {Array.from({ length: DASHES }, (_, i) => (
            <View key={i} style={styles.dash} />
          ))}
        </View>
        {node}
      </View>
      <View style={styles.content}>{children}</View>
    </Animated.View>
  );
}

// "WED 30" on the line. A night you haven't seen yet gets a filled, breathing
// hole; one you have, an outlined hole; another parea's night, its avatar;
// a night still to come, a dashed hole.
export function DateNode({
  date,
  kind,
  parea,
}: {
  date: string;
  kind: 'new' | 'seen' | 'future' | 'parea';
  parea?: { name: string; avatarUrl: string | null };
}) {
  const d = parseDateKey(date);
  const weekday = d ? d.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase() : '';
  const day = d ? String(d.getDate()).padStart(2, '0') : '';

  return (
    <View style={styles.node} accessibilityLabel={d ? d.toDateString() : undefined}>
      {kind === 'new' ? <NewHole /> : null}
      {kind === 'seen' ? <View style={[styles.hole, styles.holeSeen]} /> : null}
      {kind === 'future' ? <View style={[styles.hole, styles.holeFuture]} /> : null}
      {kind === 'parea' && parea ? (
        <Monogram name={parea.name} uri={parea.avatarUrl} size={24} style={styles.face} />
      ) : null}
      <Text style={styles.weekday}>{weekday}</Text>
      <Text style={styles.day}>{day}</Text>
    </View>
  );
}

function NewHole() {
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 1100, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 0, useNativeDriver: true }),
        Animated.delay(900),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  return (
    <View style={styles.newWrap}>
      <Animated.View
        style={[
          styles.halo,
          {
            opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.45, 0] }),
            transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 2.2] }) }],
          },
        ]}
      />
      <View style={[styles.hole, styles.holeNew]} />
    </View>
  );
}

// "2 tonight" under it when today has more than one plan.
export function TodayNode({ note }: { note?: string }) {
  return (
    <View style={styles.node}>
      <Text style={styles.today}>TODAY</Text>
      {note ? <Text style={styles.todayCount}>{note}</Text> : null}
    </View>
  );
}

// A diamond on the line where a stretch of time starts: "This week".
export function GroupNode() {
  return (
    <View style={styles.groupNode}>
      <View style={styles.diamond} />
    </View>
  );
}

export function GroupTitle({ kicker, title, meta }: { kicker: string; title: string; meta?: string }) {
  return (
    <View style={styles.group} accessibilityRole="header">
      <Text style={styles.kicker}>{kicker.toUpperCase()}</Text>
      <Text style={styles.groupTitle}>{title}</Text>
      {meta ? <Text style={styles.groupMeta}>{meta}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', paddingRight: space.md },
  rail: { width: RAIL_WIDTH, alignItems: 'center' },
  line: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: RAIL_WIDTH / 2 - 1,
    width: 2,
    overflow: 'hidden',
    gap: 4,
  },
  lineFromNode: { top: 14 },
  dash: { width: 2, height: 5, borderRadius: 1, backgroundColor: LINE },
  content: { flex: 1, minWidth: 0, paddingBottom: space.md },

  node: { alignItems: 'center', paddingTop: 4, backgroundColor: colors.bg, paddingBottom: 2 },
  hole: { width: 16, height: 16, borderRadius: 8, marginBottom: 6, backgroundColor: colors.bg },
  holeSeen: { borderWidth: 2.5, borderColor: colors.primary },
  holeFuture: { borderWidth: 2, borderStyle: 'dashed', borderColor: colors.primary },
  holeNew: { backgroundColor: colors.primary },
  newWrap: { width: 16, height: 16, marginBottom: 6, alignItems: 'center', justifyContent: 'center' },
  halo: { position: 'absolute', width: 16, height: 16, borderRadius: 8, backgroundColor: colors.primary },
  face: { borderRadius: 8, marginBottom: 4, borderWidth: 2, borderColor: colors.bg },
  weekday: { color: colors.textSoft, ...typo.mono, fontSize: textSize.micro, letterSpacing: 1.2 },
  day: { color: colors.text, ...typo.display, fontSize: 20, lineHeight: 22 },

  today: {
    overflow: 'hidden',
    color: colors.onInk,
    backgroundColor: colors.ink,
    ...typo.mono,
    fontSize: textSize.micro,
    letterSpacing: 1.2,
    paddingHorizontal: 7,
    paddingVertical: 4,
    borderRadius: radius.pill,
  },
  todayCount: { marginTop: 6, color: colors.textSoft, ...typo.semi, fontSize: textSize.caption },

  groupNode: { paddingTop: 8, backgroundColor: colors.bg, paddingBottom: 4 },
  diamond: { width: 13, height: 13, borderRadius: 3, backgroundColor: colors.primary, transform: [{ rotate: '45deg' }] },
  group: { gap: 1, paddingTop: 2 },
  kicker: { color: colors.primary, ...typo.mono, fontSize: textSize.micro, letterSpacing: 1.4 },
  groupTitle: { color: colors.text, ...typo.display, fontSize: 18, letterSpacing: -0.3 },
  groupMeta: { color: colors.textSoft, ...typo.semi, fontSize: textSize.small },
});
