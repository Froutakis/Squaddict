import { useEffect, useRef, useState, type ComponentProps, type ReactNode } from 'react';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Animated, Modal, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { Group } from '../../services/serviceGroup';
import Monogram from '../general/Monogram';
import Glass from '../general/Glass';
import { colors, radius, space, sun, textSize, typo } from '../../theme';
import { features } from '../../lib/features';

const RAIL = 68;
const RAIL_RADIUS = 28;
const RAIL_LEFT = 8;
const BUTTON = 48;
const TOOL_RADIUS = 16;
const SQUAD = 44;
const GAP = 8;
const MAX_SQUADS = 3;
const SQUADS_HEIGHT = MAX_SQUADS * BUTTON + (MAX_SQUADS - 1) * GAP;
const SLIDE_MS = 200;
const LABEL_MS = 1600;
// iOS can't present a sheet while the rail is still sliding away.
export const RAIL_CLOSE_MS = 260;
const LABEL_HEIGHT = 34;
const LABEL_LEFT = RAIL_LEFT + RAIL + 10;
const TIP_KEY = 'squaddict.railTipSeen';

type IconName = ComponentProps<typeof Ionicons>['name'];

type Label = { key: string; text: string; extra?: string; y: number };

type Tool = {
  key: string;
  label: string;
  icon: IconName;
  // The filled icon, for the screen you are on.
  iconOn?: IconName;
  badge?: number;
  // The one action worth a colour: making a plan.
  primary?: boolean;
  // A small sun dot for what is on its way.
  soon?: boolean;
  onPress?: () => void;
};

type PareaSidebarProps = {
  visible: boolean;
  squads: Group[];
  activeId: string | null;
  unread: Record<string, number>;
  me: { name: string; avatarUrl: string | null };
  // The screen you are on, marked in the rail.
  current: 'home' | 'events' | 'explore' | 'you';
  onSelectSquad: (id: string) => void;
  onNewSquad: () => void;
  onChat: () => void;
  onPlan: () => void;
  onEvents: () => void;
  onHome: () => void;
  onCalendar: () => void;
  onExplore: () => void;
  onYou: () => void;
  onClose: () => void;
};

