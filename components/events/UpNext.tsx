import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { MyEvent, RsvpStatus } from '../../services/serviceEvents';
import { font, gradientFor, radius, shadow, space } from '../../theme';
import { countdownLabel, formatDateTime } from '../../lib/datetime';
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
  const when = formatDateTime(event.date, event.startTime);
  const meta = [when].filter(Boolean).join(' · ');
  const where = [event.location];

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
            <Text style={styles.pillText}>{event.title}</Text>
          </View>
          <View style={styles.group}>
            <Text style={styles.groupText}>{countdownLabel(event.date)}</Text>
          </View>
        </View>

        <Text style={styles.title} numberOfLines={2}>{event.description}</Text>

        <View style={styles.metaRow}>
          <Ionicons name="time-outline" size={15} color={SOFT} />
          <Text style={styles.metaText} numberOfLines={1}>{meta}</Text>
        </View>
        <View style={styles.metaRow}>
          <Ionicons name="location-outline" size={15} color={SOFT} />
          <Text style={styles.metaText} numberOfLines={1}>{where}</Text>
        </View>
        <View style={styles.metaRow}>
            <AttendeeStack people={event.going} size={26} max={3} onDark />
        </View>

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
  card: { borderRadius: radius.xl, padding: space.md, gap: 9, ...shadow.button },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm },
  pill: { backgroundColor: FAINT, paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.pill },
  pillText: { color: WHITE, fontFamily: font.bold, fontSize: 10.5, letterSpacing: 0.5 },
  group: { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1 },
  groupDot: { width: 7, height: 7, borderRadius: radius.pill, backgroundColor: WHITE },
  groupText: { color: SOFT, fontFamily: font.semi, fontSize: 12 },
  title: { color: WHITE, fontFamily: font.bold, fontSize: 21, lineHeight: 26 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  metaText: { flex: 1, color: SOFT, fontFamily: font.medium, fontSize: 13 },
  bottomRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm, marginTop: space.xs },
  rsvpRow: {flexDirection: 'row', alignItems: 'center', flex: 1}
});
