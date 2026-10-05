import { useMemo, type ReactNode } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import type { ReplyQuote } from '../../services/serviceChat';
import { bubbleSize } from './media';
import { mentionParts } from './mentions';
import type { Person } from '../../lib/people';
import type { ChatReactions } from './reactions';
import { REACTION_ICONS, REACTION_NAMES } from '../general/reactionIcons';
import { colors, paper, typo, shadow, solidFor, space, tint } from '../../theme';
import { GroupMonogram } from './GroupPicker';
import { formatDateTime, keyOf, parseDateKey, timeLabel } from '../../lib/datetime';

const AVATAR = 28;
const ROUND = 18;
const TIGHT = 6;
const TAIL = 5;
// The dashed line of Home's timeline, across the chat between days.
const LINE = '#B9C6F3';
const DASHES = 40;
// Red text dark enough for small type (4.5:1), which paper.danger is not.
const RED_TEXT = '#B23624';
const MINE_CHIP_EDGE = '#F1C6BD';

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
  reactions?: ChatReactions;
  onToggleReaction?: (emoji: string) => void;
  reply?: ReplyQuote | null;
  replyUnknown?: boolean;
  members?: Person[];
  meId?: string;
  imageUri?: string | null;
  imageWidth?: number;
  imageHeight?: number;
  onOpenImage?: () => void;
  // A plan suggested to the parea (PlanCard), shown in place of the text.
  planCard?: ReactNode;
  // The message being answered in the composer.
  highlighted?: boolean;
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
  planCard,
  highlighted = false,
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

  // What it answers, inside the bubble on top.
  function renderQuote() {
    if (!reply && !replyUnknown) {
      return null;
    }
    return (
      <View style={[styles.quote, mine && styles.quoteMine, hasPhoto && styles.quoteOnPhoto]}>
        {reply ? (
          <>
            <Text style={[styles.quoteWho, mine && styles.quoteWhoMine]} numberOfLines={1}>
              {reply.senderName || 'Someone'}
            </Text>
            <Text
              style={[styles.quoteBody, mine && styles.quoteBodyMine, reply.deleted && styles.quoteGone]}
              numberOfLines={1}
            >
              {reply.deleted ? 'Message deleted' : reply.content}
            </Text>
          </>
        ) : (
          <Text style={[styles.quoteBody, mine && styles.quoteBodyMine, styles.quoteGone]} numberOfLines={1}>
            Replying to an earlier message
          </Text>
        )}
      </View>
    );
  }

  function renderContent(textStyle: any) {
    if (!hasPhoto) {
      return (
        <>
          {renderQuote()}
          {renderText(textStyle)}
        </>
      );
    }

    return (
      <>
        {renderQuote()}
        <Pressable
          onPress={onOpenImage}
          disabled={!onOpenImage}
          accessibilityRole="imagebutton"
          accessibilityLabel={`Photo from ${mine ? 'you' : senderName || 'someone'}. Open it`}
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
  const failed = status === 'failed';

  const shape = mine
    ? {
        borderTopRightRadius: isFirst ? ROUND : TIGHT,
        borderBottomRightRadius: isLast ? TAIL : TIGHT,
      }
    : {
        borderTopLeftRadius: isFirst ? ROUND : TIGHT,
        borderBottomLeftRadius: isLast ? TAIL : TIGHT,
      };

  const known = reactions?.known ?? [];
  const other = reactions?.other ?? null;
  const hasReactions = known.length > 0 || other !== null;
  const editedNote = !mine && !!editedAt && !deleted;

  const bubbleStyle = [
    styles.bubble,
    hasPhoto && styles.bubblePhoto,
    hasPhoto && !captionOnly && !reply && !replyUnknown && styles.bubbleBarePhoto,
    mine ? styles.bubbleMine : styles.bubbleOther,
    status === 'pending' && styles.bubblePending,
    highlighted && (hasPhoto ? styles.highlightPhoto : styles.highlight),
    shape,
  ];

  let bubble: ReactNode;
  if (deleted) {
    bubble = (
      <View style={[styles.bubble, styles.bubbleDeleted, shape]} accessibilityLabel="Message deleted">
        <Text style={styles.deletedText}>Message deleted</Text>
      </View>
    );
  } else if (bubblePress) {
    bubble = (
      <Pressable
        onPress={failed ? onRetry : undefined}
        onLongPress={failed ? undefined : onLongPress}
        accessibilityRole="button"
        accessibilityLabel={
          failed
            ? 'Message not sent. Tap to try again.'
            : `${mine ? 'You' : senderName || 'Someone'}, ${timeLabel(createdAt)}: ${content.replace(/\.+$/, '') ||(hasPhoto ? 'photo' : '')}. Message options`
        }
        accessibilityHint={failed ? undefined : 'Long press for reactions, reply and more'}
        style={function ({ pressed }) {
          return [...bubbleStyle, pressed && styles.pressed];
        }}
      >
        {renderContent([styles.text, mine && styles.textMine])}
      </Pressable>
    );
  } else {
    bubble = <View style={bubbleStyle}>{renderContent([styles.text, mine && styles.textMine])}</View>;
  }

  return (
    <View style={[styles.row, mine ? styles.rowMine : styles.rowOther, isFirst && styles.rowFirst]}>
      {mine ? null : (
        <View
          style={[
            styles.avatarSpacer,
            { marginBottom: (hasReactions ? 20 : 0) + (editedNote ? 17 : 0) },
          ]}
        >
          {isLast ? <GroupMonogram name={senderName || '?'} uri={senderAvatar} size={AVATAR} /> : null}
        </View>
      )}

      <View style={[styles.column, asCard && styles.columnCard, mine ? styles.columnMine : styles.columnOther]}>
        {!mine && isFirst && senderName ? (
          <Text style={styles.sender} numberOfLines={1}>
            <Text style={{ color: solidFor(senderName) }}>{senderName}</Text>
            <Text style={styles.senderTime}> · {timeLabel(createdAt)}</Text>
          </Text>
        ) : null}

        {failed ? (
          <View style={styles.failedRow}>
            <Pressable
              onPress={onRetry}
              disabled={!onRetry}
              accessibilityRole="button"
              accessibilityLabel="Not sent. Try again"
              style={({ pressed }) => [styles.retry, pressed && styles.pressed]}
            >
              <Ionicons name="alert-circle" size={22} color={paper.danger} />
            </Pressable>
            <View style={styles.failedBubble}>{bubble}</View>
          </View>
        ) : (
          bubble
        )}

        {hasReactions ? (
          <View style={styles.reactions}>
            {known.map(function (item) {
              const [outline, filled] = REACTION_ICONS[item.emoji];
              const name = REACTION_NAMES[item.emoji];
              return (
                <Pressable
                  key={item.emoji}
                  onPress={function () {
                    onToggleReaction?.(item.emoji);
                  }}
                  disabled={!onToggleReaction}
                  hitSlop={{ top: 6, bottom: 6, left: 0, right: 0 }}
                  accessibilityRole="button"
                  accessibilityLabel={
                    item.mine
                      ? `${name}, ${item.count}, you reacted. Tap to take it back`
                      : `${name}, ${item.count}. Tap to add yours`
                  }
                  accessibilityState={{ selected: item.mine }}
                  style={({ pressed }) => [styles.chipRing, pressed && styles.chipPressed]}
                >
                  <View style={[styles.chip, item.mine && styles.chipMine]}>
                    <Ionicons
                      name={item.mine ? filled : outline}
                      size={16}
                      color={item.mine ? paper.danger : paper.ink}
                    />
                    {item.count > 1 ? (
                      <Text style={[styles.chipCount, item.mine && styles.chipCountMine]}>{item.count}</Text>
                    ) : null}
                  </View>
                </Pressable>
              );
            })}
            {other ? (
              <View
                style={styles.chipRing}
                accessible
                accessibilityLabel={`${other.count} other ${other.count === 1 ? 'reaction' : 'reactions'}`}
              >
                <View style={styles.chip}>
                  <Text style={[styles.chipCount, styles.chipOther]}>+{other.count}</Text>
                </View>
              </View>
            ) : null}
          </View>
        ) : null}

        {failed ? (
          <Text style={styles.failedNote}>Not sent. Tap the dot to try again.</Text>
        ) : status === 'pending' ? (
          <Text style={styles.pendingNote}>Sending…</Text>
        ) : mine && isLast ? (
          <Text style={styles.time}>
            {timeLabel(createdAt)}
            {editedAt && !deleted ? ' · edited' : ''}
          </Text>
        ) : editedAt && !deleted ? (
          <Text style={styles.time}>edited</Text>
        ) : null}
      </View>
    </View>
  );
}

// Between days: Home's dashed line, with the black TODAY pill on today and
// the date on the others.
export function DateSeparator({ label, day, today = false }: { label: string; day?: string; today?: boolean }) {
  const text = today ? 'TODAY' : pillText(label, day);

  return (
    <View style={styles.separator} accessible accessibilityRole="header" accessibilityLabel={today ? 'Today' : label}>
      <Dashes />
      <Text style={[styles.pill, today && styles.pillToday]}>{text}</Text>
      <Dashes />
    </View>
  );
}

// "YESTERDAY", "SUN 4 OCT", "SUN 4 OCT 2025".
function pillText(label: string, day?: string): string {
  const date = day ? parseDateKey(day) : null;
  if (!date || label === 'Yesterday') return label.toUpperCase();
  const year = date.getFullYear() === new Date().getFullYear() ? '' : ` ${date.getFullYear()}`;
  return `${formatDateTime(keyOf(date))}${year}`.toUpperCase();
}

function Dashes() {
  return (
    <View style={styles.dashes} pointerEvents="none">
      {Array.from({ length: DASHES }, (_, i) => (
        <View key={i} style={styles.dash} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, marginTop: 3 },
  rowFirst: { marginTop: 14 },
  rowMine: { justifyContent: 'flex-end' },
  rowOther: { justifyContent: 'flex-start' },
  avatarSpacer: { width: AVATAR },
  column: { maxWidth: '80%' },
  columnCard: { maxWidth: '100%' },
  columnMine: { alignItems: 'flex-end' },
  columnOther: { alignItems: 'flex-start', flexShrink: 1 },

  bubble: { paddingHorizontal: 13, paddingVertical: 9, borderRadius: ROUND },
  bubblePhoto: { padding: 4, overflow: 'hidden' },
  bubbleBarePhoto: { padding: 0 },
  photo: { borderRadius: ROUND - 4, backgroundColor: paper.surfaceAlt },
  caption: { paddingHorizontal: 9, paddingTop: 6, paddingBottom: 4 },
  bubbleMine: { backgroundColor: paper.mine },
  bubbleOther: { backgroundColor: paper.surface, ...shadow.bubble },
  bubblePending: { opacity: 0.55 },
  // The message you are answering: a blue ring, the bubble's size unchanged.
  highlight: { borderWidth: 2, borderColor: paper.accent, paddingHorizontal: 11, paddingVertical: 7 },
  highlightPhoto: { borderWidth: 2, borderColor: paper.accent, padding: 2 },
  bubbleDeleted: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.borderStrong,
  },
  deletedText: {
    color: paper.inkSoft,
    ...typo.regular,
    fontSize: 15,
    lineHeight: 22,
    fontStyle: 'italic',
  },
  pressed: { opacity: 0.85 },

  failedRow: { flexDirection: 'row', alignItems: 'center', maxWidth: '100%' },
  failedBubble: { flexShrink: 1 },
  retry: { width: 44, height: 44, marginRight: -4, alignItems: 'center', justifyContent: 'center' },

  quote: {
    marginTop: -3,
    marginHorizontal: -7,
    marginBottom: 7,
    paddingHorizontal: 10,
    paddingTop: 6,
    paddingBottom: 7,
    gap: 1,
    borderRadius: 12,
    backgroundColor: paper.accentSoft,
  },
  quoteMine: { backgroundColor: 'rgba(255, 255, 255, 0.12)' },
  quoteOnPhoto: { marginTop: 0, marginHorizontal: 0, marginBottom: 4 },
  quoteWho: { color: paper.accent, ...typo.mono, fontSize: 10.5, letterSpacing: 1.2, textTransform: 'uppercase' },
  quoteWhoMine: { color: paper.accentOnMine },
  quoteBody: { color: paper.inkSoft, ...typo.regular, fontSize: 14, lineHeight: 19 },
  quoteBodyMine: { color: colors.borderStrong },
  quoteGone: { fontStyle: 'italic' },

  // The chips sit over the bubble's bottom edge, ringed in the page colour.
  reactions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 2,
    marginTop: -8,
    paddingHorizontal: 6,
    zIndex: 1,
  },
  chipRing: { borderRadius: 999, borderWidth: 2, borderColor: paper.bg },
  chipPressed: { transform: [{ scale: 0.94 }] },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    height: 28,
    minWidth: 30,
    paddingLeft: 7,
    paddingRight: 9,
    backgroundColor: paper.surface,
    borderWidth: 1,
    borderColor: paper.line,
    borderRadius: 999,
  },
  chipMine: { borderColor: MINE_CHIP_EDGE, backgroundColor: tint.danger },
  chipCount: { color: paper.ink, ...typo.bold, fontSize: 12.5, fontVariant: ['tabular-nums'] },
  chipCountMine: { color: RED_TEXT },
  chipOther: { color: paper.inkSoft, marginLeft: 2 },

  sender: {
    marginBottom: 3,
    marginLeft: 2,
    ...typo.mono,
    fontSize: 11,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  senderTime: { color: paper.inkSoft },
  text: { color: paper.ink, ...typo.regular, fontSize: 16, lineHeight: 22 },
  textMine: { color: paper.onMine },

  mention: { color: paper.accent, ...typo.bold },
  mentionOnMine: { color: paper.accentOnMine },
  mentionMe: { backgroundColor: paper.accentSoft },
  mentionMeOnMine: { backgroundColor: 'rgba(157, 180, 255, 0.22)' },
  time: {
    marginTop: 3,
    marginHorizontal: 4,
    color: paper.inkSoft,
    ...typo.mono,
    fontSize: 11,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  pendingNote: {
    marginTop: 3,
    marginHorizontal: 4,
    color: paper.inkSoft,
    ...typo.medium,
    fontSize: 12,
  },
  failedNote: {
    marginTop: 3,
    marginHorizontal: 4,
    color: RED_TEXT,
    ...typo.semi,
    fontSize: 12.5,
  },

  separator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingTop: 20,
    paddingBottom: 4,
  },
  dashes: { flex: 1, height: 2, flexDirection: 'row', gap: 4, overflow: 'hidden' },
  dash: { width: 5, height: 2, borderRadius: 1, backgroundColor: LINE },
  pill: {
    overflow: 'hidden',
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: paper.line,
    backgroundColor: paper.surface,
    color: paper.inkSoft,
    ...typo.mono,
    fontSize: 10.5,
    letterSpacing: 1.2,
  },
  pillToday: { backgroundColor: paper.ink, borderColor: paper.ink, color: paper.onMine },
});
