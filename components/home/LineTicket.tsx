import { useEffect, useRef } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import type { MyEvent } from '../../services/serviceEvents';
import { brand, colors, radius, space, textSize, typo } from '../../theme';

const DASHES = 24;
const PAST_BLUE = '#33415A';

// Where a plan stands against the clock.
export type DayPhase = 'past' | 'live' | 'later';

type LineTicketProps = {
  event: MyEvent;
  phase: DayPhase;
  kicker: string;
  // "Νίκος, Ελένη +3 in", "3 here now".
  people: string | null;
  checkedIn: boolean;
  onOpen: () => void;
  onIn: () => void;
  onPass: () => void;
  // Tapping the answer you already gave takes it back.
  onClear: () => void;
  onCheckIn: () => void;
  onAddPhoto: () => void;
};

// One plan on the line as a small ticket: what and when on the left, the one
// thing to do about it now on the stub.
export default function LineTicket({
  event,
  phase,
  kicker,
  people,
  checkedIn,
  onOpen,
  onIn,
  onPass,
  onClear,
  onCheckIn,
  onAddPhoto,
}: LineTicketProps) {
  const isIn = event.myStatus === 'in';
  const passed = event.myStatus === 'out';
  const place = event.placeLabel ?? event.location;
  const line = [event.groupName, people ?? shortPlace(place) ?? 'Nobody in yet'].filter(Boolean).join(' · ');

  return (
    <View style={[styles.ticket, phase === 'past' && styles.ticketPast]}>
      <Pressable
        onPress={onOpen}
        accessibilityRole="button"
        accessibilityLabel={`${event.title}. ${kicker}. Open the plan`}
        style={({ pressed }) => [styles.main, pressed && styles.pressed]}
      >
        <View style={styles.kickerRow}>
          {phase === 'live' ? <LiveDot /> : null}
          <Text style={styles.kicker} numberOfLines={1}>
            {kicker}
          </Text>
        </View>
        <Text style={styles.title} numberOfLines={2}>
          {event.title}
        </Text>
        <Text style={styles.line} numberOfLines={1}>
          {line}
        </Text>
      </Pressable>

      <View style={styles.perf} pointerEvents="none">
        <View style={styles.dashes}>
          {Array.from({ length: DASHES }, (_, i) => (
            <View key={i} style={styles.dash} />
          ))}
        </View>
      </View>

      <View style={styles.stub}>
        {phase === 'past' ? (
          isIn ? (
            <>
              <Action label="Photos" icon="camera" strong onPress={onAddPhoto} />
              <Action label="The night" onPress={onOpen} />
            </>
          ) : (
            <Action label="Open" strong onPress={onOpen} />
          )
        ) : !isIn ? (
          <>
            <Action label="I'm in" strong onPress={onIn} />
            <Action
              label={passed ? 'Passed' : 'Pass'}
              hint={passed ? 'Takes back your answer' : undefined}
              onPress={passed ? onClear : onPass}
            />
          </>
        ) : phase === 'live' && !checkedIn ? (
          <>
            <Action label="I'm here" icon="location" strong onPress={onCheckIn} />
            <Action label="Open" onPress={onOpen} />
          </>
        ) : phase === 'live' ? (
          <>
            <Action label="Photo" icon="camera" strong onPress={onAddPhoto} />
            <Action label="Open" onPress={onOpen} />
          </>
        ) : (
          <>
            <Pressable
              onPress={onClear}
              accessibilityRole="button"
              accessibilityLabel="You're in"
              accessibilityHint="Takes back your answer"
              accessibilityState={{ selected: true }}
              hitSlop={4}
              style={({ pressed }) => [styles.inChip, pressed && styles.actionPressed]}
            >
              <Ionicons name="checkmark" size={13} color={colors.success} />
              <Text style={styles.inText}>You're in</Text>
            </Pressable>
            <Action label="Pass" onPress={onPass} />
          </>
        )}
      </View>
    </View>
  );
}

// "Θεσσαλονίκη, Δημοτική Ενότητα Θεσσαλονίκης" → "Θεσσαλονίκη".
export function shortPlace(place?: string | null): string | null {
  const first = place?.split(',')[0]?.trim();
  return first ? first : null;
}

function Action({
  label,
  icon,
  hint,
  strong = false,
  disabled = false,
  onPress,
}: {
  label: string;
  hint?: string;
  icon?: 'location' | 'camera';
  strong?: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={hint}
      accessibilityState={{ disabled }}
      hitSlop={4}
      style={({ pressed }) => [
        styles.action,
        strong ? styles.actionStrong : styles.actionSoft,
        disabled && styles.disabled,
        pressed && styles.actionPressed,
      ]}
    >
      {icon ? <Ionicons name={icon} size={13} color={strong ? brand[0] : '#FFFFFF'} /> : null}
      <Text style={[styles.actionText, strong && styles.actionTextStrong]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

// A red dot that breathes while the plan is on.
function LiveDot() {
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 900, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 0, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  return (
    <View style={styles.dotWrap}>
      <Animated.View
        style={[
          styles.dotHalo,
          {
            opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.6, 0] }),
            transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 2.4] }) }],
          },
        ]}
      />
      <View style={styles.dot} />
    </View>
  );
}

const styles = StyleSheet.create({
  ticket: {
    flexDirection: 'row',
    borderRadius: radius.lg,
    backgroundColor: brand[0],
    shadowColor: brand[0],
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.22,
    shadowRadius: 14,
    elevation: 5,
  },
  ticketPast: { backgroundColor: PAST_BLUE, shadowColor: colors.ink, shadowOpacity: 0.16 },
  pressed: { opacity: 0.85 },
  main: { flex: 1, minWidth: 0, paddingVertical: 12, paddingLeft: 14, paddingRight: space.sm, gap: 2 },
  kickerRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  kicker: { flexShrink: 1, color: '#C3CEF7', ...typo.mono, fontSize: textSize.micro, letterSpacing: 1.4 },
  title: { color: '#FFFFFF', ...typo.display, fontSize: textSize.lead, lineHeight: 19 },
  line: { color: '#DCE3FA', ...typo.semi, fontSize: textSize.small },

  // The dashes are as tall as the ticket, not the other way round.
  perf: { width: 2, marginVertical: 8 },
  dashes: { position: 'absolute', top: 0, bottom: 0, left: 0, width: 2, gap: 4, overflow: 'hidden' },
  dash: { width: 2, height: 5, borderRadius: 1, backgroundColor: 'rgba(255,255,255,0.28)' },

  stub: { width: 100, justifyContent: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 10 },
  action: {
    height: 32,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingHorizontal: 4,
    borderRadius: radius.sm,
  },
  actionStrong: { backgroundColor: '#FFFFFF' },
  actionSoft: { backgroundColor: 'rgba(255,255,255,0.14)' },
  actionPressed: { transform: [{ scale: 0.95 }] },
  disabled: { opacity: 0.5 },
  actionText: { color: '#FFFFFF', ...typo.display, fontSize: textSize.small },
  actionTextStrong: { color: brand[0] },
  inChip: {
    height: 32,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    borderRadius: radius.sm,
    backgroundColor: '#E2F1EA',
  },
  inText: { color: colors.success, ...typo.display, fontSize: textSize.small },

  dotWrap: { width: 8, height: 8, alignItems: 'center', justifyContent: 'center' },
  dotHalo: { position: 'absolute', width: 8, height: 8, borderRadius: 4, backgroundColor: colors.danger },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.danger },
});
