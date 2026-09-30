import { Ionicons } from '@expo/vector-icons';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import type { MyEvent } from '../../services/serviceEvents';
import CalendarCard from '../events/CalendarCard';
import { colors, radius, space, textSize, typo } from '../../theme';

type CalendarSheetProps = {
  visible: boolean;
  title?: string;
  events: MyEvent[];
  covers?: Record<string, string>;
  onSelectDate: (date: string) => void;
  onClose: () => void;
};

// The whole month, opened from the side menu or the week row's expand button.
export default function CalendarSheet({ visible, title, events, covers, onSelectDate, onClose }: CalendarSheetProps) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close the calendar">
        <Pressable style={styles.sheet} onPress={() => {}}>
          <View style={styles.grabber} />

          <View style={styles.head}>
            <View style={styles.titles}>
              <Text style={styles.title}>Calendar</Text>
              {title ? (
                <Text style={styles.subtitle} numberOfLines={1}>
                  {title}
                </Text>
              ) : null}
            </View>
            <Pressable
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Close the calendar"
              hitSlop={8}
              style={({ pressed }) => [styles.close, pressed && styles.pressed]}
            >
              <Ionicons name="close" size={18} color={colors.text} />
            </Pressable>
          </View>

          <CalendarCard
            bare
            events={events}
            covers={covers}
            selectedDate={null}
            onSelectDate={onSelectDate}
          />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: {
    paddingHorizontal: space.md,
    paddingTop: space.sm,
    paddingBottom: space.xl,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    backgroundColor: colors.surface,
  },
  grabber: {
    alignSelf: 'center',
    width: 40,
    height: 5,
    borderRadius: radius.pill,
    backgroundColor: colors.borderStrong,
    marginBottom: space.sm,
  },
  head: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingHorizontal: space.xs },
  titles: { flex: 1, minWidth: 0 },
  title: { color: colors.text, ...typo.display, fontSize: textSize.heading, letterSpacing: -0.4 },
  subtitle: { color: colors.textSoft, ...typo.medium, fontSize: textSize.body },
  close: {
    width: 34,
    height: 34,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceAlt,
  },
  pressed: { opacity: 0.7 },
});
