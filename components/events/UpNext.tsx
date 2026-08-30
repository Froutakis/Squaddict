import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { MyEvent, RsvpStatus } from '../../services/serviceEvents';
import { colors, font, radius, space, textSize } from '../../theme';
import { countdownLabel, formatDateTime } from '../../lib/datetime';
import { placeLines } from '../../lib/place';
import { ticketCode } from '../../lib/ticket';
import Ticket from '../general/Ticket';
import Punch from '../general/Punch';
import AttendeeStack from './Attendee';
import RsvpButtons from './RsvpButtons';

const WHITE = '#FFFFFF';
const SOFT = 'rgba(255,255,255,0.78)';
const FAINT = 'rgba(255,255,255,0.5)';
const HOLE = '#05090D';

type UpNextProps = {
  event: MyEvent;
  onPress?: () => void;
  onRsvp: (status: RsvpStatus | null) => void;
  saving?: boolean;
};

export default function UpNext({ event, onPress, onRsvp, saving = false }: UpNextProps) {
  const place = placeLines(event.location, event.placeLabel);
  const answered = event.myStatus === 'in' || event.myStatus === 'out';

  const stub = answered ? (
    <View style={styles.stub}>
      <Punch state={event.myStatus === 'in' ? 'in' : 'out'} size={26} onDark holeColor={HOLE} />

      <View style={styles.stubText}>
        <Text style={styles.stubTitle}>
          {event.myStatus === 'in' ? "You're in" : 'You passed'}
        </Text>
        <Pressable
          onPress={() => onRsvp(null)}
          disabled={saving}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Change your answer"
        >
          <Text style={styles.change}>Change</Text>
        </Pressable>
      </View>

      <View style={styles.spacer} />

      <View style={styles.stubRight}>
        <AttendeeStack people={event.going} size={24} max={3} onDark />
        <Text style={styles.count}>{event.going.length} IN</Text>
      </View>
    </View>
  ) : (
    <RsvpButtons status={event.myStatus} saving={saving} onChange={onRsvp} onDark compact stretch />
  );

  return (
    <Ticket tone="ink" onPress={onPress} accessibilityLabel={event.title} stub={stub}>
      <View style={styles.topRow}>
        <View style={styles.squadPill}>
          <Text style={styles.squadText} numberOfLines={1}>
            {event.groupName}
          </Text>
        </View>
        <View style={styles.spacer} />
        <Text style={styles.code}>
          {countdownLabel(event.date)} · № {ticketCode(event.id)}
        </Text>
      </View>

      <Text style={styles.title} numberOfLines={2}>
        {event.title}
      </Text>

      <View style={styles.metaRow}>
        <Ionicons name="time-outline" size={15} color={SOFT} />
        <Text style={[styles.metaLine, styles.metaFill]} numberOfLines={1}>
          {formatDateTime(event.date, event.startTime)}
        </Text>
      </View>

      {place.primary ? (
        <View style={styles.metaRow}>
          <Ionicons name="location-outline" size={15} color={SOFT} />
          <View style={styles.metaStack}>
            <Text style={styles.metaLine} numberOfLines={1}>
              {place.primary}
            </Text>
            {place.secondary ? (
              <Text style={styles.metaSub} numberOfLines={1}>
                {place.secondary}
              </Text>
            ) : null}
          </View>
        </View>
      ) : null}
    </Ticket>
  );
}

const styles = StyleSheet.create({
  spacer: { flex: 1 },

  topRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  squadPill: {
    maxWidth: '58%',
    paddingHorizontal: space.sm,
    paddingVertical: 3,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  squadText: { color: WHITE, fontFamily: font.semi, fontSize: textSize.caption },
  code: { color: FAINT, fontFamily: font.mono, fontSize: 10, letterSpacing: 1 },

  title: {
    marginTop: space.sm,
    color: WHITE,
    fontFamily: font.display,
    fontSize: textSize.display,
    lineHeight: 34,
    letterSpacing: -0.6,
  },

  metaRow: { flexDirection: 'row', alignItems: 'center', gap: space.xs, marginTop: space.xs },
  metaStack: { flex: 1, gap: 1 },
  metaFill: { flex: 1 },
  metaLine: { color: SOFT, fontFamily: font.mono, fontSize: textSize.body },
  metaSub: { color: FAINT, fontFamily: font.medium, fontSize: textSize.caption },

  stub: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  stubText: { gap: 1 },
  stubTitle: { color: WHITE, fontFamily: font.semi, fontSize: textSize.body },
  change: { color: FAINT, fontFamily: font.medium, fontSize: textSize.caption },
  stubRight: { alignItems: 'flex-end', gap: 3 },
  count: { color: FAINT, fontFamily: font.mono, fontSize: 9.5, letterSpacing: 1 },
});
