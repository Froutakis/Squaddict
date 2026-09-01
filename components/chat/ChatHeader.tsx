import { Ionicons } from '@expo/vector-icons';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { SquadMonogram } from './SquadPicker';
import { presenceLabel } from './typing';
import { paper, paperFont, radius, space } from '../../theme';

type ChatHeaderProps = {
  name: string;
  /** Πόσα μέλη έχει η Παρέα. */
  memberCount: number;
  /** Πόσοι από αυτά είναι συνδεδεμένοι τώρα. */
  online: number;
  onBack: () => void;
  onSearch: () => void;
};

/**
 * Η κορυφή της συνομιλίας: πίσω, μονόγραμμα, όνομα, και η λούπα.
 *
 * Ο υπότιτλος βγαίνει από την presenceLabel και όχι από συνένωση εδώ: ο
 * ενικός/πληθυντικός και το «· N online» κρίνονται μαζί, και η λογική τους
 * δοκιμάζεται στο test-typing.
 */
export default function ChatHeader({
  name,
  memberCount,
  online,
  onBack,
  onSearch,
}: ChatHeaderProps) {
  return (
    <View style={styles.bar}>
      <Pressable
        onPress={onBack}
        accessibilityRole="button"
        accessibilityLabel="Back to squads"
        style={roundButtonStyle}
      >
        <Ionicons name="chevron-back" size={20} color={paper.ink} />
      </Pressable>

      <SquadMonogram name={name} size={32} />

      <View style={styles.text}>
        <Text style={styles.title} numberOfLines={1}>
          {name}
        </Text>
        <Text style={styles.subtitle}>{presenceLabel(memberCount, online)}</Text>
      </View>

      <Pressable
        onPress={onSearch}
        accessibilityRole="button"
        accessibilityLabel="Search messages"
        style={roundButtonStyle}
      >
        <Ionicons name="search" size={19} color={paper.ink} />
      </Pressable>
    </View>
  );
}

/** Το Pressable καλεί αυτή τη συνάρτηση και της δίνει { pressed: true/false }. */
function roundButtonStyle({ pressed }: { pressed: boolean }): StyleProp<ViewStyle> {
  if (pressed) {
    return [styles.round, styles.pressed];
  }
  return styles.round;
}

const styles = StyleSheet.create({
  // Μία λεπτή γραμμή χωρίζει τον header από τα μηνύματα — καμία σκιά.
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingHorizontal: space.md,
    paddingTop: space.sm,
    paddingBottom: space.sm,
    borderBottomWidth: 1,
    borderBottomColor: paper.line,
    backgroundColor: paper.bg,
  },
  round: {
    width: 32,
    height: 32,
    marginLeft: -4,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { backgroundColor: paper.surfaceAlt },
  text: { flex: 1 },
  title: { color: paper.ink, fontFamily: paperFont.semi, fontSize: 16 },
  subtitle: { marginTop: 1, color: paper.inkFaint, fontFamily: paperFont.regular, fontSize: 12 },
});
