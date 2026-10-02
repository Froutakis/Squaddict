import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import type { MyEvent } from '../../services/serviceEvents';
import { colors, radius, solidFor, space, textSize, typo } from '../../theme';

type TodayWalletProps = {
  // Today's plans, the one that should be in front first.
  plans: MyEvent[];
  // The whole ticket for the plan in front (Home gives it the RSVP, check-in
  // and photo actions).
  renderFront: (plan: MyEvent) => ReactNode;
  onThrowPlan: () => void;
};

const STRIP = 50;
const OVERLAP = 14;

// Today, as a wallet: the plan that matters most in front, whole; the rest of
// today's plans as strips peeking out behind it. Tap a strip and the front
// ticket sinks back while that one rises into its place.
export default function TodayWallet({ plans, renderFront, onThrowPlan }: TodayWalletProps) {
  const [frontId, setFrontId] = useState<string | null>(plans[0]?.id ?? null);
  const swap = useRef(new Animated.Value(0)).current;
  const busy = useRef(false);

  // A new day or a new first plan resets which one is in front.
  const firstId = plans[0]?.id ?? null;
  useEffect(() => {
    setFrontId(firstId);
  }, [firstId]);

  if (plans.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyTitle}>Nothing tonight. Suspicious.</Text>
        <Pressable
          onPress={onThrowPlan}
          accessibilityRole="button"
          accessibilityLabel="Throw out a plan"
          style={({ pressed }) => [styles.emptyButton, pressed && styles.pressed]}
        >
          <Text style={styles.emptyButtonText}>Throw out a plan</Text>
        </Pressable>
      </View>
    );
  }

  const front = plans.find((plan) => plan.id === frontId) ?? plans[0];
  const behind = plans.filter((plan) => plan.id !== front.id);

  function bringForward(id: string) {
    if (busy.current) return;
    busy.current = true;
    Animated.timing(swap, { toValue: 1, duration: 150, easing: Easing.in(Easing.quad), useNativeDriver: true }).start(() => {
      setFrontId(id);
      Animated.spring(swap, { toValue: 0, friction: 7, tension: 90, useNativeDriver: true }).start(() => {
        busy.current = false;
      });
    });
  }

  return (
    <View>
      {behind.map((plan) => (
        <Pressable
          key={plan.id}
          onPress={() => bringForward(plan.id)}
          accessibilityRole="button"
          accessibilityLabel={`${plan.title}${plan.startTime ? ` at ${plan.startTime}` : ''}. Bring it to the front`}
          style={({ pressed }) => [styles.strip, { backgroundColor: solidFor(plan.groupName) }, pressed && styles.stripPressed]}
        >
          <Text style={styles.stripTime}>{plan.startTime ?? 'TODAY'}</Text>
          <Text style={styles.stripTitle} numberOfLines={1}>
            {plan.title}
          </Text>
          <StatusChip plan={plan} />
        </Pressable>
      ))}

      <Animated.View
        style={[
          styles.front,
          {
            opacity: swap.interpolate({ inputRange: [0, 1], outputRange: [1, 0.2] }),
            transform: [
              { translateY: swap.interpolate({ inputRange: [0, 1], outputRange: [0, 22] }) },
              { scale: swap.interpolate({ inputRange: [0, 1], outputRange: [1, 0.96] }) },
            ],
          },
        ]}
      >
        {renderFront(front)}
      </Animated.View>
    </View>
  );
}

function StatusChip({ plan }: { plan: MyEvent }) {
  if (plan.myStatus === 'in') {
    return <Text style={[styles.chip, styles.chipIn]}>YOU'RE IN</Text>;
  }
  if (plan.myStatus === undefined) {
    return <Text style={[styles.chip, styles.chipAsk]}>ANSWER</Text>;
  }
  return null;
}

const styles = StyleSheet.create({
  pressed: { transform: [{ scale: 0.97 }] },

  strip: {
    height: STRIP,
    marginBottom: -OVERLAP,
    paddingTop: 9,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space.sm,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
  },
  stripPressed: { transform: [{ translateY: -3 }] },
  stripTime: { color: 'rgba(255,255,255,0.85)', ...typo.mono, fontSize: textSize.caption, letterSpacing: 1, paddingTop: 2 },
  stripTitle: { flex: 1, color: '#FFFFFF', ...typo.display, fontSize: textSize.base },
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

  front: { position: 'relative' },


  empty: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    minHeight: 56,
    paddingHorizontal: 14,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: '#B9C6F3',
  },
  emptyTitle: { flex: 1, color: colors.textSoft, ...typo.semi, fontSize: textSize.body },
  emptyButton: { minHeight: 40, justifyContent: 'center', paddingHorizontal: space.sm },
  emptyButtonText: { color: colors.primary, ...typo.display, fontSize: textSize.body },
});
