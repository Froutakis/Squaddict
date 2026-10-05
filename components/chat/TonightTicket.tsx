import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { brand, colors, radius, space, textSize, typo } from '../../theme';

const DASHES = 14;

type TonightTicketProps = {
  kicker: string;
  title: string;
  line: string;
  // A red dot in front of the kicker: the plan is today.
  live?: boolean;
  compact?: boolean;
  actionLabel: string;
  actionIcon: keyof typeof Ionicons.glyphMap;
  onAction: () => void;
  onOpen?: () => void;
};

// Tonight's plan on one small sideways ticket: what and when on the left, the
// one thing to do about it on the stub (On my way).
export default function TonightTicket({
  kicker,
  title,
  line,
  live = false,
  compact = false,
  actionLabel,
  actionIcon,
  onAction,
  onOpen,
}: TonightTicketProps) {
  return (
    <View style={styles.ticket}>
      <Pressable
        onPress={onOpen}
        disabled={!onOpen}
        accessibilityRole={onOpen ? 'button' : undefined}
        accessibilityLabel={`${title}. ${kicker}. ${line}${onOpen ? '. Open the plan' : ''}`}
        style={({ pressed }) => [styles.main, compact && styles.mainCompact, pressed && styles.pressed]}
      >
        <View style={styles.kickerRow}>
          {live ? <View style={styles.dot} /> : null}
          <Text style={styles.kicker} numberOfLines={1}>
            {kicker}
          </Text>
        </View>
        <Text style={[styles.title, compact && styles.titleCompact]} numberOfLines={1}>
          {title}
        </Text>
        {line ? (
          <Text style={styles.line} numberOfLines={1}>
            {line}
          </Text>
        ) : null}
      </Pressable>

      <View style={styles.perf} pointerEvents="none">
        <View style={[styles.notch, styles.notchTop]} />
        <View style={styles.dashes}>
          {Array.from({ length: DASHES }, (_, i) => (
            <View key={i} style={styles.dash} />
          ))}
        </View>
        <View style={[styles.notch, styles.notchBottom]} />
      </View>

      <View style={styles.stub}>
        <Pressable
          onPress={onAction}
          accessibilityRole="button"
          accessibilityLabel={actionLabel}
          hitSlop={4}
          style={({ pressed }) => [styles.action, pressed && styles.actionPressed]}
        >
          <Ionicons name={actionIcon} size={15} color={brand[0]} />
          <Text style={styles.actionText} numberOfLines={1}>
            {actionLabel}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  ticket: {
    flexDirection: 'row',
    borderRadius: radius.lg,
    backgroundColor: brand[0],
    shadowColor: brand[0],
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.22,
    shadowRadius: 14,
    elevation: 5,
  },
  pressed: { opacity: 0.85 },
  main: { flex: 1, minWidth: 0, paddingVertical: 12, paddingLeft: 14, paddingRight: space.sm, gap: 2 },
  mainCompact: { paddingVertical: 9 },
  kickerRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.danger },
  kicker: {
    flexShrink: 1,
    color: 'rgba(255,255,255,0.75)',
    ...typo.mono,
    fontSize: textSize.micro,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  title: { color: colors.onInk, ...typo.display, fontSize: textSize.lead, lineHeight: 19 },
  titleCompact: { fontSize: textSize.base },
  line: { color: 'rgba(255,255,255,0.82)', ...typo.semi, fontSize: textSize.small },

  // The cut between the two halves, with a bite out of the top and bottom.
  // The dashes are as tall as the ticket, not the other way round.
  perf: { width: 2 },
  dashes: { position: 'absolute', top: 10, bottom: 10, left: 0, width: 2, gap: 4, overflow: 'hidden' },
  dash: { width: 2, height: 5, borderRadius: 1, backgroundColor: 'rgba(255,255,255,0.28)' },
  notch: { position: 'absolute', left: -7, width: 16, height: 16, borderRadius: 8, backgroundColor: colors.bg },
  notchTop: { top: -8 },
  notchBottom: { bottom: -8 },

  stub: { width: 124, justifyContent: 'center', paddingHorizontal: 10, paddingVertical: 8 },
  action: {
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingHorizontal: 6,
    borderRadius: radius.sm,
    backgroundColor: colors.surface,
  },
  actionPressed: { transform: [{ scale: 0.95 }] },
  actionText: { color: brand[0], ...typo.display, fontSize: textSize.body },
});