// The side rail, the app's only menu: a floating column of icons down the left
// edge. Your pareas on top; then the screens (Memories, Plans, Explore), with
// the one you are on marked; then the tools of the current parea; you at the
// bottom. Hold any icon to see what it is.
export default function PareaSidebar({
  visible,
  squads,
  activeId,
  unread,
  me,
  current,
  onSelectSquad,
  onNewSquad,
  onChat,
  onPlan,
  onEvents,
  onHome,
  onCalendar,
  onExplore,
  onYou,
  onClose,
}: PareaSidebarProps) {
  const slide = useRef(new Animated.Value(0)).current;
  // Stays mounted while it slides out, then unmounts.
  const [mounted, setMounted] = useState(visible);
  const [label, setLabel] = useState<Label | null>(null);
  const [tipSeen, setTipSeen] = useState(true);
  const labelTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (visible) setMounted(true);
    else setLabel(null);
    Animated.timing(slide, {
      toValue: visible ? 1 : 0,
      duration: SLIDE_MS,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished && !visible) setMounted(false);
    });
  }, [visible, slide]);

  useEffect(() => {
    AsyncStorage.getItem(TIP_KEY)
      .then((value) => setTipSeen(value === '1'))
      .catch(() => setTipSeen(true));
  }, []);

  useEffect(() => () => {
    if (labelTimer.current) clearTimeout(labelTimer.current);
  }, []);

  if (!mounted) return null;

  function showLabel(next: Label) {
    if (labelTimer.current) clearTimeout(labelTimer.current);
    setLabel(next);
    labelTimer.current = setTimeout(() => setLabel(null), LABEL_MS);

    // Once you have found the labels, the tip has done its job.
    if (!tipSeen) {
      setTipSeen(true);
      AsyncStorage.setItem(TIP_KEY, '1').catch(() => {});
    }
  }

  const active = squads.find((squad) => squad.id === activeId);
  // The current parea goes first, so it is always one of the three in view.
  const ordered = active ? [active, ...squads.filter((squad) => squad.id !== active.id)] : squads;
  const chatUnread = activeId ? unread[activeId] ?? 0 : 0;
  // Where you go: one of these is always the screen you are on.
  const screens: Tool[] = [
    { key: 'home', label: 'Memories', icon: 'images-outline', iconOn: 'images', onPress: onHome },
    { key: 'events', label: 'Plans', icon: 'ticket-outline', iconOn: 'ticket', onPress: onEvents },
    ...(features.explore
      ? [{ key: 'explore', label: 'Explore', icon: 'map-outline' as IconName, iconOn: 'map' as IconName, onPress: onExplore }]
      : []),
  ];
  // What you do in the current parea.
  const tools: Tool[] = [
    { key: 'plan', label: 'New plan', icon: 'add', primary: true, onPress: onPlan },
    { key: 'chat', label: 'Chat', icon: 'chatbubble-outline', badge: chatUnread, onPress: onChat },
    { key: 'calendar', label: 'Calendar', icon: 'calendar-outline', onPress: onCalendar },
    ...(features.voice ? [{ key: 'voice', label: 'Voice', icon: 'mic-outline' as IconName, soon: true }] : []),
  ];

  function renderTool(tool: Tool) {
    const here = tool.key === current;
    const held = label?.key === tool.key && !here;
    const soonLabel = `${tool.label} · coming soon`;
    return (
      <RailButton
        key={tool.key}
        labelKey={tool.key}
        label={tool.soon ? soonLabel : active && tool.key === 'chat' ? `${tool.label} · ${active.name}` : tool.label}
        extra={tool.badge ? `${tool.badge} new` : undefined}
        onPress={tool.onPress}
        tapShowsLabel={tool.soon}
        onHold={showLabel}
        accessibilityState={here ? { selected: true } : undefined}
        accessibilityLabel={`${tool.label}${here ? ', you are here' : ''}${tool.soon ? ', coming soon' : ''}${tool.badge ? `, ${tool.badge} unread` : ''}`}
      >
        {here ? <View style={styles.current} /> : null}
        <View style={[styles.tool, tool.primary && styles.toolPrimary, here && styles.toolHere, held && styles.toolHeld]}>
          <Ionicons
            name={here && tool.iconOn ? tool.iconOn : tool.icon}
            size={22}
            color={tool.primary ? colors.onInk : here ? colors.ink : colors.text}
          />
        </View>
        {tool.badge ? <Badge count={tool.badge} style={styles.toolBadge} /> : null}
        {tool.soon ? <View style={styles.soonDot} /> : null}
      </RailButton>
    );
  }

  const translateX = slide.interpolate({ inputRange: [0, 1], outputRange: [-(RAIL + space.md), 0] });

  return (
    <Modal visible transparent animationType="none" onRequestClose={onClose}>
      <Animated.View style={[styles.scrim, { opacity: slide }]}>
        <Pressable style={styles.fill} onPress={onClose} accessibilityLabel="Close the side rail" />
      </Animated.View>

      <SafeAreaView style={styles.safe} pointerEvents="box-none">
        <Animated.View style={[styles.rail, { transform: [{ translateX }] }]}>
          <Glass radius={RAIL_RADIUS} sheen="rgba(255,255,255,0.82)" style={styles.glass}>
            {/* Up to three pareas show; the rest scroll inside this box. */}
            <ScrollView
              style={styles.squadList}
              contentContainerStyle={styles.squads}
              showsVerticalScrollIndicator={false}
            >
              {ordered.map((squad) => {
                const isActive = squad.id === activeId;
                const count = unread[squad.id] ?? 0;
                return (
                  <RailButton
                    key={squad.id}
                    labelKey={squad.id}
                    label={squad.name}
                    onPress={() => onSelectSquad(squad.id)}
                    onHold={showLabel}
                    accessibilityState={{ selected: isActive }}
                    accessibilityLabel={`${squad.name}${isActive ? ', current parea' : ''}${count > 0 ? `, ${count} unread` : ''}`}
                  >
                    {isActive ? (
                      <>
                        <View style={styles.current} />
                        <Monogram
                          name={squad.name}
                          uri={squad.avatarUrl}
                          size={SQUAD + 2}
                          ring={2}
                          ringColor={colors.ink}
                          style={styles.squadSquare}
                        />
                      </>
                    ) : (
                      <Monogram name={squad.name} uri={squad.avatarUrl} size={SQUAD} />
                    )}
                    {count > 0 && !isActive ? <Badge count={count} style={styles.squadBadge} /> : null}
                  </RailButton>
                );
              })}
            </ScrollView>

            {/* A hint that more pareas are below. */}
            {squads.length > MAX_SQUADS ? (
              <Ionicons name="chevron-down" size={14} color={colors.textSoft} style={styles.more} />
            ) : null}

            <RailButton
              labelKey="new-squad"
              label="New parea"
              onPress={onNewSquad}
              onHold={showLabel}
              accessibilityLabel="New parea or join with a code"
            >
              <View style={styles.add}>
                <Ionicons name="add" size={18} color={colors.textSoft} />
              </View>
            </RailButton>

            <View style={styles.sep} />
            {screens.map(renderTool)}

            <View style={styles.sep} />
            {tools.map(renderTool)}

            <View style={styles.spacer} />
            <View style={styles.sep} />

            <RailButton labelKey="you" label="You" onPress={onYou} onHold={showLabel} accessibilityLabel="You, settings and your nights">
              <View style={styles.me}>
                <Monogram name={me.name || 'You'} uri={me.avatarUrl} size={SQUAD - 4} ring={2} />
              </View>
            </RailButton>
          </Glass>
        </Animated.View>

        {!tipSeen ? (
          <Animated.View style={[styles.tip, { opacity: slide }]} pointerEvents="none">
            <Text style={styles.tipCaption}>TIP</Text>
            <Text style={styles.tipText}>Hold any icon to see its name. Tap outside to close.</Text>
          </Animated.View>
        ) : null}
      </SafeAreaView>

      {label ? (
        <View style={[styles.label, { top: label.y + (BUTTON - LABEL_HEIGHT) / 2 }]} pointerEvents="none">
          <Text style={styles.labelText} numberOfLines={1}>
            {label.text}
          </Text>
          {label.extra ? <Text style={styles.labelExtra}>{label.extra}</Text> : null}
        </View>
      ) : null}
    </Modal>
  );
}

