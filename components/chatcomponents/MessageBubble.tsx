import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, Text, View } from 'react-native';
import { brand, colors, font, gradientFor, radius, space } from '../../theme';
import GradientAvatar, { initialsFor } from '../GradientAvatar';

const AVATAR = 28;
/** Οι "εσωτερικές" γωνίες μέσα σε μια σερί μηνυμάτων. */
const TIGHT = 6;

function timeLabel(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

type MessageBubbleProps = {
  content: string;
  senderName: string;
  /** ISO timestamp από τη βάση. */
  createdAt: string;
  /** Δικό μου μήνυμα — πάει δεξιά με το brand gradient. */
  mine: boolean;
  /** Πρώτο μιας σερί του ίδιου αποστολέα — μόνο εκεί δείχνουμε όνομα. */
  isFirst: boolean;
  /** Τελευταίο της σερί — μόνο εκεί δείχνουμε avatar και ώρα. */
  isLast: boolean;
};

export default function MessageBubble({
  content,
  senderName,
  createdAt,
  mine,
  isFirst,
  isLast,
}: MessageBubbleProps) {
  // Στρογγυλή γωνία μόνο στις εξωτερικές άκρες, ώστε η σερί να διαβάζεται σαν μία στήλη.
  const shape = mine
    ? {
        borderTopRightRadius: isFirst ? radius.lg : TIGHT,
        borderBottomRightRadius: isLast ? radius.lg : TIGHT,
      }
    : {
        borderTopLeftRadius: isFirst ? radius.lg : TIGHT,
        borderBottomLeftRadius: isLast ? radius.lg : TIGHT,
      };

  return (
    <View style={[styles.row, mine ? styles.rowMine : styles.rowOther, isFirst && styles.rowFirst]}>
      {mine ? null : isLast ? (
        <GradientAvatar label={senderName || '?'} initials={initialsFor(senderName)} size={AVATAR} />
      ) : (
        <View style={styles.avatarSpacer} />
      )}

      <View style={[styles.column, mine ? styles.columnMine : styles.columnOther]}>
        {!mine && isFirst && senderName ? (
          <Text style={[styles.sender, { color: gradientFor(senderName)[1] }]} numberOfLines={1}>
            {senderName}
          </Text>
        ) : null}

        {mine ? (
          <LinearGradient
            colors={[brand[0], brand[1]]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[styles.bubble, shape]}
          >
            <Text style={[styles.text, styles.textMine]}>{content}</Text>
          </LinearGradient>
        ) : (
          <View style={[styles.bubble, styles.bubbleOther, shape]}>
            <Text style={styles.text}>{content}</Text>
          </View>
        )}

        {isLast ? <Text style={styles.time}>{timeLabel(createdAt)}</Text> : null}
      </View>
    </View>
  );
}

/** Διαχωριστικό ημέρας ανάμεσα στα μηνύματα. */
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
  row: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, marginTop: 2 },
  rowFirst: { marginTop: space.md },
  rowMine: { justifyContent: 'flex-end' },
  rowOther: { justifyContent: 'flex-start' },
  avatarSpacer: { width: AVATAR },
  column: { maxWidth: '78%' },
  columnMine: { alignItems: 'flex-end' },
  columnOther: { alignItems: 'flex-start' },
  bubble: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: radius.lg },
  bubbleOther: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  sender: { marginBottom: 3, marginLeft: 2, fontFamily: font.semi, fontSize: 12 },
  text: { color: colors.text, fontFamily: font.medium, fontSize: 15, lineHeight: 21 },
  textMine: { color: '#FFFFFF' },
  time: {
    marginTop: 3,
    marginHorizontal: 2,
    color: colors.textFaint,
    fontFamily: font.medium,
    fontSize: 10,
  },
  separator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    marginTop: space.lg,
    marginBottom: space.xs,
  },
  separatorLine: { flex: 1, height: 1, backgroundColor: colors.border },
  separatorText: {
    color: colors.textFaint,
    fontFamily: font.semi,
    fontSize: 11,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
});
