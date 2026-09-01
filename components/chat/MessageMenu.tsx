import { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import type { ChatMessage } from '../../services/serviceGroup';
import { layout, paper, paperFont, radius, space } from '../../theme';

/**
 * Η γρήγορη σειρά. Δεν είναι η μόνη επιλογή — από κάτω υπάρχει πεδίο για
 * οποιοδήποτε emoji — αλλά καλύπτει τη συντριπτική πλειοψηφία με ένα πάτημα.
 */
const QUICK = ['👍', '❤️', '😂', '😮', '😢', '🙏', '🔥', '🎉'];

type MessageMenuProps = {
  /** Το μήνυμα στο οποίο ενεργούμε· `null` κρατά το μενού κλειστό. */
  message: ChatMessage | null;
  /** Η δική μου αντίδραση σε αυτό το μήνυμα, αν υπάρχει. */
  myEmoji?: string | null;
  /** `true` μόνο για τα δικά μου μηνύματα — αλλιώς κρύβονται Edit και Delete. */
  canEdit?: boolean;
  onClose: () => void;
  onEdit: (message: ChatMessage) => void;
  onDelete: (message: ChatMessage) => void;
  onReact: (message: ChatMessage, emoji: string) => void;
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
export default function MessageMenu({
  message,
  myEmoji = null,
  canEdit = false,
  onClose,
  onEdit,
  onDelete,
  onReact,
}: MessageMenuProps) {
  // Το πεδίο για «οτιδήποτε άλλο» ξεκινά κλειστό: είναι η σπάνια περίπτωση, και
  // ανοιχτό θα τραβούσε αμέσως το πληκτρολόγιο πάνω από το μενού.
  const [custom, setCustom] = useState('');
  const [customOpen, setCustomOpen] = useState(false);

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

          {/* Οριζόντιο σκρολ: σε στενή οθόνη τα οκτώ δεν χωράνε, και το wrap θα
              διπλασίαζε το ύψος του φύλλου. */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.quickRow}
            keyboardShouldPersistTaps="handled"
          >
            {QUICK.map(function (emoji) {
              const chosen = myEmoji === emoji;
              return (
                <Pressable
                  key={emoji}
                  onPress={function () {
                    onReact(target, emoji);
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={chosen ? `Remove ${emoji}` : `React with ${emoji}`}
                  style={chosen ? [styles.quick, styles.quickChosen] : styles.quick}
                >
                  <Text style={styles.quickEmoji}>{emoji}</Text>
                </Pressable>
              );
            })}

            {/* Η ελεύθερη επιλογή. Το πληκτρολόγιο του συστήματος έχει ήδη όλα
                τα emoji — δεν χρειάζεται δικό μας grid ούτε βιβλιοθήκη. */}
            <Pressable
              onPress={function () {
                setCustomOpen(function (open) {
                  return !open;
                });
              }}
              accessibilityRole="button"
              accessibilityLabel="Any other emoji"
              style={customOpen ? [styles.quick, styles.quickChosen] : styles.quick}
            >
              <Ionicons name="add" size={18} color={paper.inkSoft} />
            </Pressable>
          </ScrollView>

          {customOpen ? (
            <View style={styles.customRow}>
              <TextInput
                style={styles.customInput}
                value={custom}
                onChangeText={setCustom}
                placeholder="Any emoji"
                placeholderTextColor={paper.inkFaint}
                autoFocus
                maxLength={16}
                accessibilityLabel="Type any emoji"
              />
              <Pressable
                onPress={function () {
                  const picked = custom.trim();
                  if (picked.length > 0) {
                    onReact(target, picked);
                  }
                }}
                disabled={custom.trim().length === 0}
                accessibilityRole="button"
                accessibilityLabel="Use this emoji"
                style={styles.customGo}
              >
                <Ionicons
                  name="arrow-forward"
                  size={16}
                  color={custom.trim().length > 0 ? paper.accent : paper.inkFaint}
                />
              </Pressable>
            </View>
          ) : null}

          {/* Edit και Delete μόνο στα δικά μου. Σε ξένο μήνυμα το μενού
              υπάρχει μόνο για τις αντιδράσεις. */}
          {canEdit ? (
            <>
              <View style={styles.divider} />

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
            </>
          ) : null}
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

  quickRow: { gap: space.xs, paddingHorizontal: space.md, paddingBottom: space.sm },
  quick: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: paper.surface,
    borderWidth: 1,
    borderColor: paper.line,
    borderRadius: radius.pill,
  },
  quickChosen: { borderColor: paper.accent, backgroundColor: paper.accentSoft },
  quickEmoji: { fontSize: 20, lineHeight: 26 },

  customRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    marginHorizontal: space.md,
    marginBottom: space.sm,
    paddingHorizontal: 14,
    height: 40,
    backgroundColor: paper.surface,
    borderWidth: 1,
    borderColor: paper.line,
    borderRadius: radius.pill,
  },
  customInput: {
    flex: 1,
    color: paper.ink,
    fontFamily: paperFont.regular,
    fontSize: 18,
    outlineStyle: 'none',
  } as any,
  customGo: { width: 24, alignItems: 'center' },
  divider: { height: 1, marginLeft: space.md, backgroundColor: paper.lineSoft },
  text: { color: paper.ink, fontFamily: paperFont.medium, fontSize: 15 },
  textDanger: { color: paper.danger },
});
