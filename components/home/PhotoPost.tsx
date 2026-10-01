import { useRef, type ComponentProps } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import type { FeedPhoto } from '../../services/servicePhotoFeed';
import {
  QUICK_REACTION,
  REACTIONS,
  postRatio,
  reactorsLine,
  tallyReactions,
  type FeedReason,
  type PhotoReaction,
  type ReactionEmoji,
} from '../../lib/photoFeed';
import Monogram from '../general/Monogram';
import Ticket from '../general/Ticket';
import { parseDateKey } from '../../lib/datetime';
import { tagLabel, type EventTag } from '../../lib/tags';
import { colors, radius, space, textSize, tint, typo } from '../../theme';

const DOUBLE_TAP_MS = 260;
// Stands in for the photo until its link is signed, so the ticket keeps its shape.
const BLANK = 'data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=';

type IconName = ComponentProps<typeof Ionicons>['name'];

// The reactions are kept as emoji; on the post they are drawn as line icons,
// filled in once they are yours.
const REACTION_ICONS: Record<ReactionEmoji, [IconName, IconName]> = {
  '🔥': ['flame-outline', 'flame'],
  '😂': ['happy-outline', 'happy'],
  '😍': ['heart-outline', 'heart'],
  '🍻': ['beer-outline', 'beer'],
};

const REACTION_NAMES: Record<ReactionEmoji, string> = {
  '🔥': 'fire',
  '😂': 'laugh',
  '😍': 'heart',
  '🍻': 'cheers',
};

type PhotoPostProps = {
  item: FeedPhoto;
  url?: string;
  reactions: PhotoReaction[];
  userId: string;
  onReact: (emoji: string) => void;
  onOpenNight: () => void;
  // Absent when the parea's page can't be opened: the parea is then just a label.
  onOpenGroup?: () => void;
  onShowReactors: () => void;
  onImageError: () => void;
};

// One memory in the feed, as a used ticket: the photo is its cover, with the
// parea, the night and the date on it; the perforation is torn, because the
// night happened; the stub keeps the reactions.
export default function PhotoPost({
  item,
  url,
  reactions,
  userId,
  onReact,
  onOpenNight,
  onOpenGroup,
  onShowReactors,
  onImageError,
}: PhotoPostProps) {
  const lastTap = useRef(0);
  const single = useRef<ReturnType<typeof setTimeout> | null>(null);
  const burst = useRef(new Animated.Value(0)).current;

  const tally = tallyReactions(reactions, userId);
  const line = reactorsLine(reactions, userId);
  const place = item.event.placeLabel ?? item.event.location;
  const night = nightLabel(item.event.date);
  const why = whyLabel(item.reason, item.via);

  function pop() {
    burst.setValue(0);
    Animated.sequence([
      Animated.spring(burst, { toValue: 1, friction: 5, tension: 140, useNativeDriver: true }),
      Animated.timing(burst, { toValue: 0, duration: 220, delay: 260, useNativeDriver: true }),
    ]).start();
  }

  // One tap opens the night; two quick taps leave a fire, like a double-tap like.
  function tapPhoto() {
    const now = Date.now();

    if (now - lastTap.current < DOUBLE_TAP_MS) {
      if (single.current) clearTimeout(single.current);
      lastTap.current = 0;
      pop();
      if (tally.mine !== QUICK_REACTION) onReact(QUICK_REACTION);
      return;
    }

    lastTap.current = now;
    single.current = setTimeout(onOpenNight, DOUBLE_TAP_MS);
  }

  const stub = (
    <View style={styles.stub}>
      <View style={styles.actions}>
        {REACTIONS.map(function (emoji) {
          const count = tally.counts[emoji] ?? 0;
          const mine = tally.mine === emoji;
          const [outline, filled] = REACTION_ICONS[emoji];

          return (
            <Pressable
              key={emoji}
              onPress={() => onReact(emoji)}
              accessibilityRole="button"
              accessibilityLabel={`React with ${REACTION_NAMES[emoji]}${count > 0 ? `, ${count}` : ''}${mine ? ', you reacted' : ''}`}
              accessibilityState={{ selected: mine }}
              style={({ pressed }) => [
                styles.pill,
                count === 0 && styles.pillRound,
                mine && styles.pillMine,
                pressed && styles.pillPressed,
              ]}
            >
              <Ionicons name={mine ? filled : outline} size={17} color={mine ? colors.danger : colors.text} />
              {count > 0 ? <Text style={[styles.count, mine && styles.countMine]}>{count}</Text> : null}
            </Pressable>
          );
        })}
      </View>

      {line ? (
        <Pressable
          onPress={onShowReactors}
          accessibilityRole="button"
          accessibilityLabel={`Reactions from ${line}. See everyone.`}
          hitSlop={6}
        >
          <Text style={styles.text} numberOfLines={1}>
            Reactions from <Text style={styles.strong}>{line}</Text>
          </Text>
        </Pressable>
      ) : (
        <Text style={styles.quiet}>Double tap the photo to leave a fire.</Text>
      )}
    </View>
  );

  return (
    <Ticket
      cover={url ?? BLANK}
      onCoverError={onImageError}
      stub={stub}
      torn
      cutColor={colors.bg}
      style={styles.ticket}
    >
      <Pressable
        onPress={tapPhoto}
        accessibilityRole="imagebutton"
        accessibilityLabel={`Photo from ${item.event.title} by ${item.group.name}${place ? ` at ${place}` : ''}`}
        accessibilityHint="Opens the night. Double tap to react."
        style={[styles.cover, { aspectRatio: postRatio(item.photo.width, item.photo.height) }]}
      >
        <View style={styles.topRow}>
          <Pressable
            onPress={onOpenGroup}
            disabled={!onOpenGroup}
            accessibilityRole={onOpenGroup ? 'button' : undefined}
            accessibilityLabel={onOpenGroup ? `Open ${item.group.name}` : undefined}
            hitSlop={6}
            style={({ pressed }) => [styles.groupPill, pressed && onOpenGroup && styles.pressed]}
          >
            <Monogram name={item.group.name} uri={item.group.avatarUrl} size={20} style={styles.groupAvatar} />
            <Text style={styles.groupName} numberOfLines={1}>
              {item.group.name}
            </Text>
          </Pressable>
          {why ? (
            <View style={styles.why}>
              <Text style={styles.whyText} numberOfLines={1}>
                {why}
              </Text>
            </View>
          ) : null}
        </View>

        <View style={styles.burstWrap} pointerEvents="none">
          <Animated.View
            style={{
              opacity: burst,
              transform: [{ scale: burst.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] }) }],
            }}
          >
            <Ionicons name="flame" size={96} color={colors.danger} />
          </Animated.View>
        </View>

        <View style={styles.bottom}>
          <Text style={styles.title} numberOfLines={2}>
            {item.event.title}
          </Text>
          <Text style={styles.meta} numberOfLines={1}>
            {[night, place].filter(Boolean).join(' · ')}
          </Text>
        </View>
      </Pressable>
    </Ticket>
  );
}

