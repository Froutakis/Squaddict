import { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { paper, paperFont, radius, space } from '../../theme';

type ChatComposerProps = {
  /**
   * Βάζει το μήνυμα στην οθόνη και αναλαμβάνει την αποστολή από εκεί και πέρα.
   * Δεν περιμένουμε δίκτυο: ό,τι πάει στραβά φαίνεται πάνω στη φυσαλίδα.
   */
  onSend: (text: string) => void;
  placeholder?: string;
  disabled?: boolean;
  /**
   * Αρχικό περιεχόμενο. Διαβάζεται ΜΟΝΟ στο πρώτο render — η αλλαγή του δεν
   * κάνει τίποτα. Ο γονιός αλλάζει το `key` για να ξαναστήσει τον composer με
   * νέο κείμενο· έτσι δεν χρειάζεται effect που θα πάλευε με ό,τι πληκτρολογεί
   * ο χρήστης εκείνη τη στιγμή.
   */
  initialText?: string;
  /** Σε λειτουργία διόρθωσης αλλάζει η μπάρα και το εικονίδιο του κουμπιού. */
  editing?: boolean;
  /** Ακύρωση της διόρθωσης. */
  onCancel?: () => void;
};

export default function ChatComposer({
  onSend,
  placeholder = 'Message the squad',
  disabled = false,
  initialText = '',
  editing = false,
  onCancel,
}: ChatComposerProps) {
  const [text, setText] = useState(initialText);
  const [focused, setFocused] = useState(false);

  const trimmed = text.trim();
  const canSend = trimmed.length > 0 && !disabled;

  function handleSend() {
    if (!canSend) return;

    // Καθαρίζει αμέσως: το μήνυμα ζει πλέον στη λίστα, όχι στο πεδίο.
    onSend(trimmed);
    setText('');
  }

  /**
   * Πληκτρολόγιο: Enter στέλνει, Shift+Enter αλλάζει γραμμή. Μόνο στο web —
   * στο κινητό το Enter του εικονικού πληκτρολογίου πρέπει να κάνει νέα γραμμή.
   *
   * Το react-native-web δίνει εδώ το κανονικό keydown event του browser, οπότε
   * έχουμε και `shiftKey` και `preventDefault()`. Το preventDefault εμποδίζει
   * τον browser να προσθέσει το newline πριν προλάβουμε να στείλουμε.
   */
  function handleKeyPress(event: any) {
    if (Platform.OS !== 'web') {
      return;
    }

    const key = event.key ?? event.nativeEvent?.key;
    const withShift = event.shiftKey ?? event.nativeEvent?.shiftKey;
    // Όσο ένα IME συνθέτει χαρακτήρα, το Enter επιβεβαιώνει τη σύνθεση — όχι αποστολή.
    const composing = event.nativeEvent?.isComposing === true;

    if (key === 'Enter' && !withShift && !composing) {
      event.preventDefault();
      handleSend();
    }

    // Escape ακυρώνει τη διόρθωση — το αναμενόμενο σε κάθε πεδίο που «άνοιξε»
    // πάνω από κάτι άλλο.
    if (key === 'Escape' && editing && onCancel) {
      event.preventDefault();
      onCancel();
    }
  }

  return (
    <View style={styles.bar}>
      {editing ? (
        <View style={styles.editBanner}>
          <Ionicons name="pencil" size={13} color={paper.accent} />
          <Text style={styles.editLabel}>Editing message</Text>
          <Pressable
            onPress={onCancel}
            accessibilityRole="button"
            accessibilityLabel="Cancel edit"
            hitSlop={8}
          >
            <Ionicons name="close" size={16} color={paper.inkSoft} />
          </Pressable>
        </View>
      ) : null}

      {/* Ένα ενιαίο κουτί: πεδίο και κουμπί ζουν μέσα στο ίδιο περίγραμμα. */}
      <View style={[styles.box, focused && styles.boxFocused]}>
        <TextInput
          style={styles.input}
          value={text}
          onChangeText={setText}
          onKeyPress={handleKeyPress}
          onFocus={function () {
            setFocused(true);
          }}
          onBlur={function () {
            setFocused(false);
          }}
          placeholder={placeholder}
          placeholderTextColor={paper.inkFaint}
          editable={!disabled}
          multiline
        />

        <Pressable
          onPress={handleSend}
          disabled={!canSend}
          accessibilityRole="button"
          accessibilityLabel={editing ? "Save edit" : "Send"}
          style={function ({ pressed }) {
            return [styles.send, canSend ? styles.sendReady : styles.sendIdle, pressed && canSend && styles.pressed];
          }}
        >
          <Ionicons
            name={editing ? "checkmark" : "arrow-up"}
            size={17}
            color={canSend ? paper.onMine : paper.inkFaint}
          />
        </Pressable>
      </View>
    </View>
  );
}

const SEND = 30;

const styles = StyleSheet.create({
  bar: {
    paddingHorizontal: space.md,
    paddingTop: space.sm,
    paddingBottom: space.md,
    backgroundColor: paper.bg,
  },
  box: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: space.sm,
    paddingLeft: 14,
    paddingRight: 7,
    paddingVertical: 7,
    backgroundColor: paper.surface,
    borderWidth: 1,
    borderColor: paper.line,
    borderRadius: radius.xl,
  },
  // Στο focus σκουραίνει μόνο το περίγραμμα — καμία σκιά, κανένα glow.
  boxFocused: { borderColor: paper.inkFaint },
  editBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    marginBottom: space.xs,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: paper.accentSoft,
    borderRadius: radius.md,
  },
  editLabel: {
    flex: 1,
    color: paper.accent,
    fontFamily: paperFont.medium,
    fontSize: 12,
  },
  input: {
    flex: 1,
    maxHeight: 120,
    minHeight: SEND,
    paddingTop: 5,
    paddingBottom: 5,
    color: paper.ink,
    fontFamily: paperFont.regular,
    fontSize: 15,
    lineHeight: 21,
  },
  send: {
    width: SEND,
    height: SEND,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendReady: { backgroundColor: paper.accent },
  sendIdle: { backgroundColor: paper.surfaceAlt },
  pressed: { opacity: 0.85 },
});
