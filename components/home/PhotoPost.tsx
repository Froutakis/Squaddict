import { useRef, type ComponentProps, type ReactNode } from 'react';
import { Ionicons } from '@expo/vector-icons';
import {
  Animated,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import type { FeedPhoto } from '../../services/servicePhotoFeed';
import {
  QUICK_REACTION,
  REACTIONS,
  reactorsLine,
  tallyReactions,
  type FeedReason,
  type PhotoReaction,
  type ReactionEmoji,
} from '../../lib/photoFeed';
import Monogram from '../general/Monogram';
import { tagLabel, type EventTag } from '../../lib/tags';
import { colors, radius, shadow, space, textSize, tint, typo } from '../../theme';

const DOUBLE_TAP_MS = 260;
const SHOTS_HEIGHT = 196;
// The post keeps three reactions in sight: the ones people used, then the
// first of the rest.
const SHOWN_REACTIONS = 3;
const NOTCH = 16;
const DASHES = 40;

type IconName = ComponentProps<typeof Ionicons>['name'];

// The reactions are kept as emoji; on the post they are drawn as line icons,
// filled in once they are yours.
export const REACTION_ICONS: Record<ReactionEmoji, [IconName, IconName]> = {
  '🔥': ['flame-outline', 'flame'],
  '😂': ['happy-outline', 'happy'],
  '😍': ['heart-outline', 'heart'],
  '🍻': ['beer-outline', 'beer'],
};

export const REACTION_NAMES: Record<ReactionEmoji, string> = {
  '🔥': 'fire',
  '😂': 'laugh',
  '😍': 'heart',
  '🍻': 'cheers',
};

type PhotoPostProps = {
  item: FeedPhoto;
  url?: string;
  // Signed links for item.more, in the same order.
  moreUrls?: (string | undefined)[];
  reactions: PhotoReaction[];
  userId: string;
  // A night you haven't seen yet gets a NEW tag on its photos.
  fresh?: boolean;
  onReact: (emoji: string) => void;
  onOpenNight: () => void;
  // Absent when the parea's page can't be opened: the parea is then just a label.
  onOpenGroup?: () => void;
  onShowReactors: () => void;
  onImageError: () => void;
  onShare?: () => void;
  // Someone who was at the night but isn't on Squaddict yet.
  missing?: { name: string; onSend: () => void };
  // Under the title, above the tear: "Rooftop Gang was there too".
  between?: ReactNode;
  // At the end of the stub: a wave from another parea.
  footer?: ReactNode;
  // Why the night is here ("Kostas was there"); off where every night is public.
  showWhy?: boolean;
  style?: StyleProp<ViewStyle>;
};

// One night in the feed, as a ticket: up to three of its photos on top, what
// it was and who went, a perforation, and the stub with the reactions.
export default function PhotoPost({
  item,
  url,
  moreUrls = [],
  reactions,
  userId,
  fresh = false,
  onReact,
  onOpenNight,
  onOpenGroup,
  onShowReactors,
  onImageError,
  onShare,
  missing,
  between = null,
  footer = null,
  showWhy = true,
  style,
}: PhotoPostProps) {
  const lastTap = useRef(0);
  const single = useRef<ReturnType<typeof setTimeout> | null>(null);
  const burst = useRef(new Animated.Value(0)).current;

  const tally = tallyReactions(reactions, userId);
  const line = reactorsLine(reactions, userId);
  const place = item.event.placeLabel ?? item.event.location;
  const why = showWhy ? whyLabel(item.reason, item.via) : null;
  const shots = [url, ...item.more.map((_, i) => moreUrls[i])];
  const hidden = item.photoCount - shots.length;
  const sub = [item.group.name, place, item.wentCount > 1 ? `${item.wentCount} went` : null]
    .filter(Boolean)
    .join(' · ');

  const used = REACTIONS.filter((emoji) => (tally.counts[emoji] ?? 0) > 0 || tally.mine === emoji);
  const shown = [...used, ...REACTIONS.filter((emoji) => !used.includes(emoji))].slice(
    0,
    Math.max(SHOWN_REACTIONS, used.length),
  );

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
    <View style={[styles.card, style]}>
      <Pressable
        onPress={tapPhoto}
        accessibilityRole="imagebutton"
        accessibilityLabel={`${item.photoCount} ${item.photoCount === 1 ? 'photo' : 'photos'} from ${item.event.title}`}
        accessibilityHint="Opens the night. Double tap to react."
        style={styles.shots}
      >
        <Shot uri={shots[0]} onError={onImageError} style={styles.shotMain} />
        {shots.length > 1 ? (
          <View style={styles.side}>
            {shots.slice(1).map((uri, i) => (
              <Shot key={i} uri={uri} style={styles.shotSide}>
                {i === shots.length - 2 && hidden > 0 ? (
                  <View style={styles.moreShade}>
                    <Text style={styles.moreText}>+{hidden}</Text>
                  </View>
                ) : null}
              </Shot>
            ))}
          </View>
        ) : null}

        {fresh ? <Text style={styles.newTag}>NEW</Text> : null}

        <View style={styles.burstWrap} pointerEvents="none">
          <Animated.View
            style={{
              opacity: burst,
              transform: [{ scale: burst.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] }) }],
            }}
          >
            <Ionicons name="flame" size={88} color={colors.danger} />
          </Animated.View>
        </View>
      </Pressable>

      <View style={styles.body}>
        <View style={styles.titleRow}>
          <Text style={styles.title} numberOfLines={2}>
            {item.event.title}
          </Text>
          {why ? (
            <Text style={styles.why} numberOfLines={1}>
              {why}
            </Text>
          ) : null}
        </View>
        <Pressable
          onPress={onOpenGroup}
          disabled={!onOpenGroup}
          accessibilityRole={onOpenGroup ? 'button' : undefined}
          accessibilityLabel={onOpenGroup ? `Open ${item.group.name}` : undefined}
          hitSlop={6}
          style={({ pressed }) => [styles.sub, pressed && onOpenGroup && styles.pressed]}
        >
          <Monogram name={item.group.name} uri={item.group.avatarUrl} size={18} style={styles.subAvatar} />
          <Text style={styles.subText} numberOfLines={1}>
            {sub}
          </Text>
        </Pressable>
      </View>

      {between}

      <Perforation />

      <View style={styles.body}>
        <View style={styles.reacts}>
          {shown.map(function (emoji) {
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
                <Ionicons name={mine ? filled : outline} size={15} color={mine ? colors.danger : colors.text} />
                {count > 0 ? <Text style={[styles.count, mine && styles.countMine]}>{count}</Text> : null}
              </Pressable>
            );
          })}

          {onShare ? (
            <Pressable
              onPress={onShare}
              accessibilityRole="button"
              accessibilityLabel="Share this night as a ticket"
              style={({ pressed }) => [styles.share, pressed && styles.pillPressed]}
            >
              <Ionicons name="share-outline" size={14} color={colors.onInk} />
              <Text style={styles.shareText}>Share ticket</Text>
            </Pressable>
          ) : null}
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
          <Text style={styles.text}>Double tap the photos to leave a fire.</Text>
        )}

        {missing ? (
          <View style={styles.missing}>
            <Monogram name={missing.name} uri={null} size={20} style={styles.subAvatar} />
            <Text style={styles.missingText} numberOfLines={2}>
              <Text style={styles.strong}>{missing.name}</Text> wasn't on Squaddict yet.
            </Text>
            <Pressable
              onPress={missing.onSend}
              accessibilityRole="button"
              hitSlop={8}
              style={({ pressed }) => pressed && styles.pressed}
            >
              <Text style={styles.missingAction}>Send {missing.name} the night</Text>
            </Pressable>
          </View>
        ) : null}

        {footer}
      </View>
    </View>
  );
}

