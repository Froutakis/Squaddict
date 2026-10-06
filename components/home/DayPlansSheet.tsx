import { Ionicons } from '@expo/vector-icons';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { MyEvent, RsvpStatus } from '../../services/serviceEvents';
import EventCard, { type CardEvent } from '../events/EventCard';
import { colors, radius, space, textSize, typo } from '../../theme';
import { plural } from '../../lib/text';

type DayPlansSheetProps = {
  label: string | null;
  plans: MyEvent[];
  toCard: (event: MyEvent) => CardEvent;
  onOpen: (event: MyEvent) => void;
  onRsvp: (eventId: string, status: RsvpStatus | null) => void;
  onPlan: () => void;
  onClose: () => void;
};

// The plans of one day, opened from the calendar when there is more than one.
export default function DayPlansSheet({
  label,
  plans,
  toCard,
  onOpen,
  onRsvp,
  onPlan,
  onClose,
}: DayPlansSheetProps) {
  return (
    <Modal visible={label !== null} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          <View style={styles.grabber} />

          <View style={styles.head}>
            <Text style={styles.title}>{label ? label.charAt(0).toUpperCase() + label.slice(1) : null}</Text>
            <Text style={styles.count}>
              {plural(plans.length, 'plan', 'plans')}
            </Text>
          </View>

          <ScrollView contentContainerStyle={styles.list}>
            {plans.map((event) => (
              <EventCard
                key={event.id}
                event={toCard(event)}
                action="rsvp"
                onPress={() => onOpen(event)}
                onRsvp={(status) => onRsvp(event.id, status)}
              />
            ))}
          </ScrollView>

          <Pressable
            onPress={onPlan}
            accessibilityRole="button"
            accessibilityLabel="Plan something else that day"
            style={({ pressed }) => [styles.plan, pressed && styles.pressed]}
          >
            <Ionicons name="add" size={18} color={colors.primary} />
            <Text style={styles.planText}>Plan something else that day</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: {
    maxHeight: '80%',
    paddingHorizontal: space.lg,
    paddingTop: space.sm,
    paddingBottom: space.xl,
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
    backgroundColor: colors.bg,
  },
  grabber: {
    width: 40,
    height: 4,
    alignSelf: 'center',
    marginBottom: space.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.borderStrong,
  },
  head: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: space.sm },
  title: { color: colors.text, ...typo.display, fontSize: textSize.heading, letterSpacing: -0.3 },
  count: { color: colors.textFaint, ...typo.mono, fontSize: textSize.caption },
  list: { gap: space.sm, paddingBottom: space.sm },
  plan: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.xs,
    marginTop: space.xs,
    paddingVertical: space.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  planText: { color: colors.primary, ...typo.semi, fontSize: textSize.base },
  pressed: { opacity: 0.7 },
});
