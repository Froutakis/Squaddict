import { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { MyEvent, RsvpStatus } from '../services/serviceEvents';
import CalendarCard from '../components/events/CalendarCard';
import EventCard, { type CardEvent } from '../components/events/EventCard';
import { dayFilterLabel, keyOf } from '../lib/datetime';
import { plural } from '../lib/text';
import { colors, layout, radius, space, textSize, typo } from '../theme';

type CalendarScreenProps = {
  // The squad whose month this is, shown under the title.
  squadName?: string;
  events: MyEvent[];
  covers: Record<string, string>;
  toCard: (event: MyEvent) => CardEvent;
  onBack: () => void;
  onOpenEvent: (event: MyEvent) => void;
  onRsvp: (eventId: string, status: RsvpStatus | null) => void;
  onPlan: (date: string) => void;
  // Plays the photos kept from a past day.
  onPlayDay: (date: string) => void;
};

// The squad's month on a page of its own: pick a day, see what is on.
export default function CalendarScreen({
  squadName,
  events,
  covers,
  toCard,
  onBack,
  onOpenEvent,
  onRsvp,
  onPlan,
  onPlayDay,
}: CalendarScreenProps) {
  const today = keyOf(new Date());
  const [selected, setSelected] = useState(today);

  const plans = events.filter((event) => event.date === selected);
  const label = dayFilterLabel(selected);
  const hasPhotos = selected < today && covers[selected] !== undefined;

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.column}>
        <View style={styles.topBar}>
          <Pressable
            onPress={onBack}
            accessibilityRole="button"
            accessibilityLabel="Back to Home"
            hitSlop={8}
            style={({ pressed }) => [styles.back, pressed && styles.pressed]}
          >
            <Ionicons name="chevron-back" size={24} color={colors.text} />
            <Text style={styles.backText}>Home</Text>
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.titles}>
            <Text style={styles.title}>Calendar</Text>
            {squadName ? (
              <Text style={styles.subtitle} numberOfLines={1}>
                {squadName}
              </Text>
            ) : null}
          </View>

          <View style={styles.month}>
            <CalendarCard
              bare
              events={events}
              covers={covers}
              selectedDate={selected}
              onSelectDate={setSelected}
            />
          </View>

          <View style={styles.dayHead}>
            <Text style={styles.day}>{label.charAt(0).toUpperCase() + label.slice(1)}</Text>
            <Text style={styles.count}>
              {plans.length > 0 ? plural(plans.length, 'plan', 'plans') : 'Nothing on'}
            </Text>
          </View>

          {plans.map((event) => (
            <EventCard
              key={event.id}
              event={toCard(event)}
              action={selected >= today ? 'rsvp' : 'none'}
              onPress={() => onOpenEvent(event)}
              onRsvp={(status) => onRsvp(event.id, status)}
            />
          ))}

          {hasPhotos ? (
            <Pressable
              onPress={() => onPlayDay(selected)}
              accessibilityRole="button"
              accessibilityLabel="See the photos from this day"
              style={({ pressed }) => [styles.button, pressed && styles.pressed]}
            >
              <Ionicons name="images-outline" size={18} color={colors.text} />
              <Text style={styles.buttonText}>See the photos</Text>
            </Pressable>
          ) : null}

          {selected >= today ? (
            <Pressable
              onPress={() => onPlan(selected)}
              accessibilityRole="button"
              accessibilityLabel="Plan something on this day"
              style={({ pressed }) => [styles.button, pressed && styles.pressed]}
            >
              <Ionicons name="add" size={18} color={colors.primary} />
              <Text style={[styles.buttonText, styles.buttonPrimary]}>
                {plans.length > 0 ? 'Plan something else' : 'Plan something'}
              </Text>
            </Pressable>
          ) : null}
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: colors.bg },
  column: { flex: 1, width: '100%', maxWidth: layout.column, alignSelf: 'center' },
  pressed: { opacity: 0.6 },

  topBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.xs, height: 48 },
  back: { flexDirection: 'row', alignItems: 'center', gap: 2, paddingRight: space.sm, minHeight: 44 },
  backText: { color: colors.text, ...typo.semi, fontSize: textSize.lead },

  content: { paddingHorizontal: space.lg, paddingBottom: 130, gap: space.sm },
  titles: { gap: 2, marginBottom: space.xs },
  title: { color: colors.text, ...typo.display, fontSize: textSize.hero, letterSpacing: -0.6 },
  subtitle: { color: colors.textSoft, ...typo.medium, fontSize: textSize.base },

  month: {
    paddingHorizontal: space.sm,
    paddingBottom: space.sm,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },

  dayHead: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginTop: space.sm,
  },
  day: { color: colors.text, ...typo.title, fontSize: textSize.heading, letterSpacing: -0.3 },
  count: { color: colors.textFaint, ...typo.mono, fontSize: textSize.body },

  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.xs,
    height: 46,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  buttonText: { color: colors.text, ...typo.semi, fontSize: textSize.base },
  buttonPrimary: { color: colors.primary },
});