function Shot({
  uri,
  style,
  onError,
  children,
}: {
  uri?: string;
  style: StyleProp<ViewStyle>;
  onError?: () => void;
  children?: ReactNode;
}) {
  return (
    <View style={[styles.shot, style]}>
      {uri ? <Image source={{ uri }} style={styles.fill} resizeMode="cover" onError={onError} /> : null}
      {children}
    </View>
  );
}

// The tear line between the night and its stub, with a notch cut on each side.
function Perforation() {
  return (
    <View style={styles.perf}>
      <View style={styles.dashes}>
        {Array.from({ length: DASHES }, (_, i) => (
          <View key={i} style={styles.dash} />
        ))}
      </View>
      <View style={[styles.notch, styles.notchLeft]} />
      <View style={[styles.notch, styles.notchRight]} />
    </View>
  );
}

// Why a night from outside your parea is in your feed, in a few words.
export function whyLabel(reason: FeedReason, via: string | null): string | null {
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

const styles = StyleSheet.create({
  pressed: { opacity: 0.7 },
  fill: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },

  card: {
    marginHorizontal: space.md,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    overflow: 'hidden',
    ...shadow.card,
  },

  // Up to three photos: the newest big, two beside it.
  shots: { flexDirection: 'row', gap: 3, height: SHOTS_HEIGHT },
  shot: { backgroundColor: colors.surfaceAlt, overflow: 'hidden' },
  shotMain: { flex: 2 },
  side: { flex: 1, gap: 3 },
  shotSide: { flex: 1 },
  moreShade: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(12,25,38,0.45)',
  },
  moreText: { color: '#FFFFFF', ...typo.display, fontSize: textSize.lead },
  newTag: {
    position: 'absolute',
    top: 10,
    left: 10,
    overflow: 'hidden',
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    color: '#FFFFFF',
    ...typo.mono,
    fontSize: textSize.micro,
    letterSpacing: 1.2,
  },
  burstWrap: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },

  body: { paddingHorizontal: 12, paddingTop: 10, paddingBottom: 12, gap: space.xs },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: space.xs },
  title: { flex: 1, color: colors.text, ...typo.display, fontSize: 16, lineHeight: 20 },
  why: {
    maxWidth: 130,
    overflow: 'hidden',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
    backgroundColor: '#E8EDFD',
    color: colors.primary,
    ...typo.bold,
    fontSize: textSize.caption,
  },
  sub: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', maxWidth: '100%' },
  subAvatar: { borderRadius: 6 },
  subText: { flexShrink: 1, color: colors.textSoft, ...typo.semi, fontSize: textSize.small },

  perf: { height: NOTCH, justifyContent: 'center' },
  notch: { position: 'absolute', top: 0, width: NOTCH, height: NOTCH, borderRadius: NOTCH / 2, backgroundColor: colors.bg },
  notchLeft: { left: -NOTCH / 2 },
  notchRight: { right: -NOTCH / 2 },
  dashes: { flexDirection: 'row', gap: 4, marginHorizontal: 14, overflow: 'hidden' },
  dash: { width: 5, height: 2, borderRadius: 1, backgroundColor: colors.border },

  // The stub: the reactions, sharing, and who gave them.
  reacts: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    height: 32,
    paddingHorizontal: 10,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  pillRound: { width: 32, paddingHorizontal: 0 },
  pillMine: { borderWidth: 1.5, borderColor: colors.danger, backgroundColor: tint.danger },
  pillPressed: { transform: [{ scale: 0.94 }] },
  count: { color: colors.text, ...typo.bold, fontSize: textSize.small },
  countMine: { color: '#B23624', ...typo.display },
  share: {
    marginLeft: 'auto',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    height: 32,
    paddingHorizontal: 10,
    borderRadius: radius.pill,
    backgroundColor: colors.ink,
  },
  shareText: { color: colors.onInk, ...typo.bold, fontSize: textSize.small },
  text: { color: colors.textSoft, ...typo.medium, fontSize: textSize.small },
  strong: { color: colors.text, ...typo.display },

  missing: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    marginTop: 2,
    paddingVertical: 9,
    paddingHorizontal: 10,
    borderRadius: radius.sm,
    backgroundColor: colors.bg,
  },
  missingText: { flex: 1, color: colors.textSoft, ...typo.semi, fontSize: textSize.small },
  missingAction: { color: colors.primary, ...typo.display, fontSize: textSize.small },
});
