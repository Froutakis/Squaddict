import { Ionicons } from '@expo/vector-icons';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import type { ChatMessage } from '../../services/serviceGroup';
import { layout, paper, paperFont, radius, space } from '../../theme';

type MessageMenuProps = {
  /** Το μήνυμα στο οποίο ενεργούμε· `null` κρατά το μενού κλειστό. */
  message: ChatMessage | null;
  onClose: () => void;
  onEdit: (message: ChatMessage) => void;
  onDelete: (message: ChatMessage) => void;
};

/**
 * Τι μπορείς να κάνεις σε ένα δικό σου μήνυμα.
 *
 * Modal και όχι φύλλο μέσα στη λίστα: πρέπει να σκεπάσει και τον composer, και
 * να κλείνει με το πίσω κουμπί στο Android.
 *
 * Το component δεν αποφασίζει ΑΝ επιτρέπεται η επεξεργασία — αυτό το κρίνει ο
 * γονιός, που ξέρει ποιανού είναι το μήνυμα και αν έχει φτάσει στη βάση. Εδώ
 * φτάνουν μόνο μηνύματα που ήδη πέρασαν αυτόν τον έλεγχο.
 */
export default function MessageMenu({ message, onClose, onEdit, onDelete }: MessageMenuProps) {
  if (!message) {
    return null;
  }

  // Τοπικό αντίγραφο: μέσα στους χειριστές το `message` είναι σίγουρα non-null,
  // αλλά η TypeScript δεν το κρατά μέσα σε συναρτήσεις που ορίζονται εδώ.
  const target = message;

  return (
    <Modal
      transparent
      visible
      animationType="fade"
      onRequestClose={onClose}
      accessibilityViewIsModal
    >
      {/* Το πάτημα εκτός του φύλλου κλείνει — το αναμενόμενο σε action sheet. */}
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close menu">
        {/* Δεύτερο Pressable χωρίς onPress: σταματά το πάτημα ώστε να μην
            κλείνει το μενού όταν πατάς μέσα του. */}
        <Pressable style={styles.sheet}>
          <Text style={styles.preview} numberOfLines={2}>
            {target.content}
          </Text>

          <Pressable
            onPress={function () {
              onEdit(target);
            }}
            accessibilityRole="button"
            style={itemStyle}
          >
            <Ionicons name="pencil" size={17} color={paper.ink} />
            <Text style={styles.text}>Edit</Text>
          </Pressable>

          <View style={styles.divider} />

          <Pressable
            onPress={function () {
              onDelete(target);
            }}
            accessibilityRole="button"
            style={itemStyle}
          >
            <Ionicons name="trash-outline" size={17} color={paper.danger} />
            <Text style={[styles.text, styles.textDanger]}>Delete</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function itemStyle({ pressed }: { pressed: boolean }): StyleProp<ViewStyle> {
  if (pressed) {
    return [styles.item, styles.itemPressed];
  }
  return styles.item;
}

const styles = StyleSheet.create({
  // Φύλλο στο κάτω μέρος, όπως τα action sheets του συστήματος.
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(31, 30, 29, 0.35)',
  },
  sheet: {
    width: '100%',
    maxWidth: layout.column,
    alignSelf: 'center',
    paddingVertical: space.xs,
    paddingBottom: space.md,
    backgroundColor: paper.bg,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
  },
  // Το κείμενο του μηνύματος στην κορυφή, ώστε να ξέρεις σε ποιο ενεργείς.
  preview: {
    paddingHorizontal: space.md,
    paddingTop: space.sm,
    paddingBottom: space.sm,
    color: paper.inkFaint,
    fontFamily: paperFont.regular,
    fontSize: 13,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingHorizontal: space.md,
    paddingVertical: 14,
  },
  itemPressed: { backgroundColor: paper.surfaceAlt },
  divider: { height: 1, marginLeft: space.md, backgroundColor: paper.lineSoft },
  text: { color: paper.ink, fontFamily: paperFont.medium, fontSize: 15 },
  textDanger: { color: paper.danger },
});
