import { Pressable, StyleSheet, Text, View } from 'react-native';
import { paper, paperFont, space } from '../../theme';
import { SquadMonogram } from './SquadPicker';

const AVATAR = 26;
const ROUND = 16;
const TIGHT = 6;

function timeLabel(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

type MessageBubbleProps = {
  content: string;
  senderName: string;
  createdAt: string;
  mine: boolean;
  isFirst: boolean;
  isLast: boolean;
  status?: 'pending' | 'failed';
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
