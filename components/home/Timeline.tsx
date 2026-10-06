import { useEffect, useRef, type ReactNode } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import Monogram from '../general/Monogram';
import { parseDateKey } from '../../lib/datetime';
import { colors, rail, space, sun, sunInk, sunOn, textSize, typo } from '../../theme';

// The memories page is one line through time: a dashed cobalt rail, the times
// and dates in mono to its left, a dot on it for each row. Coming plans sit
// above NOW, the nights that happened below it.

export const RAIL_WIDTH = 70;
// Where the line runs, from the left edge. Labels sit to its left, dots on it.
export const LINE_X = 46;
const DASHES = 120;
const DOT = 12;
// Every node is this wide, centred on the line; labels hang off its left.
const NODE_W = 24;
const LABEL_W = LINE_X - DOT / 2 - 5;

type RowProps = {
  // What sits on the line for this row: a date, TODAY, a group marker.
  node?: ReactNode;
  children: ReactNode;
  // The first row of the page draws no line above its node.
  first?: boolean;
  // Rows come in one after another on the first load.
  enterIndex?: number;
  // Below NOW the line is fainter: that part happened. Above it, full cobalt.
  solid?: boolean;
};

export function TimelineRow({ node, children, first = false, enterIndex, solid = false }: RowProps) {
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
            <View key={i} style={[styles.dash, solid && styles.dashHappened]} />
          ))}
        </View>
        <View style={styles.nodeBox} pointerEvents="box-none">
          {node}
        </View>
      </View>
      <View style={styles.content}>{children}</View>
    </Animated.View>
  );
}

// "Sat 10" on the line, to the left of its dot. A night you haven't seen yet
// gets a filled, breathing dot; one you have, a grey hollow one; another
// parea's night, its avatar; a night still to come, a hollow blue one.
export function DateNode({
  date,
  kind,
  parea,
}: {
  date: string;
  kind: 'new' | 'seen' | 'future' | 'ask' | 'parea' | 'selected';
  parea?: { name: string; avatarUrl: string | null };
}) {
  const d = parseDateKey(date);
  const weekday = d ? d.toLocaleDateString('en-US', { weekday: 'short' }) : '';
  const day = d ? String(d.getDate()) : '';

  return (
    <View style={styles.node} accessibilityLabel={d ? d.toDateString() : undefined}>
      <View style={styles.label}>
        <Text style={[styles.labelText, kind === 'seen' && styles.labelOver]}>{weekday}</Text>
        <Text style={[styles.labelDay, kind === 'seen' && styles.labelOver]}>{day}</Text>
      </View>
      {kind === 'new' ? <NewHole /> : null}
      {kind === 'seen' ? <View style={[styles.dot, styles.dotOver]} /> : null}
      {kind === 'future' || kind === 'ask' ? <View style={styles.dot} /> : null}
      {kind === 'selected' ? <View style={[styles.dot, styles.dotSelected]} /> : null}
      {kind === 'parea' && parea ? (
        <Monogram name={parea.name} uri={parea.avatarUrl} size={22} style={styles.face} />
      ) : null}
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
      <View style={[styles.dot, styles.dotSelected]} />
    </View>
  );
}

// The yellow NOW tag across the line; "2 to go" under it when today has plans left.
export function TodayNode({ note }: { note?: string }) {
  return (
    <View style={styles.node}>
      <View style={styles.nowTag}>
        <Text style={styles.nowTagText}>NOW</Text>
      </View>
      {note ? <Text style={styles.todayCount}>{note}</Text> : null}
    </View>
  );
}

// Inside today the rail gives the hour instead of the day: "17:00" in mono,
// left of a hollow blue dot. Sun while it is on, filled blue when chosen,
// grey once it is over.
export function TimeNode({
  time,
  kind,
}: {
  time?: string;
  kind: 'later' | 'ask' | 'live' | 'over' | 'selected';
}) {
  return (
    <View style={styles.node}>
      <View style={styles.label}>
        <Text style={[styles.labelText, kind === 'over' && styles.labelOver]}>{time ?? 'Day'}</Text>
      </View>
      <View
        style={[
          styles.dot,
          kind === 'live' && styles.dotLive,
          kind === 'over' && styles.dotOver,
          kind === 'selected' && styles.dotSelected,
        ]}
      />
    </View>
  );
}

// Two short lines on the line where Home would put a date: "YES" over "2/3"
// on Votes, "LEFT" over "3d" on an invite, or a weekday over its day when the
// date isn't a plan's. The dot says whose move it is: yours (ask, filled),
// the others' (wait), or nobody's any more (over, greyed).
export function TallyNode({
  label,
  value,
  kind,
  accessibilityLabel,
}: {
  label: string;
  value: string;
  kind: 'ask' | 'wait' | 'over';
  accessibilityLabel?: string;
}) {
  return (
    <View style={styles.node} accessible={accessibilityLabel !== undefined} accessibilityLabel={accessibilityLabel}>
      <View style={styles.label}>
        <Text style={[styles.labelText, kind === 'over' && styles.labelOver]}>{label}</Text>
        <Text style={[styles.labelDay, kind === 'over' && styles.labelOver]}>{value}</Text>
      </View>
      <View style={[styles.dot, kind === 'ask' && styles.dotSelected, kind === 'over' && styles.dotOver]} />
    </View>
  );
}

