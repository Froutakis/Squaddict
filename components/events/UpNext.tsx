import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { MyEvent } from '../../services/serviceEvents';
import { font, radius, shadow, space, upNext } from '../../theme';
import { countdownLabel, formatDateTime } from '../../lib/eventFormat';
import GradientAvatar from '../GradientAvatar';

const WHITE = '#FFFFFF';
const SOFT = 'rgba(255,255,255,0.85)';
const FAINT = 'rgba(255,255,255,0.18)';

type UpNextProps = {
  event: MyEvent;
  onPress?: () => void;
  onJoin?: () => void;
};

const FAKE_MEMBERS = ['Alex', 'Maria', 'Kostas', 'Nikos'];

export default function UpNext({ event, onPress, onJoin }: UpNextProps) {
  const when = formatDateTime(event.date, event.startTime);

  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={event.title}>
      <LinearGradient colors={upNext} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.card}>
        <View style={styles.topRow}>
          <View style={styles.pill}>
            <Text style={styles.pillText}>UP NEXT · {countdownLabel(event.date)}</Text>
          </View>
          <View style={styles.group}>
            <View style={styles.groupDot} />
            <Text style={styles.groupText} numberOfLines={1}>{event.groupName}</Text>
          </View>
        </View>

        <Text style={styles.title} numberOfLines={2}>{event.title}</Text>

        <View style={styles.metaRow}>
          <Ionicons name="time-outline" size={15} color={SOFT} />
          <Text style={styles.metaText}>{when}</Text>
          {event.location ? (
            <>
              <Ionicons name="location-outline" size={15} color={SOFT} style={styles.metaIcon} />
              <Text style={styles.metaText} numberOfLines={1}>{event.location}</Text>
            </>
          ) : null}
        </View>

        <View style={styles.bottomRow}>
          <View style={styles.avatars}>
            {FAKE_MEMBERS.map((name, i) => (
              <GradientAvatar key={name} label={name} size={30} ring={2} style={i > 0 ? styles.overlap : undefined} />
            ))}
            <View style={[styles.more, styles.overlap]}>
              <Text style={styles.moreText}>+3</Text>
            </View>
          </View>

          <Pressable style={styles.joinBtn} onPress={onJoin} accessibilityRole="button" accessibilityLabel="I'm in">
            <Text style={styles.joinText}>I'm in</Text>
          </Pressable>
        </View>
      </LinearGradient>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.xl, padding: space.lg, gap: space.sm, ...shadow.button },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm },
  pill: { backgroundColor: FAINT, paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.pill },
  pillText: { color: WHITE, fontFamily: font.bold, fontSize: 10.5, letterSpacing: 0.5 },
  group: { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1 },
  groupDot: { width: 7, height: 7, borderRadius: radius.pill, backgroundColor: WHITE },
  groupText: { color: SOFT, fontFamily: font.semi, fontSize: 12 },
  title: { color: WHITE, fontFamily: font.bold, fontSize: 23, lineHeight: 28 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  metaIcon: { marginLeft: space.sm },
  metaText: { color: SOFT, fontFamily: font.medium, fontSize: 13, flexShrink: 1 },
  bottomRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: space.xs },
  avatars: { flexDirection: 'row', alignItems: 'center' },
  overlap: { marginLeft: -10 },
  more: { width: 30, height: 30, borderRadius: radius.pill, backgroundColor: FAINT, borderWidth: 2, borderColor: WHITE, alignItems: 'center', justifyContent: 'center' },
  moreText: { color: WHITE, fontFamily: font.semi, fontSize: 10 },
  joinBtn: { backgroundColor: WHITE, paddingHorizontal: space.md, paddingVertical: 10, borderRadius: radius.pill },
  joinText: { color: upNext[1], fontFamily: font.bold, fontSize: 14 },
});