function Badge({ count, style }: { count: number; style: object }) {
  return (
    <View style={[styles.badge, style]}>
      <Text style={styles.badgeText}>{count > 99 ? '99+' : count}</Text>
    </View>
  );
}

type RailButtonProps = {
  labelKey: string;
  label: string;
  extra?: string;
  children: ReactNode;
  onPress?: () => void;
  // For a button that answers a tap with its label (things not built yet).
  tapShowsLabel?: boolean;
  onHold: (label: Label) => void;
  accessibilityLabel: string;
  accessibilityState?: { selected?: boolean };
};

function RailButton({
  labelKey,
  label,
  extra,
  children,
  onPress,
  tapShowsLabel,
  onHold,
  accessibilityLabel,
  accessibilityState,
}: RailButtonProps) {
  const ref = useRef<View>(null);

  // Measured on the screen, so the label lines up wherever the button sits.
  function hold() {
    ref.current?.measureInWindow((_x, y) => onHold({ key: labelKey, text: label, extra, y }));
  }

  return (
    <Pressable
      ref={ref}
      onPress={() => (tapShowsLabel ? hold() : onPress?.())}
      onLongPress={hold}
      delayLongPress={300}
      // On the web a mouse can just point at an icon to see its name.
      onHoverIn={hold}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={accessibilityState}
      style={({ pressed }) => [styles.button, pressed && styles.pressed]}
    >
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  scrim: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: 'rgba(12,25,38,0.38)' },
  safe: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
  // A fixed column down the whole left edge, whatever is in it.
  rail: {
    position: 'absolute',
    top: space.sm,
    bottom: space.sm,
    left: RAIL_LEFT,
    width: RAIL,
    marginTop: space.sm,
    marginBottom: space.sm,
  },
  glass: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    gap: GAP,
    borderColor: 'rgba(255,255,255,0.9)',
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.22,
    shadowRadius: 40,
  },
  button: { width: BUTTON, height: BUTTON, alignItems: 'center', justifyContent: 'center' },
  // A press sinks the button a little, like a real key.
  pressed: { transform: [{ scale: 0.9 }] },
  // As wide as the rail, so the current-parea bar at its edge is not cut off.
  squadList: { width: RAIL, maxHeight: SQUADS_HEIGHT, flexGrow: 0 },
  squads: { alignItems: 'center', gap: GAP },
  // The bar that marks the parea and the screen you are on, against the rail's edge.
  current: {
    position: 'absolute',
    left: -(RAIL - BUTTON) / 2,
    top: 10,
    width: 4,
    height: 28,
    borderTopRightRadius: 4,
    borderBottomRightRadius: 4,
    backgroundColor: colors.ink,
  },
  squadSquare: { borderRadius: 15 },
  squadBadge: { right: -2, bottom: -2 },
  more: { marginTop: -2 },
  add: {
    width: SQUAD,
    height: SQUAD,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: colors.borderStrong,
  },
  sep: { width: 32, height: 2, borderRadius: radius.pill, backgroundColor: colors.border, marginVertical: 4 },
  tool: {
    width: BUTTON,
    height: BUTTON,
    borderRadius: TOOL_RADIUS,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toolPrimary: {
    backgroundColor: colors.primary,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 6,
  },
  // The screen you are on: a soft fill and the filled icon.
  toolHere: { backgroundColor: colors.surfaceAlt },
  // The icon whose label is showing.
  toolHeld: { backgroundColor: 'rgba(12,25,38,0.06)' },
  toolBadge: { right: -3, top: -3 },
  soonDot: {
    position: 'absolute',
    right: 9,
    top: 9,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: sun,
    borderWidth: 2,
    borderColor: colors.surface,
  },
  badge: {
    position: 'absolute',
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.danger,
    borderWidth: 2,
    borderColor: colors.surface,
  },
  badgeText: { color: '#FFFFFF', ...typo.display, fontSize: 10 },
  spacer: { flex: 1 },
  // You: a white ring inside a blue one.
  me: { borderRadius: radius.pill, borderWidth: 2, borderColor: colors.primary },
  label: {
    position: 'absolute',
    left: LABEL_LEFT,
    height: LABEL_HEIGHT,
    maxWidth: 260,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: colors.ink,
    shadowColor: colors.ink,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 18,
    elevation: 8,
  },
  labelText: { color: colors.onInk, ...typo.bold, fontSize: textSize.body, flexShrink: 1 },
  labelExtra: { color: colors.borderStrong, ...typo.mono, fontSize: textSize.caption },
  tip: {
    position: 'absolute',
    left: LABEL_LEFT + 10,
    right: space.md,
    bottom: space.lg + 2,
    gap: 4,
    paddingVertical: 14,
    paddingHorizontal: space.md,
    borderRadius: 20,
    backgroundColor: colors.surface,
    shadowColor: colors.ink,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.2,
    shadowRadius: 30,
    elevation: 10,
  },
  tipCaption: { color: colors.primary, ...typo.mono, fontSize: textSize.micro, letterSpacing: 1.2 },
  tipText: { color: colors.text, ...typo.semi, fontSize: textSize.body, lineHeight: 18 },
});
