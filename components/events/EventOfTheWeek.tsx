import { StyleSheet, Text, View } from 'react-native';
import type { MyEvent } from '../../services/serviceEvents';
import { colors, font, space, textSize } from '../../theme';
import { addDays, keyOf } from '../../lib/datetime';
import SectionLabel from '../general/SectionLabel';
import EventCard, { type EventCardData } from './EventCard';

export function bestOfWeek(events: MyEvent[], today: Date): MyEvent | null {
  const from = keyOf(addDays(today, -7));
  const to = keyOf(addDays(today, -1));

  let best: MyEvent | null = null;

  for (const event of events) {
    if (event.myStatus !== 'in') continue;
    if (event.date < from || event.date > to) continue;

    if (best === null) {
      best = event;
      continue;
    }

    if (event.going.length > best.going.length) {
      best = event;
    } else if (event.going.length === best.going.length && event.date > best.date) {
      best = event;
    }
  }

  return best;
}

function caption(count: number): string {
  if (count <= 1) return 'You were the only one who made it.';
  return `${count} of you made it out.`;
}

type EventOfTheWeekProps = {
  event: EventCardData;
  onPress?: () => void;
};

export default function EventOfTheWeek({ event, onPress }: EventOfTheWeekProps) {
  return (
    <View>
      <SectionLabel>This week</SectionLabel>
      <Text style={styles.caption}>{caption(event.goingCount)}</Text>
      <EventCard event={event} onPress={onPress} />
    </View>
  );
}

const styles = StyleSheet.create({
  caption: {
    marginBottom: space.sm,
    color: colors.textSoft,
    fontFamily: font.medium,
    fontSize: textSize.body,
  },
});
