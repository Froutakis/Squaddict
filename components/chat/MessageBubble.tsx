import { useMemo } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import type { ReplyQuote } from '../../services/serviceGroup';
import { bubbleSize } from './media';
import { mentionParts, type Member } from './mentions';
import type { ReactionCount } from './reactions';
import { paper, paperFont, shadow, space } from '../../theme';
import { SquadMonogram } from './SquadPicker';

const AVATAR = 24;
/** Στρογγυλή εξωτερική γωνία φυσαλίδας. */
const ROUND = 18;
/** Οι "εσωτερικές" γωνίες μέσα σε μια σερί μηνυμάτων. */
const TIGHT = 6;
/** Η μύτη στο τελευταίο μήνυμα της σερί. */
const TAIL = 5;

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
  /** Πότε διορθώθηκε· null αν δεν πειράχτηκε ποτέ. */
  editedAt?: string | null;
  /** Σβησμένο μήνυμα: η φυσαλίδα μένει, το κείμενο έχει ήδη φύγει από τη βάση. */
  deleted?: boolean;
  /** Παρατεταμένο πάτημα — ανοίγει το μενού. */
  onLongPress?: () => void;
  /** Αντιδράσεις, ήδη ομαδοποιημένες. Άδειο = δεν δείχνουμε τίποτα. */
  reactions?: ReactionCount[];
  /** Πάτημα σε chip: βάζει τη δική μου, ή την παίρνει πίσω αν είναι ήδη αυτή. */
  onToggleReaction?: (emoji: string) => void;
  /** Το μήνυμα που παρατίθεται· null αν δεν είναι απάντηση. */
  reply?: ReplyQuote | null;
  /** Είναι απάντηση, αλλά το πρωτότυπο δεν είναι φορτωμένο. */
  replyUnknown?: boolean;
  /** Τα μέλη της Παρέας — για να αναγνωριστούν οι αναφορές μέσα στο κείμενο. */
  members?: Member[];
  /** Ποιος είμαι — η αναφορά σε εμένα ξεχωρίζει από τις υπόλοιπες. */
  meId?: string;
  /**
   * Πού βρίσκεται η εικόνα ΤΩΡΑ: υπογεγραμμένος σύνδεσμος για ό,τι έχει ανέβει,
   * τοπικό αρχείο για ό,τι ταξιδεύει ακόμα. Η φυσαλίδα δεν ξέρει τη διαφορά.
   */
  imageUri?: string | null;
  imageWidth?: number;
  imageHeight?: number;
  /** Πάτημα στη φωτογραφία — άνοιγμα σε πλήρη οθόνη. */
  onOpenImage?: () => void;
};

/** Το μεγαλύτερο που επιτρέπεται να πιάσει μια φωτογραφία μέσα στη λίστα. */
const PHOTO_MAX_WIDTH = 232;
const PHOTO_MAX_HEIGHT = 300;

