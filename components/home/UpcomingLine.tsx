import { useEffect, useRef, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import type { MyEvent } from '../../services/serviceEvents';
import { DateNode, TimelineRow } from './Timeline';
import { colors, radius, solidFor, space, textSize, typo } from '../../theme';

type UpcomingLineProps = {
  // Plans after today, soonest first.
  plans: MyEvent[];
  onOpen: (plan: MyEvent) => void;
};

// What's coming, above TODAY: the line climbs, furthest night at the top.
// Folded by default so the memories stay on the first screen; it says how many
// are coming and how many still need your answer.
export default function UpcomingLine({ plans, onOpen }: UpcomingLineProps) {
  const [open, setOpen] = useState(false);
  const turn = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(turn, { toValue: open ? 1 : 0, duration: 220, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [open, turn]);

  if (plans.length === 0) return null;

  const needYou = plans.filter((plan) => plan.myStatus === undefined).length;
  const label = `${plans.length} coming up${needYou > 0 ? ` · ${needYou} need you` : ''}`;
  // Furthest at the top, so reading down the line walks back towards today.
  const climbing = [...plans].reverse();

  return (
    <>
      {open
        ? climbing.map((plan, i) => (
            <TimelineRow
              key={plan.id}
              first={i === 0}
              enterIndex={climbing.length - 1 - i}
              node={<DateNode date={plan.date} kind="future" />}
            >
              <Pressable
                onPress={() => onOpen(plan)}
                accessibilityRole="button"
                accessibilityLabel={`${plan.title}, ${plan.date}${plan.startTime ? ` at ${plan.startTime}` : ''}`}
                style={({ pressed }) => [styles.mini, pressed && styles.pressed]}
              >
                <View style={[styles.band, { backgroundColor: solidFor(plan.groupName) }]} />
                <View style={styles.miniText}>
                  <Text style={styles.miniTitle} numberOfLines={1}>
                    {plan.title}
                  </Text>
                  <Text style={styles.miniMeta} numberOfLines={1}>
                    {[plan.startTime, plan.placeLabel ?? plan.location, plan.going.length > 0 ? `${plan.going.length} in` : null]
                      .filter(Boolean)
                      .join(' · ')}
                  </Text>
                </View>
                <View style={styles.miniStub}>
                  {plan.myStatus === 'in' ? (
                    <Text style={[styles.chip, styles.chipIn]}>YOU'RE IN</Text>
                  ) : plan.myStatus === undefined ? (
                    <Text style={[styles.chip, styles.chipAsk]}>ANSWER</Text>
                  ) : null}
                </View>
              </Pressable>
            </TimelineRow>
          ))
        : null}

      <TimelineRow
        first={!open}
        node={
          <Animated.View
            style={[styles.toggleNode, { transform: [{ rotate: turn.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '180deg'] }) }] }]}
          >
            <Ionicons name="chevron-up" size={14} color={colors.primary} />
          </Animated.View>
        }
      >
        <Pressable
          onPress={() => setOpen(!open)}
          accessibilityRole="button"
          accessibilityState={{ expanded: open }}
          accessibilityLabel={open ? 'Hide what is coming' : `Show what is coming: ${label}`}
          style={({ pressed }) => [styles.toggle, pressed && styles.pressed]}
        >
          <Text style={styles.toggleText}>{open ? "Hide what's coming" : label}</Text>
        </Pressable>
      </TimelineRow>
    </>
  );
}

const styles = StyleSheet.create({
  pressed: { transform: [{ scale: 0.98 }] },
  mini: {
    flexDirection: 'row',
    height: 60,
    borderRadius: radius.md,
    overflow: 'hidden',
    backgroundColor: colors.surface,
    shadowColor: colors.ink,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 1,
  },
  band: { width: 7 },
  miniText: {
    flex: 1,
    minWidth: 0,
    paddingHorizontal: 12,
    justifyContent: 'center',
    gap: 2,
    borderRightWidth: 1.5,
    borderRightColor: colors.border,
    borderStyle: 'dashed',
  },
  miniTitle: { color: colors.text, ...typo.display, fontSize: textSize.base },
  miniMeta: { color: colors.textSoft, ...typo.semi, fontSize: textSize.small },
  miniStub: { width: 92, alignItems: 'center', justifyContent: 'center' },
  chip: {
    overflow: 'hidden',
    ...typo.mono,
    fontSize: textSize.micro,
    letterSpacing: 1.2,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
  },
  chipIn: { backgroundColor: '#E2F1EA', color: colors.success },
  chipAsk: { backgroundColor: '#FFF3D6', color: '#8A5300' },

  toggleNode: {
    width: 28,
    height: 28,
    borderRadius: 14,
    marginTop: 4,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#B9C6F3',
    backgroundColor: colors.surface,
  },
  toggle: {
    minHeight: 40,
    marginTop: 2,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: '#B9C6F3',
    paddingHorizontal: space.sm,
  },
  toggleText: { color: colors.primary, ...typo.display, fontSize: textSize.body },
});