// A small tag across the line, like NOW: on Votes, "DECIDED" above the
// votes that are over.
export function MarkerNode({ label }: { label: string }) {
  return (
    <View style={styles.node}>
      <View style={[styles.nowTag, styles.marker]}>
        <Text style={[styles.nowTagText, styles.markerText]}>{label.toUpperCase()}</Text>
      </View>
    </View>
  );
}

// A tiny blue ticket on the line where a stretch of time starts: "This week".
// Stretches still to come are filled, ones that happened an outline.
export function GroupNode({ hollow = false }: { hollow?: boolean }) {
  return (
    <View style={[styles.node, styles.groupNode]}>
      <View style={styles.stub}>
        <View style={[styles.stubLeft, hollow ? styles.stubHollow : styles.stubFilled]} />
        <View style={[styles.stubRight, hollow ? styles.stubHollow : styles.stubFilled]} />
      </View>
    </View>
  );
}

// "This weekend" in blue, with what is in it in small grey after it.
export function GroupTitle({ kicker, title, meta }: { kicker: string; title: string; meta?: string }) {
  return (
    <View style={styles.group} accessibilityRole="header">
      <Text style={styles.kicker}>{kicker}</Text>
      <Text style={styles.groupMeta} numberOfLines={1}>
        {[title, meta].filter(Boolean).join(', ')}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', paddingRight: space.md },
  rail: { width: RAIL_WIDTH },
  line: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: LINE_X - 1,
    width: 2,
    overflow: 'hidden',
    gap: 4,
  },
  lineFromNode: { top: 14 },
  dash: { width: 2, height: 7, borderRadius: 1, backgroundColor: rail },
  // The part of the line that already happened, a little quieter.
  dashHappened: { opacity: 0.55 },
  // Nodes are centred on the line, not on the rail.
  nodeBox: { position: 'absolute', top: 0, left: LINE_X - NODE_W / 2, width: NODE_W, alignItems: 'center' },
  content: { flex: 1, minWidth: 0, paddingBottom: space.sm + 2 },

  node: { width: NODE_W, alignItems: 'center', paddingTop: 14 },
  label: { position: 'absolute', top: 11, right: NODE_W / 2 + DOT / 2 + 5, width: LABEL_W + 10, alignItems: 'flex-end' },
  labelText: { color: colors.accentInk, ...typo.mono, fontWeight: '600', fontSize: textSize.caption },
  labelDay: { color: colors.accentInk, ...typo.mono, fontWeight: '700', fontSize: textSize.small, marginTop: 1 },
  labelOver: { color: colors.textFaint },
  dot: {
    width: DOT,
    height: DOT,
    borderRadius: DOT / 2,
    borderWidth: 2,
    borderColor: colors.primary,
    backgroundColor: colors.surface,
  },
  dotLive: { borderColor: sun, backgroundColor: sun },
  dotOver: { borderColor: colors.textFaint },
  dotSelected: { backgroundColor: colors.primary },
  newWrap: { width: DOT, height: DOT, alignItems: 'center', justifyContent: 'center' },
  halo: { position: 'absolute', width: DOT, height: DOT, borderRadius: DOT / 2, backgroundColor: colors.primary },
  face: { borderRadius: 7, borderWidth: 2, borderColor: colors.bg, marginTop: -4 },

  // NOW reads across the line: its right edge just past the rail.
  nowTag: {
    position: 'absolute',
    top: 4,
    right: NODE_W / 2 - 4,
    height: 20,
    minWidth: 32,
    paddingHorizontal: 5,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: sun,
  },
  nowTagText: { color: sunOn, ...typo.mono, fontWeight: '700', fontSize: textSize.micro },
  todayCount: {
    position: 'absolute',
    top: 28,
    right: NODE_W / 2 + 6,
    width: 60,
    textAlign: 'right',
    color: sunInk,
    ...typo.semi,
    fontSize: textSize.micro,
  },
  marker: { backgroundColor: colors.ink },
  markerText: { color: colors.onInk, letterSpacing: 0.6 },

  groupNode: { paddingTop: 6 },
  // A 16 by 11 ticket with a tear a little past the middle.
  stub: { width: 16, height: 11, flexDirection: 'row', gap: 1.5 },
  stubLeft: { width: 10, height: 11, borderTopLeftRadius: 2.5, borderBottomLeftRadius: 2.5 },
  stubRight: { width: 4.5, height: 11, borderTopRightRadius: 2.5, borderBottomRightRadius: 2.5 },
  stubFilled: { backgroundColor: colors.primary },
  stubHollow: { borderWidth: 1.5, borderColor: colors.primary, backgroundColor: colors.bg },
  group: { flexDirection: 'row', alignItems: 'baseline', gap: space.xs, paddingTop: 2, minHeight: 24 },
  kicker: { color: colors.accentInk, ...typo.bold, fontSize: textSize.lead, letterSpacing: -0.3 },
  groupMeta: { flexShrink: 1, color: colors.textFaint, ...typo.medium, fontSize: textSize.small },
});
