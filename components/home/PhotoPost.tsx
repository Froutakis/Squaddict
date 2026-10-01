import { useRef, type ComponentProps } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Animated, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import type { FeedPhoto } from '../../services/servicePhotoFeed';
import {
  QUICK_REACTION,
  REACTIONS,
  postRatio,
  reactorsLine,
  tallyReactions,
  type PhotoReaction,
  type ReactionEmoji,
} from '../../lib/photoFeed';
import Monogram from '../general/Monogram';
import { parseDateKey } from '../../lib/datetime';
import { tagLabel, type EventTag } from '../../lib/tags';
import type { FeedReason } from '../../lib/photoFeed';
import { colors, radius, space, textSize, tint, typo } from '../../theme';

const DOUBLE_TAP_MS = 260;

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
  // Absent when the parea's page can't be opened: the header is then just a label.
  onOpenGroup?: () => void;
  onShowReactors: () => void;
  onImageError: () => void;
};

// One memory in the feed, as a card: the squad and the night it is from on
// top, the photo, the reactions as pills and who reacted.
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

  return (
    <View style={styles.post}>
      <Pressable
        onPress={onOpenGroup}
        disabled={!onOpenGroup}
        accessibilityRole={onOpenGroup ? 'button' : undefined}
        accessibilityLabel={onOpenGroup ? `Open ${item.group.name}` : undefined}
        style={({ pressed }) => [styles.head, pressed && onOpenGroup && styles.pressed]}
      >
        <Monogram name={item.group.name} uri={item.group.avatarUrl} size={36} style={styles.avatar} />
        <View style={styles.headText}>
          <Text style={styles.squad} numberOfLines={1}>
            {item.group.name}
          </Text>
          <Text style={styles.place} numberOfLines={1}>
            {item.event.title}
            {night ? ` · ${night}` : ''}
          </Text>
        </View>
        {why ? (
          <View style={styles.why}>
            <Text style={styles.whyText} numberOfLines={1}>
              {why}
            </Text>
          </View>
        ) : null}
      </Pressable>

      <Pressable
        onPress={tapPhoto}
        accessibilityRole="imagebutton"
        accessibilityLabel={`Photo from ${item.event.title} by ${item.group.name}${place ? ` at ${place}` : ''}`}
        accessibilityHint="Opens the night. Double tap to react."
        style={[styles.frame, { aspectRatio: postRatio(item.photo.width, item.photo.height) }]}
      >
        {url ? (
          <Image source={{ uri: url }} style={styles.photo} resizeMode="cover" onError={onImageError} />
        ) : null}

        <Animated.View
          pointerEvents="none"
          style={{
            opacity: burst,
            transform: [{ scale: burst.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] }) }],
          }}
        >
          <Ionicons name="flame" size={96} color={colors.danger} />
        </Animated.View>
      </Pressable>

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
                pressed && styles.pressed,
              ]}
            >
              <Ionicons name={mine ? filled : outline} size={18} color={mine ? colors.danger : colors.text} />
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
          style={styles.words}
        >
          <Text style={styles.text}>
            Reactions from <Text style={styles.strong}>{line}</Text>
          </Text>
        </Pressable>
      ) : (
        <View style={styles.wordsEmpty} />
      )}
    </View>
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

// "Tue 29 Sep", the night the photo is from.
function nightLabel(dateStr: string) {
  const d = parseDateKey(dateStr);
  if (!d) return '';
  const weekday = d.toLocaleDateString('en-US', { weekday: 'short' });
  const month = d.toLocaleDateString('en-US', { month: 'short' });
  return `${weekday} ${d.getDate()} ${month}`;
}

const styles = StyleSheet.create({
  post: {
    marginHorizontal: space.md,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  pressed: { opacity: 0.6 },

  head: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  avatar: { borderRadius: 12 },
  why: {
    maxWidth: 150,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceAlt,
  },
  whyText: { color: colors.textSoft, ...typo.bold, fontSize: textSize.caption },
  headText: { flex: 1, minWidth: 0 },
  squad: { color: colors.text, ...typo.display, fontSize: textSize.base },
  place: { color: colors.textSoft, ...typo.semi, fontSize: textSize.small, marginTop: 1 },

  frame: { width: '100%', backgroundColor: colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
  photo: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },

  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    paddingHorizontal: 12,
    paddingTop: space.sm,
    paddingBottom: space.xxs,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 38,
    paddingHorizontal: 12,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  pillRound: { width: 38, paddingHorizontal: 0 },
  pillMine: { borderWidth: 1.5, borderColor: colors.danger, backgroundColor: tint.danger },
  count: { color: colors.text, ...typo.bold, fontSize: textSize.body },
  countMine: { color: '#B23624', ...typo.display },

  words: { paddingHorizontal: space.md, paddingTop: space.xs, paddingBottom: space.md },
  wordsEmpty: { height: space.sm },
  text: { color: colors.text, ...typo.regular, fontSize: textSize.body, lineHeight: 18 },
  strong: { ...typo.display },
});