export default function MessageBubble({
  content,
  senderName,
  createdAt,
  mine,
  isFirst,
  isLast,
  status,
  onRetry,
  editedAt,
  deleted,
  onLongPress,
  reactions,
  onToggleReaction,
  reply,
  replyUnknown,
  members,
  meId,
  imageUri,
  imageWidth = 0,
  imageHeight = 0,
  onOpenImage,
}: MessageBubbleProps) {
  /** Τα κομμάτια του μηνύματος, ή null όταν δεν υπάρχει καμία αναφορά. */
  const body = useMemo(
    function () {
      if (!members || members.length === 0 || content.length === 0) {
        return null;
      }
      const parts = mentionParts(content, members);
      return parts.length === 1 && parts[0].userId === null ? null : parts;
    },
    [content, members],
  );

  /** Το σώμα του μηνύματος, με τις αναφορές τονισμένες. */
  function renderText(textStyle: any) {
    if (body === null) {
      return <Text style={textStyle}>{content}</Text>;
    }

    return (
      <Text style={textStyle}>
        {body.map(function (part, index) {
          if (part.userId === null) {
            return part.text;
          }
          const isMe = part.userId === meId;
          return (
            <Text
              key={index}
              style={[
                styles.mention,
                mine && styles.mentionOnMine,
                isMe && (mine ? styles.mentionMeOnMine : styles.mentionMe),
              ]}
            >
              {part.text}
            </Text>
          );
        })}
      </Text>
    );
  }

  const hasPhoto = !deleted && !!imageUri;
  const photo = bubbleSize(imageWidth, imageHeight, PHOTO_MAX_WIDTH, PHOTO_MAX_HEIGHT);
  const captionOnly = content.trim().length > 0;

  /** Φωτογραφία, λεζάντα, ή και τα δύο. */
  function renderContent(textStyle: any) {
    if (!hasPhoto) {
      return renderText(textStyle);
    }

    return (
      <>
        <Pressable
          onPress={onOpenImage}
          disabled={!onOpenImage}
          accessibilityRole="imagebutton"
          accessibilityLabel="Photo"
        >
          <Image
            source={{ uri: imageUri as string }}
            style={[styles.photo, { width: photo.width, height: photo.height }]}
            resizeMode="cover"
          />
        </Pressable>
        {captionOnly ? (
          <View style={styles.caption}>{renderText(textStyle)}</View>
        ) : null}
      </>
    );
  }

  // Πατητή γίνεται η φυσαλίδα σε δύο περιπτώσεις: για επανάληψη αποστολής, ή
  // για το μενού επεξεργασίας. Ένα σβησμένο μήνυμα δεν πατιέται καθόλου.
  const bubblePress = !deleted && ((status === 'failed' && onRetry) || onLongPress);

  // Στρογγυλή γωνία μόνο στις εξωτερικές άκρες, ώστε η σερί να διαβάζεται σαν μία
  // στήλη. Στο τελευταίο της σερί η κάτω γωνία κόβεται σε μύτη — η ουρά που
  // δείχνει ποιος μιλάει.
  const shape = mine
    ? {
        borderTopRightRadius: isFirst ? ROUND : TIGHT,
        borderBottomRightRadius: isLast ? TAIL : TIGHT,
      }
    : {
        borderTopLeftRadius: isFirst ? ROUND : TIGHT,
        borderBottomLeftRadius: isLast ? TAIL : TIGHT,
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

        {/* Η παράθεση κάθεται πάνω από τη φυσαλίδα, με κάθετη γραμμή αριστερά —
            το ίδιο σχήμα που χρησιμοποιεί κάθε πρόγραμμα αλληλογραφίας. */}
        {reply || replyUnknown ? (
          <View style={styles.quote}>
            <View style={styles.quoteBar} />
            <View style={styles.quoteText}>
              {reply ? (
                <>
                  <Text style={styles.quoteWho} numberOfLines={1}>
                    {reply.senderName || 'Someone'}
                  </Text>
                  <Text
                    style={reply.deleted ? [styles.quoteBody, styles.quoteGone] : styles.quoteBody}
                    numberOfLines={2}
                  >
                    {reply.deleted ? 'Message deleted' : reply.content}
                  </Text>
                </>
              ) : (
                // Απάντηση σε μήνυμα εκτός φορτωμένου ιστορικού. Δεν εφευρίσκουμε
                // περιεχόμενο — λέμε ότι υπάρχει και ότι δεν το έχουμε.
                <Text style={[styles.quoteBody, styles.quoteGone]} numberOfLines={1}>
                  Replying to an earlier message
                </Text>
              )}
            </View>
          </View>
        ) : null}

        {/* Σβησμένο μήνυμα: δεν δείχνουμε ποτέ το content — έχει ήδη μηδενιστεί
            στη βάση, αλλά ούτε καν το ρωτάμε. Ό,τι κι αν έρθει, γράφουμε το ίδιο. */}
        {deleted ? (
          <View
            style={[styles.bubble, styles.bubbleDeleted, shape]}
            accessibilityLabel="Message deleted"
          >
            <Text style={styles.deletedText}>Message deleted</Text>
          </View>
        ) : bubblePress ? (
          <Pressable
            onPress={status === 'failed' ? onRetry : undefined}
            onLongPress={status === 'failed' ? undefined : onLongPress}
            accessibilityRole="button"
            accessibilityLabel={
              status === 'failed'
                ? 'Message not sent. Tap to try again.'
                : 'Message options'
            }
            style={function ({ pressed }) {
              return [
                styles.bubble,
                hasPhoto && styles.bubblePhoto,
                hasPhoto && !captionOnly && styles.bubbleBarePhoto,
                mine ? styles.bubbleMine : styles.bubbleOther,
                status === 'failed' && styles.bubbleFailed,
                status === 'pending' && styles.bubblePending,
                shape,
                pressed && styles.pressed,
              ];
            }}
          >
            {renderContent([styles.text, mine && styles.textMine])}
          </Pressable>
        ) : (
          /* Χωρίς χειριστή αφής όπου δεν χρειάζεται: η λίστα δεν πρέπει να
             μαζεύει χιλιάδες άχρηστους Pressable. */
          <View
            style={[
              styles.bubble,
              hasPhoto && styles.bubblePhoto,
              hasPhoto && !captionOnly && styles.bubbleBarePhoto,
              mine ? styles.bubbleMine : styles.bubbleOther,
              shape,
              status === 'pending' && styles.bubblePending,
            ]}
          >
            {renderContent([styles.text, mine && styles.textMine])}
          </View>
        )}

        {/* Τα chips κάθονται κάτω από τη φυσαλίδα, στην ίδια πλευρά με αυτήν —
            γι' αυτό η στοίχιση έρχεται από το columnMine/columnOther. */}
        {reactions && reactions.length > 0 ? (
          <View style={styles.reactions}>
            {reactions.map(function (item) {
              return (
                <Pressable
                  key={item.emoji}
                  onPress={function () {
                    onToggleReaction?.(item.emoji);
                  }}
                  disabled={!onToggleReaction}
                  accessibilityRole="button"
                  accessibilityLabel={
                    item.mine
                      ? `Remove your ${item.emoji} reaction`
                      : `React with ${item.emoji}`
                  }
                  style={item.mine ? [styles.chip, styles.chipMine] : styles.chip}
                >
                  <Text style={styles.chipEmoji}>{item.emoji}</Text>
                  {/* Το πλήθος μπαίνει μόνο από δύο και πάνω: με έναν, ο
                      αριθμός δεν λέει τίποτα που δεν λέει το ίδιο το emoji. */}
                  {item.count > 1 ? (
                    <Text style={item.mine ? [styles.chipCount, styles.chipCountMine] : styles.chipCount}>
                      {item.count}
                    </Text>
                  ) : null}
                </Pressable>
              );
            })}
          </View>
        ) : null}

        {/* Όσο εκκρεμεί ή έχει αποτύχει, η κατάσταση παίρνει τη θέση της ώρας:
            η ώρα ενός μηνύματος που δεν έφτασε ποτέ δεν σημαίνει τίποτα. */}
        {status === 'failed' ? (
          <Text style={styles.failedNote}>Not sent · Tap to try again</Text>
        ) : status === 'pending' ? (
          <Text style={styles.pendingNote}>Sending…</Text>
        ) : isLast ? (
          <Text style={styles.time}>
            {timeLabel(createdAt)}
            {/* Η σήμανση μένει για πάντα: αυτό είναι το αντάλλαγμα για το ότι
                δεν βάλαμε χρονικό όριο στην επεξεργασία. */}
            {editedAt && !deleted ? ' · edited' : ''}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

/** Διαχωριστικό ημέρας — ένα μικρό χάπι στο κέντρο, χωρίς γραμμές εκατέρωθεν. */
export function DateSeparator({ label }: { label: string }) {
  return (
    <View style={styles.separator}>
      <Text style={styles.separatorText}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, marginTop: 3 },
  rowFirst: { marginTop: space.md },
  rowMine: { justifyContent: 'flex-end' },
  rowOther: { justifyContent: 'flex-start' },
  avatarSpacer: { width: AVATAR },
  column: { maxWidth: '80%' },
  columnMine: { alignItems: 'flex-end' },
  columnOther: { alignItems: 'flex-start' },

  bubble: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: ROUND },
  // Με φωτογραφία το γέμισμα γίνεται λεπτό πλαίσιο· χωρίς λεζάντα φεύγει τελείως
  // και η εικόνα πιάνει ολόκληρη τη φυσαλίδα.
  bubblePhoto: { padding: 4, overflow: 'hidden' },
  bubbleBarePhoto: { padding: 0 },
  photo: { borderRadius: ROUND - 4, backgroundColor: paper.surfaceAlt },
  caption: { paddingHorizontal: 10, paddingTop: 7, paddingBottom: 3 },
  bubbleMine: { backgroundColor: paper.mine },
  bubbleOther: { backgroundColor: paper.surface, ...shadow.bubble },
  // Ξεθωριασμένο όσο ταξιδεύει — αρκετά για να φανεί, όχι τόσο ώστε να μη διαβάζεται.
  bubblePending: { opacity: 0.55 },
  bubbleFailed: { backgroundColor: paper.danger },
  // Το σβησμένο δεν παίρνει ούτε το μελανί των δικών μου ούτε το λευκό των
  // άλλων: διάστικτο περίγραμμα χωρίς γέμισμα, ώστε να διαβάζεται σαν κενό.
  bubbleDeleted: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: paper.line,
  },
  deletedText: {
    color: paper.inkFaint,
    fontFamily: paperFont.regular,
    fontSize: 14,
    fontStyle: 'italic',
  },
  pressed: { opacity: 0.85 },

  quote: {
    flexDirection: 'row',
    gap: 6,
    maxWidth: '100%',
    marginBottom: 3,
    paddingLeft: 2,
  },
  quoteBar: { width: 2, borderRadius: 1, backgroundColor: paper.accent },
  quoteText: { flexShrink: 1, paddingVertical: 1 },
  quoteWho: { color: paper.accent, fontFamily: paperFont.semi, fontSize: 11 },
  quoteBody: { color: paper.inkSoft, fontFamily: paperFont.regular, fontSize: 12, lineHeight: 16 },
  quoteGone: { fontStyle: 'italic', color: paper.inkFaint },

  reactions: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 4 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 7,
    paddingVertical: 2,
    backgroundColor: paper.surface,
    borderWidth: 1,
    borderColor: paper.line,
    borderRadius: 999,
  },
  // Η δική μου ξεχωρίζει με περίγραμμα και όχι με γέμισμα: το emoji πρέπει να
  // παραμείνει το πιο έντονο πράγμα στο chip.
  chipMine: { borderColor: paper.accent, backgroundColor: paper.accentSoft },
  chipEmoji: { fontSize: 12, lineHeight: 16 },
  chipCount: { color: paper.inkSoft, fontFamily: paperFont.medium, fontSize: 11 },
  chipCountMine: { color: paper.accent },

  sender: {
    marginBottom: 4,
    marginLeft: 2,
    color: paper.inkFaint,
    fontFamily: paperFont.mono,
    fontSize: 9.5,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  text: { color: paper.ink, fontFamily: paperFont.regular, fontSize: 14, lineHeight: 20 },
  textMine: { color: paper.onMine },

  mention: { color: paper.accent, fontFamily: paperFont.semi },
  mentionOnMine: { color: paper.accentOnMine },
  mentionMe: { backgroundColor: paper.accentSoft },
  mentionMeOnMine: { backgroundColor: 'rgba(157, 180, 255, 0.22)' },
  time: {
    marginTop: 4,
    marginHorizontal: 2,
    color: paper.inkFaint,
    fontFamily: paperFont.mono,
    fontSize: 10.5,
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
    alignItems: 'center',
    marginTop: space.lg,
    marginBottom: space.xs,
  },
  separatorText: {
    color: paper.inkFaint,
    fontFamily: paperFont.mono,
    fontSize: 9.5,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    backgroundColor: 'rgba(12, 25, 38, 0.05)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 9,
    overflow: 'hidden',
  },
});
