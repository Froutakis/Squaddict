import { Pressable, StyleSheet, Text, View } from 'react-native';
import { paper, paperFont, space } from '../../theme';
import { SquadMonogram } from './SquadPicker';

const AVATAR = 26;
/** Στρογγυλή εξωτερική γωνία φυσαλίδας. */
const ROUND = 16;
/** Οι "εσωτερικές" γωνίες μέσα σε μια σερί μηνυμάτων. */
const TIGHT = 6;

function timeLabel(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

type MessageBubbleProps = {
  content: string;
  senderName: string;
  /** ISO timestamp από τη βάση. */
  createdAt: string;
  /** Δικό μου μήνυμα — πάει δεξιά, σε μελανί κουτί. */
  mine: boolean;
  /** Πρώτο μιας σερί του ίδιου αποστολέα — μόνο εκεί δείχνουμε όνομα. */
  isFirst: boolean;
  /** Τελευταίο της σερί — μόνο εκεί δείχνουμε avatar και ώρα. */
  isLast: boolean;
  /** Λείπει για όσα έχουν επιβεβαιωθεί από τη βάση. */
  status?: 'pending' | 'failed';
  /** Καλείται όταν πατηθεί μήνυμα που απέτυχε. */
  onRetry?: () => void;
};

export default function MessageBubble({
  content,
  senderName,
  createdAt,
  mine,
  isFirst,
  isLast,
  status,
  onRetry,
}: MessageBubbleProps) {
  // Στρογγυλή γωνία μόνο στις εξωτερικές άκρες, ώστε η σερί να διαβάζεται σαν μία στήλη.
  const shape = mine
    ? {
        borderTopRightRadius: isFirst ? ROUND : TIGHT,
        borderBottomRightRadius: isLast ? ROUND : TIGHT,
      }
    : {
        borderTopLeftRadius: isFirst ? ROUND : TIGHT,
        borderBottomLeftRadius: isLast ? ROUND : TIGHT,
      };

  return (
    <View style={[styles.row, mine ? styles.rowMine : styles.rowOther, isFirst && styles.rowFirst]}>
      {/* Το avatar μπαίνει μόνο στο τελευταίο μήνυμα της σερί· αλλιώς κρατάμε τη θέση του κενή. */}
      {mine ? null : isLast ? (
        <SquadMonogram name={senderName || '?'} size={AVATAR} />
      ) : (
        <View style={styles.avatarSpacer} />
      )}

      <View style={[styles.column, mine ? styles.columnMine : styles.columnOther]}>
        {!mine && isFirst && senderName ? (
          <Text style={styles.sender} numberOfLines={1}>
            {senderName}
          </Text>
        ) : null}

        {/* Το failed γίνεται πατητό· τα υπόλοιπα μένουν απλό View ώστε να μη
            μαζεύει η λίστα χιλιάδες άχρηστους χειριστές αφής. */}
        {status === 'failed' && onRetry ? (
          <Pressable
            onPress={onRetry}
            accessibilityRole="button"
            accessibilityLabel="Message not sent. Tap to try again."
            style={function ({ pressed }) {
              return [
                styles.bubble,
                mine ? styles.bubbleMine : styles.bubbleOther,
                styles.bubbleFailed,
                shape,
                pressed && styles.pressed,
              ];
            }}
          >
            <Text style={[styles.text, mine && styles.textMine]}>{content}</Text>
          </Pressable>
        ) : (
          <View
            style={[
              styles.bubble,
              mine ? styles.bubbleMine : styles.bubbleOther,
              shape,
              status === 'pending' && styles.bubblePending,
            ]}
          >
            <Text style={[styles.text, mine && styles.textMine]}>{content}</Text>
          </View>
        )}

        {/* Όσο εκκρεμεί ή έχει αποτύχει, η κατάσταση παίρνει τη θέση της ώρας:
            η ώρα ενός μηνύματος που δεν έφτασε ποτέ δεν σημαίνει τίποτα. */}
        {status === 'failed' ? (
          <Text style={styles.failedNote}>Not sent · Tap to try again</Text>
        ) : status === 'pending' ? (
          <Text style={styles.pendingNote}>Sending…</Text>
        ) : isLast ? (
          <Text style={styles.time}>{timeLabel(createdAt)}</Text>
        ) : null}
      </View>
    </View>
  );
}

/** Διαχωριστικό ημέρας — μια λεπτή γραμμή με την ημερομηνία στη μέση. */
export function DateSeparator({ label }: { label: string }) {
  return (
    <View style={styles.separator}>
      <View style={styles.separatorLine} />
      <Text style={styles.separatorText}>{label}</Text>
      <View style={styles.separatorLine} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, marginTop: 3 },
  rowFirst: { marginTop: space.md },
  rowMine: { justifyContent: 'flex-end' },
  rowOther: { justifyContent: 'flex-start' },
  avatarSpacer: { width: AVATAR },
  column: { maxWidth: '76%' },
  columnMine: { alignItems: 'flex-end' },
  columnOther: { alignItems: 'flex-start' },

  bubble: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: ROUND },
  bubbleMine: { backgroundColor: paper.mine },
  bubbleOther: {
    backgroundColor: paper.surface,
    borderWidth: 1,
    borderColor: paper.line,
  },
  // Ξεθωριασμένο όσο ταξιδεύει — αρκετά για να φανεί, όχι τόσο ώστε να μη διαβάζεται.
  bubblePending: { opacity: 0.55 },
  bubbleFailed: { backgroundColor: paper.danger },
  pressed: { opacity: 0.85 },

  sender: {
    marginBottom: 4,
    marginLeft: 2,
    color: paper.inkSoft,
    fontFamily: paperFont.semi,
    fontSize: 12,
  },
  text: { color: paper.ink, fontFamily: paperFont.regular, fontSize: 15, lineHeight: 22 },
  textMine: { color: paper.onMine },
  time: {
    marginTop: 4,
    marginHorizontal: 2,
    color: paper.inkFaint,
    fontFamily: paperFont.regular,
    fontSize: 11,
  },
  pendingNote: {
    marginTop: 4,
    marginHorizontal: 2,
    color: paper.inkFaint,
    fontFamily: paperFont.regular,
    fontSize: 11,
  },
  failedNote: {
    marginTop: 4,
    marginHorizontal: 2,
    color: paper.danger,
    fontFamily: paperFont.medium,
    fontSize: 11,
  },

  separator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    marginTop: space.lg,
    marginBottom: space.xs,
  },
  separatorLine: { flex: 1, height: 1, backgroundColor: paper.line },
  separatorText: {
    color: paper.inkFaint,
    fontFamily: paperFont.medium,
    fontSize: 11,
    letterSpacing: 0.4,
  },
});
