import { useEffect, useRef, useState, type ComponentProps, type ReactNode } from 'react';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  Animated,
  Modal,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import type { Group } from '../../services/serviceGroup';
import Monogram from '../general/Monogram';
import Glass from '../general/Glass';
import PlanButton, { PLAN_BUTTON_BOTTOM, PLAN_BUTTON_RIGHT, PLAN_BUTTON_SPACE } from '../general/PlanButton';
import { FAB_BOTTOM } from '../general/MenuFab';
import { colors, radius, space, sun, textSize, typo } from '../../theme';
import { features } from '../../lib/features';

const RAIL = 60;
const RAIL_RADIUS = 30;
const RAIL_LEFT = 10;
const RAIL_PAD = 8;
const BUTTON = 44;
const KEY_RADIUS = 15;
const GAP = 4;
const SLIDE_MS = 200;
const LABEL_MS = 1600;
// iOS can't present a sheet while the rail is still sliding away.
export const RAIL_CLOSE_MS = 260;
const LABEL_HEIGHT = 34;
const LABEL_LEFT = RAIL_LEFT + RAIL + 10;
const TAG_HEIGHT = 30;
const FLYOUT_CELL = 62;
// The first few times the rail opens, every icon has its name beside it.
const WORDS_KEY = 'squaddict.railWordsShown';
const WORDS_OPENS = 3;

type IconName = ComponentProps<typeof Ionicons>['name'];

type Label = { key: string; text: string; extra?: string; y: number };

// Every screen the rail opens. One of them is always where you are.
export type RailScreen = 'home' | 'explore' | 'chat' | 'calendar' | 'votes' | 'you';

type Tool = {
  key: RailScreen | 'voice';
  label: string;
  icon: IconName;
  // The filled icon, for the screen you are on.
  iconOn: IconName;
  badge?: number;
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
  current: RailScreen;
  onSelectSquad: (id: string) => void;
  onNewSquad: () => void;
  onChat: () => void;
  onPlan: () => void;
  onHome: () => void;
  onCalendar: () => void;
  // Open votes in the current squad you have not answered.
  votes?: number;
  onVotes: () => void;
  onExplore: () => void;
  onYou: () => void;
  onClose: () => void;
};

