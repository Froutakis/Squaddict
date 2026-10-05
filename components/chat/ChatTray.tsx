import { Ionicons } from '@expo/vector-icons';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, paper, radius, shadow, space, sun, textSize, tint, typo } from '../../theme';
import TonightTicket from './TonightTicket';

// About a keyboard's height, so swapping one for the other moves nothing.
export const TRAY_MIN = 260;
export const TRAY_MAX = 300;

export function trayHeight(windowHeight: number): number {
  return Math.round(Math.min(TRAY_MAX, Math.max(TRAY_MIN, windowHeight * 0.36)));
}

const DASHES = 40;

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
  // Left out when Explore is switched off: there is nothing to suggest from.
  onSuggestPlan?: () => void;
};

type Stub = {
  key: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  label: string;
  hint: string;
  onPress: () => void;
};

// What the + opens in place of the keyboard: tonight's plan, a photo, and the
// three things to put to the parea.
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
  onSuggestPlan,
}: ChatTrayProps) {
  const stubs: Stub[] = [];
  if (onProposePlan) {
    stubs.push({ key: 'plan', icon: 'ticket', color: colors.primary, label: 'Propose a plan', hint: 'Goes to a vote', onPress: onProposePlan });
  }
  if (onAskParea) {
    stubs.push({ key: 'poll', icon: 'help-circle', color: sun, label: 'Ask the parea', hint: '2 to 4 choices', onPress: onAskParea });
  }
  if (onSuggestPlan) {
    stubs.push({ key: 'suggest', icon: 'compass', color: colors.success, label: 'Suggest a plan', hint: 'From Explore', onPress: onSuggestPlan });
  }

  return (
    <View style={[styles.tray, { height }]}>
      <ScrollView
        contentContainerStyle={[styles.inner, compact && styles.innerCompact]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {tonight && onOnMyWay ? (
          <TonightTicket
            kicker={tonight.kicker}
            title={tonight.title}
            line={compact ? '' : sharing ? 'Sharing your spot' : "You're in"}
            live
            compact
            actionLabel={sharing ? 'Stop sharing' : 'On my way'}
            actionIcon={sharing ? 'stop-circle-outline' : 'navigate'}
            onAction={onOnMyWay}
            onOpen={onOpenTonight}
          />
        ) : null}

        <Text style={styles.label}>Photos</Text>
        <View style={styles.tiles}>
          <Pressable
            onPress={onCamera}
            accessibilityRole="button"
            accessibilityLabel="Take a photo"
            style={({ pressed }) => [styles.tile, styles.tileInk, compact && styles.tileCompact, pressed && styles.pressed]}
          >
            <Ionicons name="camera" size={22} color={colors.onInk} />
            <Text style={[styles.tileText, styles.tileTextInk]}>Camera</Text>
          </Pressable>
          <Pressable
            onPress={onLibrary}
            accessibilityRole="button"
            accessibilityLabel="Choose a photo from your library"
            style={({ pressed }) => [styles.tile, compact && styles.tileCompact, pressed && styles.pressed]}
          >
            <Ionicons name="images" size={22} color={colors.ink} />
            <Text style={styles.tileText}>Library</Text>
          </Pressable>
        </View>

        {stubs.length > 0 ? (
          <View style={styles.stubs}>
            {stubs.map((stub) => (
              <Pressable
                key={stub.key}
                onPress={stub.onPress}
                accessibilityRole="button"
                accessibilityLabel={stub.label}
                accessibilityHint={stub.hint}
                style={({ pressed }) => [styles.stub, pressed && styles.stubPressed]}
              >
                <View style={[styles.stubTop, compact && styles.stubTopCompact]}>
                  <View style={[styles.stubIcon, { backgroundColor: iconTint(stub.key) }]}>
                    <Ionicons name={stub.icon} size={16} color={stub.key === 'poll' ? colors.ink : stub.color} />
                  </View>
                </View>
                <View style={styles.perf} pointerEvents="none">
                  <View style={styles.dashes}>
                    {Array.from({ length: DASHES }, (_, i) => (
                      <View key={i} style={styles.dash} />
                    ))}
                  </View>
                  <View style={[styles.notch, styles.notchLeft]} />
                  <View style={[styles.notch, styles.notchRight]} />
                </View>
                <View style={[styles.stubBottom, compact && styles.stubBottomCompact]}>
                  <Text style={styles.stubLabel} numberOfLines={2}>
                    {stub.label}
                  </Text>
                  {compact ? null : (
                    <Text style={styles.stubHint} numberOfLines={1}>
                      {stub.hint}
                    </Text>
                  )}
                </View>
              </Pressable>
            ))}
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

function iconTint(key: string): string {
  if (key === 'plan') return paper.accentSoft;
  if (key === 'poll') return tint.sun;
  return tint.success;
}

const styles = StyleSheet.create({
  tray: {
    backgroundColor: colors.bg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  inner: { paddingHorizontal: space.md, paddingTop: space.sm + 2, paddingBottom: space.sm, gap: space.sm },
  innerCompact: { paddingTop: space.sm, gap: space.xs + 2 },
  pressed: { opacity: 0.85 },

  label: {
    color: colors.textSoft,
    ...typo.mono,
    fontSize: textSize.micro,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    marginBottom: -2,
  },
  tiles: { flexDirection: 'row', gap: space.xs + 2 },
  tile: {
    flex: 1,
    height: 64,
    borderRadius: radius.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.xs + 2,
    backgroundColor: colors.surface,
    ...shadow.bubble,
  },
  tileCompact: { height: 56 },
  tileInk: { backgroundColor: colors.ink },
  tileText: { color: colors.ink, ...typo.bold, fontSize: textSize.base },
  tileTextInk: { color: colors.onInk },

  stubs: { flexDirection: 'row', gap: space.xs + 2 },
  stub: {
    flex: 1,
    minWidth: 0,
    borderRadius: radius.md + 2,
    backgroundColor: colors.surface,
    ...shadow.bubble,
  },
  stubPressed: { transform: [{ scale: 0.96 }] },
  stubTop: { height: 38, justifyContent: 'center', paddingHorizontal: 12 },
  stubTopCompact: { height: 34 },
  stubIcon: { width: 26, height: 26, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  perf: { height: 1.5, marginHorizontal: 10, justifyContent: 'center' },
  dashes: { flexDirection: 'row', gap: 3, height: 1.5, overflow: 'hidden' },
  dash: { width: 4, height: 1.5, borderRadius: 1, backgroundColor: colors.borderStrong },
  notch: { position: 'absolute', top: -6, width: 12, height: 12, borderRadius: 6, backgroundColor: colors.bg },
  notchLeft: { left: -16 },
  notchRight: { right: -16 },
  stubBottom: { paddingHorizontal: 12, paddingTop: 7, paddingBottom: 9 },
  stubBottomCompact: { paddingHorizontal: 10, paddingTop: 6, paddingBottom: 8 },
  stubLabel: { color: colors.ink, ...typo.display, fontSize: 13.5, lineHeight: 16, letterSpacing: -0.2 },
  stubHint: {
    marginTop: 3,
    color: colors.textSoft,
    ...typo.mono,
    fontSize: 9,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
});
