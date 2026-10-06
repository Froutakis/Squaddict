import { Ionicons } from '@expo/vector-icons';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, space, textSize, typo } from '../../theme';

// About a keyboard's height, so swapping one for the other moves nothing.
export const TRAY_MIN = 260;
export const TRAY_MAX = 300;

export function trayHeight(windowHeight: number): number {
  return Math.round(Math.min(TRAY_MAX, Math.max(TRAY_MIN, windowHeight * 0.36)));
}

export type TrayTonight = {
  title: string;
  // "TONIGHT · 21:30"
  kicker: string;
};

type ChatTrayProps = {
  height: number;
  // Short phones drop the small print to keep everything in view.
  compact?: boolean;
  // Your plan today, when you are in on it. Shown only with onOnMyWay.
  tonight?: TrayTonight | null;
  // You are on your way already: the stub stops it instead.
  sharing?: boolean;
  onOnMyWay?: () => void;
  onOpenTonight?: () => void;
  onCamera: () => void;
  onLibrary: () => void;
  onProposePlan?: () => void;
  onAskParea?: () => void;
  // The rest of what the parea decides, each opening its step of the new-vote
  // sheet ('menu' is the whole list). Follow is left out when follows are off.
  onStartVote?: (step: TrayVoteStep) => void;
  canFollow?: boolean;
};

export type TrayVoteStep = 'follow' | 'invite' | 'remove' | 'menu';

type Tile = {
  key: string;
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  // One short line, never two.
  hint: string;
  onPress: () => void;
};

// What the + opens in place of the keyboard, in two groups: what you send
// (a photo, on my way) and what you put to the parea (every vote it can
// start). The wide tiles are the ones that need the parea. Long-press On my
// way to open tonight's plan.
export default function ChatTray({
  height,
  compact = false,
  tonight = null,
  sharing = false,
  onOnMyWay,
  onOpenTonight,
  onCamera,
  onLibrary,
  onProposePlan,
  onAskParea,
  onStartVote,
  canFollow = true,
}: ChatTrayProps) {
  const votes: Tile[] = [];
  if (onProposePlan) {
    votes.push({ key: 'plan', icon: 'ticket-outline', label: 'New plan', hint: 'Most say yes', onPress: onProposePlan });
  }
  if (onAskParea) {
    votes.push({ key: 'poll', icon: 'stats-chart-outline', label: 'Poll', hint: 'One answer each', onPress: onAskParea });
  }
  if (onStartVote) {
    if (canFollow) {
      votes.push({ key: 'follow', icon: 'people-outline', label: 'Follow a parea', hint: 'Their public plans', onPress: () => onStartVote('follow') });
    }
    votes.push({ key: 'invite', icon: 'person-add-outline', label: 'Invite someone', hint: 'One-time link', onPress: () => onStartVote('invite') });
    votes.push({ key: 'remove', icon: 'person-remove-outline', label: 'Remove someone', hint: 'They see it', onPress: () => onStartVote('remove') });
    votes.push({ key: 'menu', icon: 'ellipsis-horizontal', label: 'More votes', hint: 'Name, photo', onPress: () => onStartVote('menu') });
  }
  // Two big tiles to a row.
  const rows: Tile[][] = [];
  for (let i = 0; i < votes.length; i += 2) rows.push(votes.slice(i, i + 2));
  const onMyWay = tonight && onOnMyWay ? onOnMyWay : null;

  return (
    <View style={[styles.tray, { height }]}>
      <ScrollView
        contentContainerStyle={[styles.inner, compact && styles.innerCompact]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.label}>Send</Text>
        <View style={styles.row}>
          <SmallTile icon="camera-outline" label="Camera" a11y="Take a photo" compact={compact} onPress={onCamera} />
          <SmallTile icon="image-outline" label="Photo" a11y="Choose a photo from your library" compact={compact} onPress={onLibrary} />
          {onMyWay && tonight ? (
            <BigTile
              tile={{
                key: 'way',
                icon: sharing ? 'stop-circle-outline' : 'navigate-outline',
                label: sharing ? 'Stop sharing' : 'On my way',
                hint: tonight.title,
                onPress: onMyWay,
              }}
              compact={compact}
              onLongPress={onOpenTonight}
            />
          ) : (
            <View style={styles.gapBig} />
          )}
        </View>

        {votes.length > 0 ? <Text style={[styles.label, styles.labelNext]}>Put to the parea</Text> : null}
        {rows.map((row, r) => (
          <View key={r} style={styles.row}>
            {row.map((tile) => (
              <BigTile key={tile.key} tile={tile} compact={compact} />
            ))}
            {/* A short last row keeps the same widths. */}
            {row.length === 1 ? <View style={styles.gapBig} /> : null}
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

function SmallTile({
  icon,
  label,
  a11y,
  compact,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  a11y: string;
  compact: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={a11y}
      style={({ pressed }) => [styles.tile, styles.small, compact && styles.tileCompact, pressed && styles.pressed]}
    >
      <View style={styles.icon}>
        <Ionicons name={icon} size={19} color={colors.text} />
      </View>
      <Text style={styles.tileText} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

// A wide tile: icon on the left, the name and one short line beside it.
function BigTile({ tile, compact, onLongPress }: { tile: Tile; compact: boolean; onLongPress?: () => void }) {
  const plan = tile.key === 'plan';
  return (
    <Pressable
      onPress={tile.onPress}
      onLongPress={onLongPress}
      accessibilityRole="button"
      accessibilityLabel={tile.label}
      accessibilityHint={tile.hint}
      style={({ pressed }) => [styles.tile, styles.big, plan && styles.bigPlan, compact && styles.tileCompact, pressed && styles.pressed]}
    >
      <View style={styles.icon}>
        <Ionicons name={tile.icon} size={19} color={plan ? colors.primary : colors.text} />
      </View>
      <View style={styles.bigText}>
        <Text style={styles.tileText} numberOfLines={1}>
          {tile.label}
        </Text>
        <Text style={styles.hint} numberOfLines={1}>
          {tile.hint}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // It takes the keyboard's place under the composer, one white panel with it.
  tray: { backgroundColor: colors.surface },
  inner: { paddingHorizontal: space.md, paddingTop: space.md, paddingBottom: space.sm + 4, gap: 8 },
  innerCompact: { paddingTop: space.sm, gap: 6 },
  pressed: { transform: [{ scale: 0.97 }] },

  label: { color: colors.textFaint, ...typo.medium, fontSize: 12.5, marginHorizontal: 2 },
  labelNext: { marginTop: 6 },
  row: { flexDirection: 'row', gap: 8 },
  tile: { height: 78, borderRadius: 16, backgroundColor: colors.bg },
  tileCompact: { height: 64 },
  small: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 6 },
  big: { flex: 2, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14 },
  bigPlan: { backgroundColor: colors.accentSoft },
  gapBig: { flex: 2 },
  icon: { width: 36, height: 36, flexShrink: 0, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface },
  bigText: { flex: 1, minWidth: 0 },
  tileText: { color: colors.text, ...typo.semi, fontSize: textSize.small },
  hint: { color: colors.textFaint, ...typo.medium, fontSize: 11.5 },
});