// The side rail, the app's only menu: a short pill of icons, centred down the
// left edge. The current parea on top (the others open beside it); then the
// screens (Home, Explore); then the parea's own pages; you at the
// bottom. The screen you are on is an ink key with its name on a tab. New plan
// is not in the column: it is a plain + bottom-right that comes up with it.
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
  onHome,
  onCalendar,
  votes = 0,
  onVotes,
  onExplore,
  onYou,
  onClose,
}: PareaSidebarProps) {
  const { width: screenWidth } = useWindowDimensions();
  const slide = useRef(new Animated.Value(0)).current;
  const scrollY = useRef(new Animated.Value(0)).current;
  // Stays mounted while it slides out, then unmounts.
  const [mounted, setMounted] = useState(visible);
  const [label, setLabel] = useState<Label | null>(null);
  const [flyout, setFlyout] = useState(false);
  const [words, setWords] = useState(false);
  // Where each button sits in the column, for the tags beside it.
  const [rows, setRows] = useState<Record<string, number>>({});
  const opens = useRef<number | null>(null);
  const labelTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (visible) setMounted(true);
    else {
      setLabel(null);
      setFlyout(false);
    }
    Animated.timing(slide, {
      toValue: visible ? 1 : 0,
      duration: SLIDE_MS,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished && !visible) setMounted(false);
    });
  }, [visible, slide]);

  useEffect(() => {
    AsyncStorage.getItem(WORDS_KEY)
      .then((value) => {
        opens.current = Math.max(Number(value) || 0, opens.current ?? 0);
      })
      .catch(() => {
        opens.current = WORDS_OPENS;
      });
  }, []);

  // Counted per opening; the words stay put until the rail closes.
  useEffect(() => {
    if (!visible) return;
    const seen = opens.current ?? 0;
    setWords(seen < WORDS_OPENS);
    if (seen < WORDS_OPENS) {
      opens.current = seen + 1;
      AsyncStorage.setItem(WORDS_KEY, String(seen + 1)).catch(() => {});
    }
  }, [visible]);

  useEffect(() => () => {
    if (labelTimer.current) clearTimeout(labelTimer.current);
  }, []);

  if (!mounted) return null;

  function showLabel(next: Label) {
    if (labelTimer.current) clearTimeout(labelTimer.current);
    setLabel(next);
    labelTimer.current = setTimeout(() => setLabel(null), LABEL_MS);
  }

  // The words already say what each icon is, so holding adds nothing.
  const onHold = words ? () => {} : showLabel;

  function placeRow(key: string, y: number) {
    setRows((was) => (was[key] === y ? was : { ...was, [key]: y }));
  }

  // Tapping outside, or Android back, closes the pareas first, then the rail.
  function dismiss() {
    if (flyout) setFlyout(false);
    else onClose();
  }

  const active = squads.find((squad) => squad.id === activeId);
  const othersUnread = squads.reduce((sum, squad) => (squad.id === activeId ? sum : sum + (unread[squad.id] ?? 0)), 0);
  const chatUnread = activeId ? unread[activeId] ?? 0 : 0;
  // Where you go: Home (the parea's plans and memories), Explore.
  const screens: Tool[] = [
    { key: 'home', label: 'Home', icon: 'images-outline', iconOn: 'images', onPress: onHome },
    ...(features.explore
      ? [{ key: 'explore' as const, label: 'Explore', icon: 'map-outline' as IconName, iconOn: 'map' as IconName, onPress: onExplore }]
      : []),
  ];
  // The current parea's own pages.
  const tools: Tool[] = [
    { key: 'chat', label: 'Chat', icon: 'chatbubble-outline', iconOn: 'chatbubble', badge: chatUnread, onPress: onChat },
    { key: 'calendar', label: 'Calendar', icon: 'calendar-outline', iconOn: 'calendar', onPress: onCalendar },
    { key: 'votes', label: 'Votes', icon: 'checkbox-outline', iconOn: 'checkbox', badge: votes, onPress: onVotes },
    ...(features.voice
      ? [{ key: 'voice' as const, label: 'Voice', icon: 'mic-outline' as IconName, iconOn: 'mic' as IconName, soon: true }]
      : []),
  ];

  // The names that sit beside the column: the screen you are on always, the
  // others only while the words are showing.
  const names: Record<string, string> = { you: 'You' };
  for (const tool of [...screens, ...tools]) names[tool.key] = tool.soon ? `${tool.label} · soon` : tool.label;
  if (active) names.parea = active.name;

  function renderTool(tool: Tool) {
    const here = tool.key === current;
    const held = label?.key === tool.key && !here;
    const badge = here ? 0 : tool.badge ?? 0;
    return (
      <RailButton
        key={tool.key}
        labelKey={tool.key}
        label={tool.soon ? `${tool.label} · coming soon` : active && tool.key === 'chat' ? `${tool.label} · ${active.name}` : tool.label}
        extra={badge ? `${badge} new` : undefined}
        onPress={tool.onPress}
        tapShowsLabel={tool.soon}
        onHold={tool.soon ? showLabel : onHold}
        onRow={placeRow}
        accessibilityState={{ selected: here }}
        accessibilityLabel={`${tool.label}${here ? ', you are here' : ''}${tool.soon ? ', coming soon' : ''}${badge ? `, ${badge} unread` : ''}`}
      >
        <View style={[styles.key, here && styles.keyHere, held && styles.keyHeld]}>
          <Ionicons name={here ? tool.iconOn : tool.icon} size={22} color={here ? colors.onInk : colors.text} />
        </View>
        {badge ? <Badge count={badge} style={styles.toolBadge} /> : null}
        {tool.soon ? <View style={styles.soonDot} /> : null}
      </RailButton>
    );
  }

  const translateX = slide.interpolate({ inputRange: [0, 1], outputRange: [-(RAIL_LEFT + RAIL + space.md), 0] });
  // The tags follow a beat behind the rail, like they slide out of it.
  const tagsIn = slide.interpolate({ inputRange: [0, 0.6, 1], outputRange: [0, 0, 1] });
  const plusY = slide.interpolate({ inputRange: [0, 1], outputRange: [PLAN_BUTTON_SPACE + 40, 0] });
  const flyoutWidth = screenWidth - (RAIL_LEFT + RAIL + space.xs) - space.md;
  const youHere = current === 'you';

  return (
    <Modal visible transparent animationType="none" onRequestClose={dismiss}>
      <Animated.View style={[styles.scrim, { opacity: slide }]}>
        <Pressable
          style={styles.fill}
          onPress={dismiss}
          accessibilityLabel={flyout ? 'Close your pareas' : 'Close the side rail'}
        />
      </Animated.View>

      <SafeAreaView style={styles.safe} pointerEvents="box-none">
        {/* The zone the rail centres in: below the menu button, above the + button. */}
        <View style={styles.zone} pointerEvents="box-none">
          <Animated.View style={[styles.rail, { transform: [{ translateX }] }]} pointerEvents="box-none">
            <Glass radius={RAIL_RADIUS} sheen="rgba(255,255,255,0.9)" style={styles.glass}>
              {/* Hugs its buttons; only a very short screen ever scrolls it. */}
              <ScrollView
                style={styles.body}
                contentContainerStyle={styles.bodyContent}
                showsVerticalScrollIndicator={false}
                bounces={false}
                scrollEventThrottle={16}
                onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: false })}
              >
                {active ? (
                  <RailButton
                    labelKey="parea"
                    label={active.name}
                    onPress={() => setFlyout((open) => !open)}
                    onHold={flyout ? () => {} : onHold}
                    onRow={placeRow}
                    accessibilityState={{ expanded: flyout }}
                    accessibilityLabel={`${active.name}, current parea. Switch parea${othersUnread > 0 ? `, ${othersUnread} unread in other pareas` : ''}`}
                  >
                    <View style={styles.parea}>
                      <Monogram name={active.name} uri={active.avatarUrl} size={36} square />
                    </View>
                    {othersUnread > 0 ? <Badge count={othersUnread} style={styles.pareaBadge} /> : null}
                    <View style={styles.more}>
                      <Ionicons name={flyout ? 'chevron-back' : 'chevron-forward'} size={10} color={colors.ink} />
                    </View>
                  </RailButton>
                ) : (
                  <RailButton
                    labelKey="new-squad"
                    label="New parea"
                    onPress={onNewSquad}
                    onHold={onHold}
                    onRow={placeRow}
                    accessibilityLabel="New parea or join with a code"
                  >
                    <View style={styles.add}>
                      <Ionicons name="add" size={18} color={colors.textSoft} />
                    </View>
                  </RailButton>
                )}

                <View style={styles.sep} />
                {screens.map(renderTool)}

                <View style={styles.sep} />
                {tools.map(renderTool)}

                <View style={styles.sep} />
                <RailButton
                  labelKey="you"
                  label="You"
                  onPress={onYou}
                  onHold={onHold}
                  onRow={placeRow}
                  accessibilityState={{ selected: youHere }}
                  accessibilityLabel={`You, settings and your nights${youHere ? ', you are here' : ''}`}
                >
                  <View style={[styles.key, youHere && styles.keyHere]}>
                    <View style={[styles.me, youHere && styles.meHere]}>
                      <Monogram name={me.name || 'You'} uri={me.avatarUrl} size={BUTTON - 12} ring={2} />
                    </View>
                  </View>
                </RailButton>
              </ScrollView>
            </Glass>

            {/* Beside the column, moving with it if it ever scrolls. Decoration
                only: each button already says its name and whether you are here. */}
            <Animated.View
              style={[styles.side, { opacity: tagsIn, transform: [{ translateY: Animated.multiply(scrollY, -1) }] }]}
              pointerEvents="box-none"
            >
              {flyout
                ? null
                : Object.keys(rows).map((key) => {
                    const here = key === current;
                    if ((!here && !words) || !names[key]) return null;
                    const top = rows[key] + (BUTTON - TAG_HEIGHT) / 2;
                    return (
                      <View
                        key={key}
                        style={[styles.tag, here ? styles.hereTag : styles.word, { top }]}
                        pointerEvents="none"
                        // aria-hidden also hides it on the web; RN maps it to the native props.
                        aria-hidden
                        accessibilityElementsHidden
                        importantForAccessibility="no-hide-descendants"
                      >
                        {here ? <View style={styles.hereDot} /> : null}
                        <Text style={here ? styles.hereText : styles.wordText} numberOfLines={1}>
                          {here ? names[key].toUpperCase() : names[key]}
                        </Text>
                      </View>
                    );
                  })}

              {/* Your pareas, open beside the current one. */}
              {flyout ? (
                <View style={[styles.flyout, { top: (rows.parea ?? RAIL_PAD) - 2, maxWidth: flyoutWidth }]}>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.flyoutRow}
                    accessibilityLabel="Your pareas"
                  >
                    {squads.map((squad) => {
                      const on = squad.id === activeId;
                      const count = unread[squad.id] ?? 0;
                      return (
                        <Pressable
                          key={squad.id}
                          onPress={() => (on ? setFlyout(false) : onSelectSquad(squad.id))}
                          accessibilityRole="button"
                          accessibilityState={{ selected: on }}
                          accessibilityLabel={`${squad.name}${on ? ', current parea' : ''}${count > 0 ? `, ${count} unread` : ''}`}
                          style={({ pressed }) => [styles.cell, pressed && styles.pressed]}
                        >
                          <View style={[styles.cellMono, on && styles.cellMonoOn]}>
                            <Monogram name={squad.name} uri={squad.avatarUrl} size={44} />
                          </View>
                          {count > 0 && !on ? <Badge count={count} style={styles.cellBadge} /> : null}
                          <Text style={styles.cellName} numberOfLines={1}>
                            {squad.name.toUpperCase()}
                          </Text>
                        </Pressable>
                      );
                    })}
                    <Pressable
                      onPress={onNewSquad}
                      accessibilityRole="button"
                      accessibilityLabel="New parea or join with a code"
                      style={({ pressed }) => [styles.cell, pressed && styles.pressed]}
                    >
                      <View style={styles.add}>
                        <Ionicons name="add" size={18} color={colors.textSoft} />
                      </View>
                      <Text style={styles.cellName}>NEW</Text>
                    </Pressable>
                  </ScrollView>
                </View>
              ) : null}
            </Animated.View>
          </Animated.View>
        </View>

        {/* New plan: a plain + bottom-right, up with the rail on every screen. */}
        <View style={styles.footer} pointerEvents="box-none">
          {active ? (
            <Animated.View style={{ transform: [{ translateY: plusY }] }}>
              <PlanButton squadName={active.name} onPress={onPlan} />
            </Animated.View>
          ) : null}
        </View>
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
  onRow: (key: string, y: number) => void;
  accessibilityLabel: string;
  accessibilityState?: { selected?: boolean; expanded?: boolean };
};

