import type { ReactNode } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
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
}: {
  item: FeedPhoto;
  url?: string;
  reactions: number;
  onPlanAgain: () => void;
}) {
  const weekday = weekdayOf(item.event.date);

  return (
    <View style={styles.card}>
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
      {children}
    </View>
  );
}

// "One year ago" (or a month): a night that comes back on its day.
export function ThrowbackCard({
  item,
  url,
  ago,
  onOpen,
}: {
  item: FeedPhoto;
  url?: string;
  ago: string;
  onOpen: () => void;
}) {
  return (
    <Pressable
      onPress={onOpen}
      accessibilityRole="button"
      accessibilityLabel={`${ago}: ${item.event.title}. Open the night`}
      style={({ pressed }) => [styles.throwback, pressed && styles.pressed]}
    >
      {url ? <Image source={{ uri: url }} style={styles.fill} resizeMode="cover" /> : null}
      <View style={styles.shade} />
      <View style={styles.throwbackText}>
        <Text style={styles.throwbackKicker}>{ago.toUpperCase()}</Text>
        <Text style={styles.throwbackTitle} numberOfLines={2}>
          {item.event.title}
        </Text>
        <Text style={styles.throwbackBody} numberOfLines={1}>
          {item.group.name} · tap to see the night again
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

  throwback: {
    marginHorizontal: space.md,
    height: 190,
    borderRadius: radius.xl,
    overflow: 'hidden',
    justifyContent: 'flex-end',
    backgroundColor: colors.inkStrong,
  },
  shade: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: 'rgba(12,25,38,0.45)' },
  throwbackText: { padding: space.md, gap: 2 },
  throwbackKicker: { color: '#FFFFFF', ...typo.mono, fontSize: textSize.caption, letterSpacing: 1.4 },
  throwbackTitle: { color: '#FFFFFF', ...typo.display, fontSize: textSize.heading, letterSpacing: -0.4 },
  throwbackBody: { color: 'rgba(255,255,255,0.85)', ...typo.medium, fontSize: textSize.body },
});