// Why a night from outside your parea is in your feed, in a few words.
function whyLabel(reason: FeedReason, via: string | null): string | null {
  switch (reason) {
    case 'following':
      return 'Following';
    case 'member_went':
      if (via === 'you') return 'You were there';
      return via ? `${firstWord(via)} was there` : 'One of you was there';
    case 'followed_went':
      return via ? `${via} went` : 'A parea you follow went';
    case 'similar':
      return via ? `Like your ${tagLabel(via as EventTag).toLowerCase()} nights` : 'Like your nights';
    case 'public':
      return 'Public night';
    default:
      return null;
  }
}

function firstWord(name: string) {
  return name.trim().split(/\s+/)[0] || name;
}

// "TUE 29 SEP", the night the photo is from, as it is printed on the ticket.
function nightLabel(dateStr: string) {
  const d = parseDateKey(dateStr);
  if (!d) return '';
  const weekday = d.toLocaleDateString('en-US', { weekday: 'short' });
  const month = d.toLocaleDateString('en-US', { month: 'short' });
  return `${weekday} ${d.getDate()} ${month}`.toUpperCase();
}

const styles = StyleSheet.create({
  ticket: { marginHorizontal: space.md },
  pressed: { opacity: 0.7 },

  // The photo is the ticket's cover; this is what sits on it.
  cover: { width: '100%', justifyContent: 'space-between' },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  groupPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 1,
    paddingLeft: 3,
    paddingRight: space.sm,
    paddingVertical: 3,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(12,25,38,0.45)',
  },
  groupAvatar: { borderRadius: 7 },
  groupName: { flexShrink: 1, color: '#FFFFFF', ...typo.semi, fontSize: textSize.caption },
  why: {
    marginLeft: 'auto',
    maxWidth: 150,
    paddingHorizontal: space.sm,
    paddingVertical: 4,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255,255,255,0.88)',
  },
  whyText: { color: colors.ink, ...typo.bold, fontSize: textSize.caption },
  burstWrap: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottom: { gap: 2 },
  title: { color: '#FFFFFF', ...typo.title, fontSize: textSize.heading, letterSpacing: -0.3 },
  meta: { color: 'rgba(255,255,255,0.85)', ...typo.mono, fontSize: textSize.small, letterSpacing: 0.6 },

  // The stub: the reactions, and who gave them.
  stub: { gap: space.sm },
  actions: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    height: 36,
    paddingHorizontal: 11,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  pillRound: { width: 36, paddingHorizontal: 0 },
  pillMine: { borderWidth: 1.5, borderColor: colors.danger, backgroundColor: tint.danger },
  pillPressed: { transform: [{ scale: 0.94 }] },
  count: { color: colors.text, ...typo.bold, fontSize: textSize.body },
  countMine: { color: '#B23624', ...typo.display },
  text: { color: colors.text, ...typo.regular, fontSize: textSize.body, lineHeight: 18 },
  strong: { ...typo.display },
  quiet: { color: colors.textSoft, ...typo.medium, fontSize: textSize.body },
});
