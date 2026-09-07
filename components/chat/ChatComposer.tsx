import { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Image, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import type { LocalImage } from './messageRows';
import { applyMention, matchMembers, mentionQuery, type Member } from './mentions';
import { SquadMonogram } from './SquadPicker';
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
  /**
   * Σε ποιον απαντάμε. Αποκλείεται με το `editing` — διορθώνεις ή απαντάς, όχι
   * και τα δύο· ο γονιός φροντίζει να μην είναι ταυτόχρονα ενεργά.
   */
  replyTo?: { senderName: string; content: string; deleted: boolean } | null;
  /** Ακύρωση της διόρθωσης. */
  onCancel?: () => void;
  /**
   * Ο χρήστης πληκτρολογεί. Καλείται σε ΚΑΘΕ αλλαγή — το throttle είναι ευθύνη
   * του γονιού, που ξέρει και το κανάλι.
   */
  onTyping?: () => void;
  /** Τα μέλη της Παρέας — ο κατάλογος που ανοίγει με '@'. */
  members?: Member[];
  /** Ποιος είμαι· λείπω από τον κατάλογο. */
  meId?: string;
  /** Η φωτογραφία που περιμένει να σταλεί μαζί με το μήνυμα. */
  attachment?: LocalImage | null;
  /** Άνοιγμα της συλλογής. Λείπει σε λειτουργία διόρθωσης. */
  onPickImage?: () => void;
  /** Αφαίρεση της επιλεγμένης φωτογραφίας. */
  onClearImage?: () => void;
};

/** Τι έχει ήδη επιλεγεί, ώστε ο κατάλογος να μην ξανανοίξει για το ίδιο '@'. */
type Dismissed = { at: number; query: string };

