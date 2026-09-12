import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { GroupPreview } from '../../services/serviceChat';
import { paper, radius, space, typo } from '../../theme';
import { GroupMonogram } from './GroupPicker';

export const PAIR_LEAD = 52;

export type PairThread = {
  pairGroupId: string;
  otherName: string;
  joined: boolean;
  unread?: number;
  preview?: GroupPreview | null;
};

type PairThreadRowProps = {
  mine: string;
  other: string;
  preview?: GroupPreview | null;
  unread?: number;
  joined?: boolean;
  stamp?: string;
  divided?: boolean;
  onPress: () => void;
  onJoin?: () => void;
};

export default function PairThreadRow({
  mine,
  other,
  preview,
  unread = 0,
  joined = true,
  stamp,
  divided = false,
  onPress,
  onJoin,
}: PairThreadRowProps) {
  const badge = unread > 0 ? (unread > 99 ? '99+' : String(unread)) : null;

  let line = joined ? 'No messages yet' : 'Tap join to read along';
  if (joined && preview) {
    line = preview.senderName ? `${preview.senderName}: ${preview.content}` : preview.content;
  }

  const label = badge
    ? `Open thread with ${other}, ${badge} unread`
    : `Open thread with ${other}`;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      {divided ? <View style={styles.divider} /> : null}

      <View style={styles.pair}>
        <GroupMonogram name={mine} size={30} />
        <View style={styles.second}>
          <GroupMonogram name={other} size={30} />
        </View>
      </View>

      <View style={styles.text}>
        <Text style={styles.name} numberOfLines={1}>
          {other}
        </Text>
        <Text style={badge ? [styles.preview, styles.previewUnread] : styles.preview} numberOfLines={1}>
          {line}
        </Text>
      </View>

      {joined ? (
        <View style={styles.end}>
          {stamp ? (
            <Text style={badge ? [styles.stamp, styles.stampUnread] : styles.stamp}>{stamp}</Text>
          ) : null}

          {badge ? (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{badge}</Text>
            </View>
          ) : (
            <Ionicons name="chevron-forward" size={16} color={paper.inkFaint} />
          )}
        </View>
      ) : (
        <Pressable
          onPress={onJoin}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={`Join the thread with ${other}`}
          style={({ pressed }) => [styles.join, pressed && styles.pressed]}
        >
          <Text style={styles.joinText}>Join</Text>
        </Pressable>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingHorizontal: space.md,
    paddingVertical: 11,
    position: 'relative',
  },
  pressed: { opacity: 0.7 },
  divider: {
    position: 'absolute',
    top: 0,
    left: space.md + PAIR_LEAD + space.sm,
    right: 0,
    height: 1,
    backgroundColor: paper.lineSoft,
  },

  pair: { width: PAIR_LEAD, height: 30, flexDirection: 'row' },
  second: { marginLeft: -8 },

  text: { flex: 1 },
  name: { color: paper.ink, ...typo.semi, fontSize: 15 },
  preview: { marginTop: 2, color: paper.inkSoft, ...typo.regular, fontSize: 13 },
  previewUnread: { color: paper.ink, ...typo.medium },

  end: { alignItems: 'flex-end', gap: 4 },
  stamp: { color: paper.inkFaint, ...typo.mono, fontSize: 10.5 },
  stampUnread: { color: paper.accent, ...typo.medium },
  badge: {
    minWidth: 20,
    height: 20,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    backgroundColor: paper.accent,
  },
  badgeText: { color: '#FFFFFF', ...typo.semi, fontSize: 11 },

  join: {
    height: 30,
    paddingHorizontal: 14,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: paper.accentSoft,
  },
  joinText: { color: paper.accent, ...typo.semi, fontSize: 13.5 },
});
