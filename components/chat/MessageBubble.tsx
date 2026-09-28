import { useMemo } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import type { ReplyQuote } from '../../services/serviceChat';
import { bubbleSize } from './media';
import { mentionParts } from './mentions';
import type { Person } from '../../lib/people';
import type { ReactionCount } from './reactions';
import { paper, typo, shadow, space } from '../../theme';
import { GroupMonogram } from './GroupPicker';
import { timeLabel } from '../../lib/datetime';

const AVATAR = 24;
const ROUND = 18;
const TIGHT = 6;
const TAIL = 5;

type MessageBubbleProps = {
  content: string;
  senderName: string;
  senderAvatar?: string | null;
  createdAt: string;
  mine: boolean;
  isFirst: boolean;
  isLast: boolean;
  status?: 'pending' | 'failed';
  onRetry?: () => void;
  editedAt?: string | null;
  deleted?: boolean;
  onLongPress?: () => void;
  reactions?: ReactionCount[];
  onToggleReaction?: (emoji: string) => void;
  reply?: ReplyQuote | null;
  replyUnknown?: boolean;
  members?: Person[];
  meId?: string;
  imageUri?: string | null;
  imageWidth?: number;
  imageHeight?: number;
  onOpenImage?: () => void;
};

const PHOTO_MAX_WIDTH = 232;
const PHOTO_MAX_HEIGHT = 300;

export default function MessageBubble({
  content,
  senderName,
  senderAvatar,
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

  const bubblePress = !deleted && ((status === 'failed' && onRetry) || onLongPress);

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
      {mine ? null : isLast ? (
        <GroupMonogram name={senderName || '?'} uri={senderAvatar} size={AVATAR} />
      ) : (
        <View style={styles.avatarSpacer} />
      )}

      <View style={[styles.column, mine ? styles.columnMine : styles.columnOther]}>
        {!mine && isFirst && senderName ? (
          <Text style={styles.sender} numberOfLines={1}>
            {senderName}
          </Text>
        ) : null}

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
                <Text style={[styles.quoteBody, styles.quoteGone]} numberOfLines={1}>
                  Replying to an earlier message
                </Text>
              )}
            </View>
          </View>
        ) : null}

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

        {status === 'failed' ? (
          <Text style={styles.failedNote}>Not sent · Tap to try again</Text>
        ) : status === 'pending' ? (
          <Text style={styles.pendingNote}>Sending…</Text>
        ) : isLast ? (
          <Text style={styles.time}>
            {timeLabel(createdAt)}
            {editedAt && !deleted ? ' · edited' : ''}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

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
  bubblePhoto: { padding: 4, overflow: 'hidden' },
  bubbleBarePhoto: { padding: 0 },
  photo: { borderRadius: ROUND - 4, backgroundColor: paper.surfaceAlt },
  caption: { paddingHorizontal: 10, paddingTop: 7, paddingBottom: 3 },
  bubbleMine: { backgroundColor: paper.mine },
  bubbleOther: { backgroundColor: paper.surface, ...shadow.bubble },
  bubblePending: { opacity: 0.55 },
  bubbleFailed: { backgroundColor: paper.danger },
  bubbleDeleted: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: paper.line,
  },
  deletedText: {
    color: paper.inkFaint,
    ...typo.regular,
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
  quoteWho: { color: paper.accent, ...typo.semi, fontSize: 11 },
  quoteBody: { color: paper.inkSoft, ...typo.regular, fontSize: 12, lineHeight: 16 },
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
  chipMine: { borderColor: paper.accent, backgroundColor: paper.accentSoft },
  chipEmoji: { fontSize: 12, lineHeight: 16 },
  chipCount: { color: paper.inkSoft, ...typo.medium, fontSize: 11 },
  chipCountMine: { color: paper.accent },

  sender: {
    marginBottom: 4,
    marginLeft: 2,
    color: paper.inkFaint,
    ...typo.mono,
    fontSize: 9.5,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  text: { color: paper.ink, ...typo.regular, fontSize: 14, lineHeight: 20 },
  textMine: { color: paper.onMine },

  mention: { color: paper.accent, ...typo.semi },
  mentionOnMine: { color: paper.accentOnMine },
  mentionMe: { backgroundColor: paper.accentSoft },
  mentionMeOnMine: { backgroundColor: 'rgba(157, 180, 255, 0.22)' },
  time: {
    marginTop: 4,
    marginHorizontal: 2,
    color: paper.inkFaint,
    ...typo.mono,
    fontSize: 10.5,
  },
  pendingNote: {
    marginTop: 4,
    marginHorizontal: 2,
    color: paper.inkFaint,
    ...typo.regular,
    fontSize: 11,
  },
  failedNote: {
    marginTop: 4,
    marginHorizontal: 2,
    color: paper.danger,
    ...typo.medium,
    fontSize: 11,
  },

  separator: {
    alignItems: 'center',
    marginTop: space.lg,
    marginBottom: space.xs,
  },
  separatorText: {
    color: paper.inkFaint,
    ...typo.mono,
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
