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
import type { ChatMessage } from '../../services/serviceChat';
import { REACTIONS } from '../../lib/photoFeed';
import { timeLabel } from '../../lib/datetime';
import { REACTION_ICONS, REACTION_NAMES } from '../general/reactionIcons';
import { colors, layout, paper, typo, radius, space, tint } from '../../theme';

// Red text dark enough for small type (4.5:1), which paper.danger is not.
const RED_TEXT = '#B23624';
const MINE_EDGE = '#F1C6BD';

type MessageMenuProps = {
  message: ChatMessage | null;
  myEmoji?: string | null;
  canEdit?: boolean;
  onClose: () => void;
  onEdit: (message: ChatMessage) => void;
  onDelete: (message: ChatMessage) => void;
  onReact: (message: ChatMessage, emoji: string) => void;
  onReply: (message: ChatMessage) => void;
};

// A long press on a message: the four reactions of the memories, each with
// its name, then Reply, and Edit and Delete on your own.
export default function MessageMenu({
  message,
  myEmoji = null,
  canEdit = false,
  onClose,
  onEdit,
  onDelete,
  onReact,
  onReply,
}: MessageMenuProps) {
  if (!message) {
    return null;
  }

  const target = message;
  const who = canEdit ? 'You' : target.senderName || 'Someone';
  const preview = target.content.trim().length > 0 ? target.content : target.attachment ? 'Photo' : '';

  return (
    <Modal
      transparent
      visible
      animationType="fade"
      onRequestClose={onClose}
      accessibilityViewIsModal
    >
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close menu">
        <Pressable style={styles.sheet} accessibilityLabel="Message options">
          <View style={styles.grab} />

          <View style={styles.preview}>
            <Text style={styles.previewWho} numberOfLines={1}>
              {who} · {timeLabel(target.createdAt)}
            </Text>
            {preview ? (
              <Text style={styles.previewText} numberOfLines={2}>
                {preview}
              </Text>
            ) : null}
          </View>

          <View style={styles.reactRow}>
            {REACTIONS.map(function (emoji) {
              const chosen = myEmoji === emoji;
              const [outline, filled] = REACTION_ICONS[emoji];
              const name = REACTION_NAMES[emoji];
              const label = name.charAt(0).toUpperCase() + name.slice(1);
              return (
                <Pressable
                  key={emoji}
                  onPress={function () {
                    onReact(target, emoji);
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={chosen ? `Remove ${name}` : `React with ${name}`}
                  accessibilityState={{ selected: chosen }}
                  style={function ({ pressed }) {
                    return [styles.react, chosen && styles.reactChosen, pressed && styles.reactPressed];
                  }}
                >
                  <Ionicons name={chosen ? filled : outline} size={24} color={chosen ? paper.danger : paper.ink} />
                  <Text style={[styles.reactLabel, chosen && styles.reactLabelChosen]}>{label}</Text>
                </Pressable>
              );
            })}
          </View>

          <View style={styles.rows}>
            <Pressable
              onPress={function () {
                onReply(target);
              }}
              accessibilityRole="button"
              style={itemStyle}
            >
              <Ionicons name="arrow-undo" size={18} color={paper.ink} />
              <Text style={styles.text}>Reply</Text>
            </Pressable>

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
                  <Ionicons name="pencil" size={18} color={paper.ink} />
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
                  <Ionicons name="trash-outline" size={18} color={RED_TEXT} />
                  <Text style={[styles.text, styles.textDanger]}>Delete</Text>
                </Pressable>
              </>
            ) : null}
          </View>
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
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(12, 25, 38, 0.38)',
  },
  sheet: {
    width: '100%',
    maxWidth: layout.column,
    alignSelf: 'center',
    paddingHorizontal: space.md,
    paddingBottom: space.xl,
    backgroundColor: paper.bg,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
  },
  grab: {
    alignSelf: 'center',
    width: 38,
    height: 5,
    marginTop: 7,
    marginBottom: 6,
    borderRadius: 3,
    backgroundColor: colors.borderStrong,
  },
  preview: { gap: 3, paddingHorizontal: 4, paddingTop: space.xs, paddingBottom: 14 },
  previewWho: {
    color: paper.inkSoft,
    ...typo.mono,
    fontSize: 10.5,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  previewText: { color: paper.ink, ...typo.regular, fontSize: 15, lineHeight: 21 },

  reactRow: { flexDirection: 'row', gap: space.xs + 2 },
  react: {
    flex: 1,
    height: 64,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    backgroundColor: paper.surface,
    borderWidth: 1,
    borderColor: paper.line,
    borderRadius: radius.md + 2,
  },
  reactChosen: { backgroundColor: tint.danger, borderColor: MINE_EDGE },
  reactPressed: { transform: [{ scale: 0.95 }] },
  reactLabel: { color: paper.inkSoft, ...typo.semi, fontSize: 12 },
  reactLabelChosen: { color: RED_TEXT },

  rows: { marginTop: space.sm + 2, backgroundColor: paper.surface, borderRadius: radius.md + 2, overflow: 'hidden' },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm + 2,
    minHeight: 52,
    paddingHorizontal: space.md,
  },
  itemPressed: { backgroundColor: paper.surfaceAlt },
  divider: { height: 1, backgroundColor: paper.line },
  text: { color: paper.ink, ...typo.semi, fontSize: 16 },
  textDanger: { color: RED_TEXT },
});
