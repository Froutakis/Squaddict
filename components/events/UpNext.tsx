import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { MyEvent, RsvpStatus } from '../../services/serviceEvents';
import { font, gradientFor, radius, shadow, space, textSize } from '../../theme';
import { countdownLabel, formatDateTime } from '../../lib/datetime';
import { placeLines } from '../../lib/place';
import AttendeeStack from './Attendee';
import RsvpButtons from './RsvpButtons';

const WHITE = '#FFFFFF';
const SOFT = 'rgba(255,255,255,0.85)';
const FAINT = 'rgba(255,255,255,0.18)';

type UpNextProps = {
  event: MyEvent;
  onPress?: () => void;
  onRsvp: (status: RsvpStatus | null) => void;
  saving?: boolean;
};

export default function UpNext({ event, onPress, onRsvp, saving = false }: UpNextProps) {
  const meta = formatDateTime(event.date, event.startTime);
  const place = placeLines(event.location, event.placeLabel);

  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={event.title}>
      <LinearGradient
        colors={gradientFor(event.groupName)}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.card}
      >
        <View style={styles.topRow}>
          <View style={styles.pill}>
            <Text style={styles.pillText}>{event.groupName}</Text>
          </View>
          <Text style={styles.countdown} numberOfLines={1}>{countdownLabel(event.date)}</Text>
        </View>

        <Text style={styles.title} numberOfLines={2}>{event.title}</Text>

        <View style={styles.metaRow}>
          <Ionicons name="time-outline" size={15} color={SOFT} />
          <Text style={[styles.metaLine, styles.metaFill]} numberOfLines={1}>{meta}</Text>
        </View>
        {place.primary ? (
          <View style={styles.metaRow}>
            <Ionicons name="location-outline" size={15} color={SOFT} />
            <View style={styles.metaStack}>
              <Text style={styles.metaLine} numberOfLines={1}>{place.primary}</Text>
              {place.secondary ? (
                <Text style={styles.metaSub} numberOfLines={1}>{place.secondary}</Text>
              ) : null}
            </View>
          </View>
        ) : null}

        {event.going.length > 0 ? (
          <View style={styles.metaRow}>
            <AttendeeStack people={event.going} size={26} max={3} onDark />
          </View>
        ) : null}

        <View style={styles.rsvpRow}>
          <RsvpButtons
            status={event.myStatus}
            saving={saving}
            onChange={onRsvp}
            compact
            onDark
            stretch
          />
        </View>
      </LinearGradient>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.xl, padding: space.md, gap: space.sm, ...shadow.button },

  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm },
  pill: { paddingHorizontal: space.sm, paddingVertical: space.xxs, borderRadius: radius.pill, backgroundColor: FAINT },
  pillText: { color: WHITE, fontFamily: font.bold, fontSize: textSize.micro, letterSpacing: 0.5 },
  countdown: { flexShrink: 1, color: SOFT, fontFamily: font.semi, fontSize: textSize.small },

  title: { color: WHITE, fontFamily: font.bold, fontSize: textSize.heading, lineHeight: 26 },

  metaRow: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  metaStack: { flex: 1, gap: 1 },
  metaFill: { flex: 1 },
  metaLine: { color: SOFT, fontFamily: font.medium, fontSize: textSize.body },
  metaSub: { color: 'rgba(255,255,255,0.62)', fontFamily: font.medium, fontSize: textSize.caption },

  rsvpRow: { flexDirection: 'row', alignItems: 'center', flex: 1 },
});
