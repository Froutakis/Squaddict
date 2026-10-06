import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { Attendee } from '../../services/serviceEvents';
import { colors, radius, space, textSize, tracking, typo } from '../../theme';
import Monogram from '../general/Monogram';

type AttendeeSheetProps = {
  visible: boolean;
  attendees: Attendee[];
  onClose: () => void;
};

export default function AttendeeSheet({ visible, attendees, onClose }: AttendeeSheetProps) {
  const going = attendees.filter((one) => one.status === 'in');
  const passed = attendees.filter((one) => one.status === 'out');

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          <View style={styles.grabber} />

          <Text style={styles.title}>Who is coming</Text>

          <ScrollView contentContainerStyle={styles.list}>
            {going.map((person) => (
              <View key={person.id} style={styles.row}>
                <Monogram name={person.name || '?'} uri={person.avatarUrl} size={32} />
                <Text style={styles.name} numberOfLines={1}>
                  {person.name || 'Someone'}
                </Text>
                <View style={[styles.dot, { backgroundColor: colors.success }]} />
              </View>
            ))}

            {passed.map((person) => (
              <View key={person.id} style={styles.row}>
                <Monogram name={person.name || '?'} uri={person.avatarUrl} size={32} />
                <Text style={[styles.name, styles.faded]} numberOfLines={1}>
                  {person.name || 'Someone'}
                </Text>
                <View style={[styles.dot, { backgroundColor: colors.danger }]} />
              </View>
            ))}

            {attendees.length === 0 ? (
              <Text style={styles.quiet}>Nobody has answered yet.</Text>
            ) : null}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(4,8,16,0.55)', justifyContent: 'flex-end' },
  sheet: {
    maxHeight: '70%',
    backgroundColor: colors.bg,
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
    paddingHorizontal: space.lg,
    paddingBottom: space.xl,
    paddingTop: space.sm,
  },
  grabber: {
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.borderStrong,
    alignSelf: 'center',
    marginBottom: space.md,
  },
  title: {
    color: colors.text,
    ...typo.title,
    fontSize: textSize.heading,
    letterSpacing: tracking.title,
    marginBottom: space.sm,
  },
  list: { gap: space.xs, paddingBottom: space.md },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingVertical: space.xs,
  },
  name: { flex: 1, color: colors.text, ...typo.medium, fontSize: textSize.base },
  faded: { color: colors.textFaint },
  dot: { width: 8, height: 8, borderRadius: radius.pill },
  quiet: { color: colors.textFaint, ...typo.medium, fontSize: textSize.base },
});
