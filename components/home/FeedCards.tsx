import type { ReactNode } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Image, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import type { FeedPhoto } from '../../services/servicePhotoFeed';
import { parseDateKey } from '../../lib/datetime';
import { colors, radius, shadow, space, textSize, typo } from '../../theme';

// Small cards between the memories, each nudging the next turn of the loop:
// go again, answer a plan, remember a night.

// "Again?": a night of yours that went well, one tap from a new plan like it.
export function AgainCard({
  item,
  url,
  reactions,
  onPlanAgain,
  style,
}: {
  item: FeedPhoto;
  url?: string;
  reactions: number;
  onPlanAgain: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  const weekday = weekdayOf(item.event.date);

  return (
    <View style={[styles.card, style]}>
      <View style={styles.againRow}>
        <View style={styles.thumb}>
          {url ? <Image source={{ uri: url }} style={styles.fill} resizeMode="cover" /> : null}
        </View>
        <View style={styles.againText}>
          <Text style={styles.kicker}>WORTH REPEATING</Text>
          <Text style={styles.title} numberOfLines={2}>
            {item.event.title}
          </Text>
          <Text style={styles.body} numberOfLines={2}>
            {reactions} reactions. Same place{weekday ? `, next ${weekday}` : ''}?
          </Text>
        </View>
      </View>
      <Pressable
        onPress={onPlanAgain}
        accessibilityRole="button"
        accessibilityLabel={`Plan ${item.event.title} again`}
        style={({ pressed }) => [styles.action, pressed && styles.pressed]}
      >
        <Ionicons name="repeat" size={17} color={colors.onInk} />
        <Text style={styles.actionText}>Plan it again</Text>
      </Pressable>
    </View>
  );
}

// A plan still waiting on your answer, answered right here.
export function AnswerCard({ children }: { children: ReactNode }) {
  return (
    <View style={styles.answer}>
      <View style={styles.answerHead}>
        <View style={styles.answerDot} />
        <Text style={styles.answerTitle}>Waiting on you</Text>
      </View>
      <View style={styles.answerTicket}>{children}</View>
    </View>
  );
}

// "One month ago today": a night that comes back on its day, as a small
// dashed memo on the line.
export function ThrowbackCard({
  item,
  url,
  ago,
  fires,
  onOpen,
  style,
}: {
  item: FeedPhoto;
  url?: string;
  ago: string;
  fires: number;
  onOpen: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Pressable
      onPress={onOpen}
      accessibilityRole="button"
      accessibilityLabel={`${ago}: ${item.event.title}. Open the night`}
      style={({ pressed }) => [styles.memo, style, pressed && styles.pressed]}
    >
      <View style={styles.memoPhoto}>
        {url ? <Image source={{ uri: url }} style={styles.fill} resizeMode="cover" /> : null}
      </View>
      <View style={styles.memoText}>
        <Text style={styles.kicker}>{ago.toUpperCase()}</Text>
        <Text style={styles.memoTitle} numberOfLines={2}>
          {item.event.title}
        </Text>
        <Text style={styles.body} numberOfLines={1}>
          {fires > 0 ? `${fires} ${fires === 1 ? 'fire' : 'fires'} · ` : ''}see it again
        </Text>
      </View>
    </Pressable>
  );
}

function weekdayOf(dateStr: string): string {
  const d = parseDateKey(dateStr);
  return d ? d.toLocaleDateString('en-US', { weekday: 'long' }) : '';
}

const styles = StyleSheet.create({
  fill: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
  pressed: { transform: [{ scale: 0.98 }] },

  card: {
    marginHorizontal: space.md,
    padding: 14,
    gap: space.sm,
    borderRadius: radius.xl,
    backgroundColor: colors.surface,
    ...shadow.card,
  },
  againRow: { flexDirection: 'row', gap: space.sm, alignItems: 'center' },
  thumb: {
    width: 64,
    height: 80,
    borderRadius: radius.md,
    overflow: 'hidden',
    backgroundColor: colors.surfaceAlt,
  },
  againText: { flex: 1, minWidth: 0, gap: 2 },
  kicker: { color: colors.primary, ...typo.mono, fontSize: textSize.micro, letterSpacing: 1.4 },
  title: { color: colors.text, ...typo.display, fontSize: textSize.lead, letterSpacing: -0.2 },
  body: { color: colors.textSoft, ...typo.medium, fontSize: textSize.body },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minHeight: 44,
    borderRadius: radius.md,
    backgroundColor: colors.ink,
  },
  actionText: { color: colors.onInk, ...typo.semi, fontSize: textSize.base },

  answer: { gap: space.xs },
  answerHead: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: space.lg },
  answerDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.danger },
  answerTitle: { color: colors.text, ...typo.title, fontSize: textSize.lead, letterSpacing: -0.2 },
  // Same width as the memory tickets around it.
  answerTicket: { marginHorizontal: space.md },

  memo: {
    marginHorizontal: space.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    padding: 12,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: '#B9C6F3',
    backgroundColor: 'rgba(232,237,253,0.6)',
  },
  memoPhoto: { width: 56, height: 70, borderRadius: radius.sm, overflow: 'hidden', backgroundColor: colors.surfaceAlt },
  memoText: { flex: 1, minWidth: 0, gap: 2 },
  memoTitle: { color: colors.text, ...typo.display, fontSize: textSize.base },
});
