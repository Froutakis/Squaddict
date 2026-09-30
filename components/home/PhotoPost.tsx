import { useRef } from 'react';
import { Animated, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import type { FeedPhoto } from '../../services/servicePhotoFeed';
import {
  QUICK_REACTION,
  REACTIONS,
  postRatio,
  postedAgo,
  reactorsLine,
  tallyReactions,
  type PhotoReaction,
} from '../../lib/photoFeed';
import Monogram from '../general/Monogram';
import { dayMonth } from '../../lib/datetime';
import { colors, space, textSize, typo } from '../../theme';

const DOUBLE_TAP_MS = 260;

type PhotoPostProps = {
  item: FeedPhoto;
  url?: string;
  reactions: PhotoReaction[];
  userId: string;
  onReact: (emoji: string) => void;
  onOpenNight: () => void;
  onOpenGroup: () => void;
  onShowReactors: () => void;
  onImageError: () => void;
};

// One memory in the feed: the squad and the night it is from on top, the
// photo edge to edge, the reactions and a line of words under it.
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
        accessibilityRole="button"
        accessibilityLabel={`Open ${item.group.name}`}
        style={({ pressed }) => [styles.head, pressed && styles.pressed]}
      >
        <Monogram name={item.group.name} uri={item.group.avatarUrl} size={34} />
        <View style={styles.headText}>
          <Text style={styles.squad} numberOfLines={1}>
            {item.group.name}
          </Text>
          <Text style={styles.place} numberOfLines={1}>
            {item.event.title}
          </Text>
        </View>
      </Pressable>

      <Pressable
        onPress={tapPhoto}
        accessibilityRole="imagebutton"
        accessibilityLabel={`Photo from ${item.event.title} by ${item.group.name}`}
        accessibilityHint="Opens the night. Double tap to react."
        style={[styles.frame, { aspectRatio: postRatio(item.photo.width, item.photo.height) }]}
      >
        {url ? (
          <Image source={{ uri: url }} style={styles.photo} resizeMode="cover" onError={onImageError} />
        ) : null}

        <Animated.Text
          pointerEvents="none"
          style={[
            styles.burst,
            {
              opacity: burst,
              transform: [{ scale: burst.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] }) }],
            },
          ]}
        >
          {QUICK_REACTION}
        </Animated.Text>
      </Pressable>

      <View style={styles.actions}>
        {REACTIONS.map(function (emoji) {
          const count = tally.counts[emoji] ?? 0;
          const mine = tally.mine === emoji;

          return (
            <Pressable
              key={emoji}
              onPress={() => onReact(emoji)}
              accessibilityRole="button"
              accessibilityLabel={`React ${emoji}${count > 0 ? `, ${count}` : ''}`}
              accessibilityState={{ selected: mine }}
              style={({ pressed }) => [styles.action, pressed && styles.pressed]}
            >
              <Text style={[styles.emoji, !mine && tally.mine !== null && styles.emojiFaded]}>{emoji}</Text>
              {count > 0 ? <Text style={[styles.count, mine && styles.countMine]}>{count}</Text> : null}
            </Pressable>
          );
        })}
      </View>

      <View style={styles.words}>
        {line ? (
          <Pressable
            onPress={onShowReactors}
            accessibilityRole="button"
            accessibilityLabel={`Reactions from ${line}. See everyone.`}
            hitSlop={6}
          >
            <Text style={styles.text}>
              Reactions from <Text style={styles.strong}>{line}</Text>
            </Text>
          </Pressable>
        ) : null}

        <Text style={styles.text} numberOfLines={2}>
          From <Text style={styles.strong}>{item.event.title}</Text>
          {place ? ` at ${place}` : ''} · {dayMonth(item.event.date)}
        </Text>

        <Text style={styles.time}>{postedAgo(item.photo.createdAt, new Date())}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  post: { width: '100%' },
  pressed: { opacity: 0.6 },

  head: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingHorizontal: space.md,
    paddingVertical: space.xs,
    minHeight: 48,
  },
  headText: { flex: 1, minWidth: 0 },
  squad: { color: colors.text, ...typo.semi, fontSize: textSize.base },
  place: { color: colors.textSoft, ...typo.regular, fontSize: textSize.small },

  frame: { width: '100%', backgroundColor: colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
  photo: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
  burst: { fontSize: 96 },

  actions: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.xs },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    minWidth: 44,
    height: 44,
    paddingHorizontal: space.xs,
  },
  emoji: { fontSize: 24 },
  emojiFaded: { opacity: 0.45 },
  count: { color: colors.textSoft, ...typo.mono, fontSize: textSize.body },
  countMine: { color: colors.text, ...typo.bold },

  words: { paddingHorizontal: space.md, gap: 3 },
  text: { color: colors.text, ...typo.regular, fontSize: textSize.base, lineHeight: 19 },
  strong: { ...typo.semi },
  time: { color: colors.textFaint, ...typo.regular, fontSize: textSize.caption, marginTop: 2 },
});