function RailButton({
  labelKey,
  label,
  extra,
  children,
  onPress,
  tapShowsLabel,
  onHold,
  onRow,
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
      onLayout={(event) => onRow(labelKey, event.nativeEvent.layout.y)}
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
  zone: { flex: 1, paddingTop: FAB_BOTTOM + space.sm, justifyContent: 'center' },
  // As tall as its buttons, never taller than the zone. As wide as the screen,
  // so the tags and pareas beside the column are inside it and take taps on Android.
  rail: { maxHeight: '100%' },
  glass: {
    width: RAIL,
    marginLeft: RAIL_LEFT,
    flexShrink: 1,
    borderColor: 'rgba(255,255,255,0.95)',
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.22,
    shadowRadius: 40,
  },
  body: { flexGrow: 0, flexShrink: 1, borderRadius: RAIL_RADIUS },
  bodyContent: { paddingVertical: RAIL_PAD, alignItems: 'center', gap: GAP },
  button: { width: BUTTON, height: BUTTON, alignItems: 'center', justifyContent: 'center' },
  // A press sinks the button a little, like a real key.
  pressed: { transform: [{ scale: 0.9 }] },
  // The current parea: a rounded square in a white and an ink ring.
  parea: {
    width: BUTTON,
    height: BUTTON,
    borderRadius: KEY_RADIUS + 2,
    borderWidth: 2,
    borderColor: colors.ink,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pareaBadge: { top: -6, right: -7 },
  more: {
    position: 'absolute',
    bottom: -5,
    width: 18,
    height: 12,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    shadowColor: colors.ink,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.25,
    shadowRadius: 3,
    elevation: 2,
  },
  add: {
    width: BUTTON,
    height: BUTTON,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: colors.borderStrong,
  },
  sep: { width: 26, height: 2, borderRadius: radius.pill, backgroundColor: colors.border, marginVertical: 5 },
  key: {
    width: BUTTON,
    height: BUTTON,
    borderRadius: KEY_RADIUS,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // The screen you are on: an ink key and the filled icon.
  keyHere: { backgroundColor: colors.ink },
  // The icon whose label is showing.
  keyHeld: { backgroundColor: 'rgba(12,25,38,0.06)' },
  toolBadge: { right: -4, top: -3 },
  soonDot: {
    position: 'absolute',
    right: 7,
    top: 7,
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
  // You: a white ring inside a blue one; sun when you are there.
  me: { borderRadius: radius.pill, borderWidth: 2, borderColor: colors.primary },
  meHere: { borderColor: sun },
  side: { position: 'absolute', top: 1, right: 0, bottom: 0, left: RAIL_LEFT },
  tag: {
    position: 'absolute',
    height: TAG_HEIGHT,
    maxWidth: 200,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  // You are here: an ink tab coming out of the rail's edge.
  hereTag: {
    left: RAIL,
    paddingLeft: space.sm,
    paddingRight: 12,
    borderTopRightRadius: radius.sm,
    borderBottomRightRadius: radius.sm,
    backgroundColor: colors.ink,
  },
  hereDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: sun },
  hereText: { color: colors.onInk, ...typo.mono, fontWeight: '600', fontSize: textSize.caption, letterSpacing: 1.5 },
  // The first few times: each icon's name on a small white pill.
  word: {
    left: RAIL + space.xs,
    paddingHorizontal: space.sm,
    borderRadius: radius.sm,
    backgroundColor: colors.surface,
    shadowColor: colors.ink,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.16,
    shadowRadius: 12,
    elevation: 4,
  },
  wordText: { color: colors.text, ...typo.bold, fontSize: textSize.body, flexShrink: 1 },
  flyout: {
    position: 'absolute',
    left: RAIL + space.xs,
    padding: space.sm,
    borderRadius: 22,
    backgroundColor: colors.surface,
    shadowColor: colors.ink,
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.25,
    shadowRadius: 30,
    elevation: 10,
  },
  flyoutRow: { gap: space.xs },
  cell: { width: FLYOUT_CELL, minHeight: BUTTON, alignItems: 'center', gap: space.xs, paddingVertical: 4 },
  cellMono: { borderRadius: radius.pill, borderWidth: 2, borderColor: 'transparent', padding: 2 },
  cellMonoOn: { borderColor: colors.ink },
  cellBadge: { top: 0, right: 2 },
  cellName: {
    maxWidth: FLYOUT_CELL - 4,
    color: colors.ink,
    ...typo.mono,
    fontWeight: '600',
    fontSize: textSize.micro,
    letterSpacing: 0.4,
    textAlign: 'center',
  },
  footer: {
    height: PLAN_BUTTON_SPACE,
    justifyContent: 'flex-end',
    alignItems: 'flex-end',
    paddingRight: PLAN_BUTTON_RIGHT,
    paddingBottom: PLAN_BUTTON_BOTTOM,
  },
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
});