export default function ChatComposer({
  onSend,
  placeholder = 'Message the squad',
  disabled = false,
  initialText = '',
  editing = false,
  replyTo = null,
  onCancel,
  onTyping,
  members,
  meId,
  attachment = null,
  onPickImage,
  onClearImage,
}: ChatComposerProps) {
  const [text, setText] = useState(initialText);
  const [focused, setFocused] = useState(false);
  /** Πού βρίσκεται ο δρομέας — από εκεί ξεκινά η αναζήτηση αναφοράς. */
  const [cursor, setCursor] = useState(initialText.length);
  /** Θέση δρομέα που επιβάλλουμε για ένα render, μετά από επιλογή ονόματος. */
  const [forcedCursor, setForcedCursor] = useState<number | null>(null);
  const [dismissed, setDismissed] = useState<Dismissed | null>(null);
  const [active, setActive] = useState(0);

  const trimmed = text.trim();
  // Με φωτογραφία, το κείμενο είναι προαιρετική λεζάντα.
  const canSend = (trimmed.length > 0 || attachment !== null) && !disabled;

  const found = disabled ? null : mentionQuery(text, cursor);

  /** Έχει ήδη διαλεχθεί όνομα για αυτό το '@'; */
  const hushed =
    found !== null &&
    dismissed !== null &&
    found.at === dismissed.at &&
    found.query.startsWith(dismissed.query);

  const suggestions =
    found && !hushed && members && members.length > 0
      ? matchMembers(members, found.query, meId)
      : [];

  const picking = suggestions.length > 0;
  const highlighted = Math.min(active, suggestions.length - 1);

  /** Βάζει το πλήρες όνομα στο κείμενο και κλείνει τον κατάλογο. */
  function pick(member: Member) {
    if (!found) {
      return;
    }

    const next = applyMention(text, found, member);
    setText(next.text);
    setCursor(next.cursor);
    setForcedCursor(next.cursor);
    setDismissed({ at: found.at, query: next.text.slice(found.at + 1, next.cursor) });
    setActive(0);
  }

  /** Κλείνει τον κατάλογο χωρίς επιλογή. */
  function closeList() {
    if (found) {
      setDismissed({ at: found.at, query: found.query });
    }
  }

  function handleSend() {
    if (!canSend) return;

    // Καθαρίζει αμέσως: το μήνυμα ζει πλέον στη λίστα, όχι στο πεδίο.
    onSend(trimmed);
    setText('');
    setCursor(0);
    setDismissed(null);
    setActive(0);
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

    // Με ανοιχτό κατάλογο το Enter διαλέγει αντί να στέλνει.
    if (picking && !composing) {
      if (key === 'Enter' && !withShift) {
        event.preventDefault();
        pick(suggestions[highlighted]);
        return;
      }
      if (key === 'ArrowDown') {
        event.preventDefault();
        setActive((highlighted + 1) % suggestions.length);
        return;
      }
      if (key === 'ArrowUp') {
        event.preventDefault();
        setActive((highlighted - 1 + suggestions.length) % suggestions.length);
        return;
      }
      if (key === 'Escape') {
        event.preventDefault();
        closeList();
        return;
      }
    }

    if (key === 'Enter' && !withShift && !composing) {
      event.preventDefault();
      handleSend();
    }

    // Escape ακυρώνει τη διόρθωση — το αναμενόμενο σε κάθε πεδίο που «άνοιξε»
    // πάνω από κάτι άλλο.
    if (key === 'Escape' && (editing || replyTo) && onCancel) {
      event.preventDefault();
      onCancel();
    }
  }

  return (
    <View style={styles.bar}>
      {picking ? (
        <View style={styles.picker}>
          <ScrollView
            keyboardShouldPersistTaps="always"
            showsVerticalScrollIndicator={false}
            style={styles.pickerScroll}
          >
            {suggestions.map(function (member, index) {
              return (
                <Pressable
                  key={member.id}
                  onPress={function () {
                    pick(member);
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={'Mention ' + member.name}
                  style={function ({ pressed }) {
                    return [
                      styles.suggestion,
                      index === highlighted && styles.suggestionActive,
                      pressed && styles.pressed,
                    ];
                  }}
                >
                  <SquadMonogram name={member.name} size={24} />
                  <Text style={styles.suggestionName} numberOfLines={1}>
                    {member.name}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      ) : null}

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
      ) : replyTo ? (
        <View style={styles.editBanner}>
          <Ionicons name="arrow-undo" size={13} color={paper.accent} />
          <View style={styles.replyText}>
            <Text style={styles.editLabel} numberOfLines={1}>
              Replying to {replyTo.senderName || 'someone'}
            </Text>
            <Text style={styles.replyBody} numberOfLines={1}>
              {replyTo.deleted ? 'Message deleted' : replyTo.content}
            </Text>
          </View>
          <Pressable
            onPress={onCancel}
            accessibilityRole="button"
            accessibilityLabel="Cancel reply"
            hitSlop={8}
          >
            <Ionicons name="close" size={16} color={paper.inkSoft} />
          </Pressable>
        </View>
      ) : null}

      {attachment ? (
        <View style={styles.attachment}>
          <Image source={{ uri: attachment.uri }} style={styles.thumb} />
          <Text style={styles.attachmentLabel} numberOfLines={1}>
            Photo ready to send
          </Text>
          <Pressable
            onPress={onClearImage}
            accessibilityRole="button"
            accessibilityLabel="Remove photo"
            hitSlop={8}
          >
            <Ionicons name="close" size={16} color={paper.inkSoft} />
          </Pressable>
        </View>
      ) : null}

      {/* Ένα ενιαίο κουτί: πεδίο και κουμπί ζουν μέσα στο ίδιο περίγραμμα. */}
      <View style={[styles.box, focused && styles.boxFocused]}>
        {/* Η διόρθωση αλλάζει μόνο κείμενο — η φωτογραφία ενός σταλμένου
            μηνύματος είναι αμετάβλητη, το επιβάλλει και ο trigger. */}
        {onPickImage && !editing ? (
          <Pressable
            onPress={onPickImage}
            disabled={disabled}
            accessibilityRole="button"
            accessibilityLabel="Add a photo"
            style={function ({ pressed }) {
              return [styles.attach, pressed && styles.pressed];
            }}
          >
            <Ionicons name="image-outline" size={20} color={paper.inkSoft} />
          </Pressable>
        ) : null}
        <TextInput
          style={styles.input}
          value={text}
          selection={forcedCursor === null ? undefined : { start: forcedCursor, end: forcedCursor }}
          onChangeText={function (next) {
            setText(next);
            // Το onSelectionChange έρχεται ένα render αργότερα· ο κατάλογος
            // χρειάζεται τον δρομέα τώρα.
            const moved = next.length - text.length;
            setCursor(function (prev) {
              return Math.max(0, Math.min(next.length, prev + moved));
            });
            // Το σβήσιμο δεν είναι γράψιμο: αλλιώς κρατώντας το Backspace θα
            // έστελνες «γράφει…» ενώ αδειάζεις το πεδίο.
            if (next.length > text.length) {
              onTyping?.();
            }
          }}
          onSelectionChange={function (event) {
            setCursor(event.nativeEvent.selection.start);
            setForcedCursor(null);
          }}
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

const SEND = 36;
/** Το ύψος του πεδίου: λίγο ψηλότερο από τα κουμπιά, όπως στο πρότυπο. */
const FIELD = 44;

const styles = StyleSheet.create({
  bar: {
    paddingHorizontal: space.md,
    paddingTop: space.sm,
    paddingBottom: space.md,
    backgroundColor: paper.bg,
  },
  // Χωρίς δικό του περίγραμμα: το πεδίο και τα κουμπιά είναι ξεχωριστά σχήματα
  // που κάθονται δίπλα-δίπλα, όπως στο πρότυπο.
  box: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: space.xs + 2,
  },
  boxFocused: {},
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
  attach: {
    width: SEND,
    height: SEND,
    borderRadius: SEND / 2,
    backgroundColor: paper.surface,
    borderWidth: 1,
    borderColor: paper.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  attachment: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    marginBottom: space.xs,
    padding: 6,
    backgroundColor: paper.surface,
    borderWidth: 1,
    borderColor: paper.line,
    borderRadius: radius.md,
  },
  thumb: { width: 34, height: 34, borderRadius: radius.sm, backgroundColor: paper.surfaceAlt },
  attachmentLabel: { flex: 1, color: paper.inkSoft, fontFamily: paperFont.medium, fontSize: 12 },
  picker: {
    marginBottom: space.xs,
    backgroundColor: paper.surface,
    borderWidth: 1,
    borderColor: paper.line,
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  pickerScroll: { maxHeight: 4 * 40 },
  suggestion: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  suggestionActive: { backgroundColor: paper.accentSoft },
  suggestionName: {
    flex: 1,
    color: paper.ink,
    fontFamily: paperFont.medium,
    fontSize: 14,
  },
  replyText: { flex: 1 },
  replyBody: { color: paper.inkSoft, fontFamily: paperFont.regular, fontSize: 11 },
  input: {
    flex: 1,
    maxHeight: 120,
    minHeight: FIELD,
    paddingTop: 12,
    paddingBottom: 12,
    paddingHorizontal: 15,
    backgroundColor: paper.surface,
    borderWidth: 1,
    borderColor: paper.line,
    borderRadius: FIELD / 2,
    color: paper.ink,
    fontFamily: paperFont.regular,
    fontSize: 14.5,
    lineHeight: 20,
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
