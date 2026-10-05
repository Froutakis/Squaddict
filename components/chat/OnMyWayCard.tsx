import { useEffect, useRef } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, Animated, Easing, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import type { OnMyWay } from '../../services/serviceLiveLocation';
import { placeLines } from '../../lib/place';
import Ticket from '../general/Ticket';
import { CARD_WIDTH } from './ChatVoteCard';
import { colors, radius, space, textSize, typo } from '../../theme';

const ON_INK_SOFT = 'rgba(255,255,255,0.72)';
const ON_INK_LINE = 'rgba(255,255,255,0.3)';

type OnMyWayCardProps = {
  card: OnMyWay;
  mine: boolean;
  senderName: string;
  // Still sharing: not stopped, and the plan's night is not over.
  live: boolean;
  busy: boolean;
  onStop: () => void;
  onOpenMap: () => void;
};

// Someone on their way to tonight's plan, sharing their spot on its map. A
// small drawn map, not a real one: where they are is on the plan's own map.
export default function OnMyWayCard({ card, mine, senderName, live, busy, onStop, onOpenMap }: OnMyWayCardProps) {
  const where = placeLines(card.event.location, card.event.placeLabel).primary;
  const who = mine ? 'You are' : `${senderName || 'Someone'} is`;
  const line = live
    ? mine
      ? "Your spot is on the plan's map"
      : "Their spot is on the plan's map"
    : 'Location off';

  return (
    <Ticket
      tone="ink"
      notches={false}
      style={styles.card}
      stub={
        busy ? (
          <ActivityIndicator color={colors.onInk} style={styles.spinner} />
        ) : live && mine ? (
          <Pressable
            onPress={onStop}
            accessibilityRole="button"
            accessibilityLabel="Stop sharing your spot"
            style={({ pressed }) => [styles.outline, pressed && styles.pressed]}
          >
            <Ionicons name="stop-circle-outline" size={16} color={colors.onInk} />
            <Text style={styles.outlineText}>Stop sharing</Text>
          </Pressable>
        ) : live ? (
          <Pressable
            onPress={onOpenMap}
            accessibilityRole="button"
            accessibilityLabel={`See ${senderName || 'them'} on the plan's map`}
            style={({ pressed }) => [styles.outline, pressed && styles.pressed]}
          >
            <Ionicons name="map-outline" size={16} color={colors.onInk} />
            <Text style={styles.outlineText}>See on the map</Text>
          </Pressable>
        ) : undefined
      }
    >
      <View
        style={styles.map}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        <View style={[styles.road, styles.roadAcross]} />
        <View style={[styles.road, styles.roadDown]} />
        <View style={[styles.road, styles.roadDiagonal]} />
        <View style={styles.route}>
          {Array.from({ length: 9 }, (_, i) => (
            <View key={i} style={styles.routeDot} />
          ))}
        </View>
        {live ? <You /> : null}
        <View style={styles.venue}>
          <Ionicons name="wine" size={14} color={colors.onInk} />
        </View>
      </View>

      <View style={styles.body}>
        <View style={styles.kickerRow}>
          {live ? <View style={styles.liveDot} /> : null}
          <Text style={styles.kicker}>{live ? 'On the way · live' : 'Stopped sharing'}</Text>
        </View>
        <Text
          style={styles.title}
          numberOfLines={2}
          accessibilityLabel={`${who} on the way to ${card.event.title}${where ? `, ${where}` : ''}. ${line}`}
        >
          {card.event.title}
        </Text>
        <Text style={styles.line} numberOfLines={1}>
          {line}
        </Text>
      </View>
    </Ticket>
  );
}

// Your dot, with a ring that keeps going out.
function You() {
  const ring = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(ring, {
        toValue: 1,
        duration: 1600,
        easing: Easing.out(Easing.quad),
        useNativeDriver: Platform.OS !== 'web',
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [ring]);

  return (
    <View style={styles.you}>
      <Animated.View
        style={[
          styles.youRing,
          {
            opacity: ring.interpolate({ inputRange: [0, 1], outputRange: [0.5, 0] }),
            transform: [{ scale: ring.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1.4] }) }],
          },
        ]}
      />
      <View style={styles.youDot} />
    </View>
  );
}

const MAP_HEIGHT = 104;

const styles = StyleSheet.create({
  card: { width: CARD_WIDTH },
  pressed: { opacity: 0.8 },
  spinner: { height: 44 },

  // Ticket pads its top half; the map runs edge to edge.
  map: {
    height: MAP_HEIGHT,
    marginHorizontal: -space.md,
    marginTop: -space.md,
    backgroundColor: colors.surfaceAlt,
    overflow: 'hidden',
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
  },
  road: { position: 'absolute', backgroundColor: colors.surface },
  roadAcross: { left: 0, right: 0, top: 58, height: 5 },
  roadDown: { top: 0, bottom: 0, left: 150, width: 5 },
  roadDiagonal: { left: -20, width: 200, top: 18, height: 6, transform: [{ rotate: '-24deg' }] },
  route: {
    position: 'absolute',
    left: 64,
    top: 38,
    width: 150,
    flexDirection: 'row',
    justifyContent: 'space-between',
    transform: [{ rotate: '-14deg' }],
  },
  routeDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: colors.primary },
  you: { position: 'absolute', left: 48, top: 52, width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
  youRing: { position: 'absolute', width: 28, height: 28, borderRadius: 14, backgroundColor: colors.primary },
  youDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 3,
    borderColor: colors.surface,
    backgroundColor: colors.primary,
  },
  venue: {
    position: 'absolute',
    left: 214,
    top: 14,
    width: 30,
    height: 30,
    borderTopLeftRadius: 10,
    borderTopRightRadius: 10,
    borderBottomRightRadius: 10,
    borderBottomLeftRadius: 2,
    backgroundColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },

  body: { paddingTop: space.sm + 2 },
  kickerRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.danger },
  kicker: {
    color: ON_INK_SOFT,
    ...typo.mono,
    fontSize: textSize.micro,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  title: {
    marginTop: 6,
    marginBottom: 4,
    color: colors.onInk,
    ...typo.display,
    fontSize: 18,
    lineHeight: 21,
    letterSpacing: -0.5,
  },
  line: {
    color: ON_INK_SOFT,
    ...typo.mono,
    fontSize: textSize.caption,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },

  outline: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: radius.sm + 2,
    borderWidth: 1,
    borderColor: ON_INK_LINE,
  },
  outlineText: { color: colors.onInk, ...typo.display, fontSize: textSize.base },
});
