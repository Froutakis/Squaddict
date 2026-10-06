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
} from 'react-native';
import type { Group } from '../../services/serviceGroup';
import Monogram from '../general/Monogram';
import PlanButton, { PLAN_BUTTON_BOTTOM, PLAN_BUTTON_RIGHT, PLAN_BUTTON_SPACE } from '../general/PlanButton';
import { FAB_BOTTOM } from '../general/MenuFab';
import { colors, radius, space, sun, textSize, typo } from '../../theme';
import { features } from '../../lib/features';

const RAIL = 76;
const RAIL_RADIUS = 26;
const RAIL_LEFT = 12;
const RAIL_PAD = 12;
// A parea's squircle.
const PAREA = 48;
const GAP = 6;
const SLIDE_MS = 200;
const LABEL_MS = 1600;
// iOS can't present a sheet while the rail is still sliding away.
export const RAIL_CLOSE_MS = 260;
const LABEL_HEIGHT = 34;
const LABEL_LEFT = RAIL_LEFT + RAIL + 10;
const NAME_HEIGHT = 48;
// The first few times the rail opens, every parea has its name beside it.
const WORDS_KEY = 'squaddict.railWordsShown';
const WORDS_OPENS = 3;

type IconName = ComponentProps<typeof Ionicons>['name'];

type Label = { key: string; text: string; extra?: string; y: number; h: number };

// Every screen the rail opens. One of them is always where you are.
export type RailScreen = 'home' | 'explore' | 'chat' | 'calendar' | 'you';

type Tool = {
  key: RailScreen | 'voice';
  label: string;
  icon: IconName;
  // The filled icon, for the screen you are on.
  iconOn: IconName;
  badge?: number;
  // What a screen reader says for the badge, when "N unread" is not it.
  spoken?: string;
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
  // Open votes in the current parea you have not answered: they live in its
  // chat, so they count on Chat.
  votes?: number;
  onExplore: () => void;
  onYou: () => void;
  onClose: () => void;
};

// The side rail, the app's only menu: a white column down the left edge.
// Your pareas on top as squircles with what is new in each, the one you are in
// ringed in blue; then, under a line, the screens (Chat, Home, Explore,
// Calendar) with their names, the one you are on in soft blue; you at the
// bottom. New plan is not in the column: it is a blue ticket + bottom-right
// that comes up with it.
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
  onExplore,
  onYou,
  onClose,
}: PareaSidebarProps) {
  const slide = useRef(new Animated.Value(0)).current;
  const scrollY = useRef(new Animated.Value(0)).current;
  // Stays mounted while it slides out, then unmounts.
  const [mounted, setMounted] = useState(visible);
  const [label, setLabel] = useState<Label | null>(null);
  const [words, setWords] = useState(false);
  // Where each button sits in the column, for the tags beside it.
  const [rows, setRows] = useState<Record<string, { y: number; h: number }>>({});
  const opens = useRef<number | null>(null);
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

  // The names already say which parea is which, so holding adds nothing.
  const onHold = words ? () => {} : showLabel;

  function placeRow(key: string, y: number, h: number) {
    setRows((was) => (was[key]?.y === y && was[key]?.h === h ? was : { ...was, [key]: { y, h } }));
  }

  // Tapping outside, or Android back, closes the rail.
  function dismiss() {
    onClose();
  }


  const active = squads.find((squad) => squad.id === activeId);
  const chatUnread = activeId ? unread[activeId] ?? 0 : 0;
  // Where you go: the current parea's chat, Home (its plans and memories),
  // Explore, its calendar.
  const tools: Tool[] = [
    {
      key: 'chat',
      label: 'Chat',
      icon: 'chatbubble-outline',
      iconOn: 'chatbubble',
      badge: chatUnread + votes,
      // Messages and the votes waiting on you, said apart.
      spoken: [chatUnread > 0 ? `${chatUnread} unread` : null, votes > 0 ? `${votes} ${votes === 1 ? 'vote' : 'votes'} waiting` : null]
        .filter(Boolean)
        .join(', '),
      onPress: onChat,
    },
    { key: 'home', label: 'Home', icon: 'home-outline', iconOn: 'home', onPress: onHome },
    ...(features.explore
      ? [{ key: 'explore' as const, label: 'Explore', icon: 'compass-outline' as IconName, iconOn: 'compass' as IconName, onPress: onExplore }]
      : []),
    { key: 'calendar', label: 'Calendar', icon: 'calendar-outline', iconOn: 'calendar', onPress: onCalendar },
    ...(features.voice
      ? [{ key: 'voice' as const, label: 'Voice', icon: 'mic-outline' as IconName, iconOn: 'mic' as IconName, soon: true }]
      : []),
  ];

  function renderTool(tool: Tool) {
    const here = tool.key === current;
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
        accessibilityLabel={`${tool.label}${here ? ', you are here' : ''}${tool.soon ? ', coming soon' : ''}${tool.spoken ? `, ${tool.spoken}` : badge ? `, ${badge} unread` : ''}`}
      >
        <View style={[styles.tool, here && styles.toolHere]}>
          <Ionicons name={here ? tool.iconOn : tool.icon} size={20} color={here ? colors.accentInk : colors.textSoft} />
          <Text style={[styles.toolText, here && styles.toolTextHere]} numberOfLines={1}>
            {tool.label}
          </Text>
          {badge ? <View style={styles.toolDot} /> : null}
          {tool.soon ? <View style={styles.soonDot} /> : null}
        </View>
      </RailButton>
    );
  }

  const translateX = slide.interpolate({ inputRange: [0, 1], outputRange: [-(RAIL_LEFT + RAIL + space.md), 0] });
  // The names follow a beat behind the rail, like they slide out of it.
  const tagsIn = slide.interpolate({ inputRange: [0, 0.6, 1], outputRange: [0, 0, 1] });
  const plusY = slide.interpolate({ inputRange: [0, 1], outputRange: [PLAN_BUTTON_SPACE + 40, 0] });
  const youHere = current === 'you';
  const names: Record<string, string> = {};
  for (const squad of squads) names[`parea-${squad.id}`] = squad.name;

  return (
    <Modal visible transparent animationType="none" onRequestClose={dismiss}>
      <Animated.View style={[styles.scrim, { opacity: slide }]}>
        <Pressable style={styles.fill} onPress={dismiss} accessibilityLabel="Close the side rail" />
      </Animated.View>

      <SafeAreaView style={styles.safe} pointerEvents="box-none">
        {/* The zone the rail fills: below the menu button, down to the bottom. */}
        <View style={styles.zone} pointerEvents="box-none">
          <Animated.View style={[styles.rail, { transform: [{ translateX }] }]} pointerEvents="box-none">
            <View style={styles.card}>
              <ScrollView
                style={styles.body}
                contentContainerStyle={styles.bodyContent}
                showsVerticalScrollIndicator={false}
                bounces={false}
                scrollEventThrottle={16}
                onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: false })}
              >
                {/* Your pareas: squircles with what is new in each, the one you are in ringed. */}
                <View style={styles.group}>
                  {squads.map((squad) => {
                    const on = squad.id === activeId;
                    const count = unread[squad.id] ?? 0;
                    return (
                      <RailButton
                        key={squad.id}
                        labelKey={`parea-${squad.id}`}
                        label={squad.name}
                        extra={count > 0 ? `${count} new` : undefined}
                        onPress={() => (on ? onClose() : onSelectSquad(squad.id))}
                        onHold={onHold}
                        onRow={placeRow}
                        accessibilityState={{ selected: on }}
                        accessibilityLabel={`${squad.name}${on ? ', current parea' : ''}${count > 0 ? `, ${count} unread` : ''}`}
                      >
                        <View style={[styles.ring, on && styles.ringOn]}>
                          <Monogram name={squad.name} uri={squad.avatarUrl} size={PAREA} style={styles.parea} />
                        </View>
                        {count > 0 ? <Badge count={count} style={styles.pareaBadge} /> : null}
                      </RailButton>
                    );
                  })}
                  <RailButton
                    labelKey="new-squad"
                    label="New parea"
                    onPress={onNewSquad}
                    onHold={onHold}
                    onRow={placeRow}
                    accessibilityLabel="New parea or join with a code"
                  >
                    <View style={styles.ring}>
                      <View style={styles.add}>
                        <Ionicons name="add" size={22} color={colors.textSoft} />
                      </View>
                    </View>
                  </RailButton>
                </View>

                <View style={styles.sep} />
                {tools.map(renderTool)}

                <View style={styles.spacer} />
                <RailButton
                  labelKey="you"
                  label="You"
                  onPress={onYou}
                  onHold={onHold}
                  onRow={placeRow}
                  accessibilityState={{ selected: youHere }}
                  accessibilityLabel={`You, settings and your nights${youHere ? ', you are here' : ''}`}
                >
                  <View style={[styles.tool, youHere && styles.toolHere]}>
                    <Monogram name={me.name || 'You'} uri={me.avatarUrl} size={28} style={styles.me} />
                    <Text style={[styles.toolText, youHere && styles.toolTextHere]}>You</Text>
                  </View>
                </RailButton>
              </ScrollView>
            </View>

            {/* The pareas' names beside the column, the first few times the rail
                opens. Decoration only: each button already says its name. */}
            {words ? (
              <Animated.View
                style={[styles.side, { opacity: tagsIn, transform: [{ translateY: Animated.multiply(scrollY, -1) }] }]}
                pointerEvents="none"
              >
                {Object.keys(rows).map((key) => {
                  if (!names[key]) return null;
                  const row = rows[key];
                  return (
                    <View
                      key={key}
                      style={[styles.name, { top: row.y + (row.h - NAME_HEIGHT) / 2 }]}
                      // aria-hidden also hides it on the web; RN maps it to the native props.
                      aria-hidden
                      accessibilityElementsHidden
                      importantForAccessibility="no-hide-descendants"
                    >
                      <Text style={styles.nameText} numberOfLines={1}>
                        {names[key]}
                      </Text>
                    </View>
                  );
                })}
              </Animated.View>
            ) : null}
          </Animated.View>
        </View>

        {/* New plan: a blue ticket + bottom-right, up with the rail on every screen. */}
        <View style={styles.footer} pointerEvents="box-none">
          {active ? (
            <Animated.View style={{ transform: [{ translateY: plusY }] }}>
              <PlanButton squadName={active.name} onPress={onPlan} />
            </Animated.View>
          ) : null}
        </View>
      </SafeAreaView>

      {label ? (
        <View style={[styles.label, { top: label.y + (label.h - LABEL_HEIGHT) / 2 }]} pointerEvents="none">
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
  onRow: (key: string, y: number, h: number) => void;
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
    ref.current?.measureInWindow((_x, y, _w, h) => onHold({ key: labelKey, text: label, extra, y, h }));
  }

  return (
    <Pressable
      ref={ref}
      onPress={() => (tapShowsLabel ? hold() : onPress?.())}
      onLongPress={hold}
      delayLongPress={300}
      // On the web a mouse can just point at an icon to see its name.
      onHoverIn={hold}
      onLayout={(event) => onRow(labelKey, event.nativeEvent.layout.y, event.nativeEvent.layout.height)}
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
  // The page behind really steps back.
  scrim: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: 'rgba(14,26,39,0.48)' },
  safe: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
  zone: { flex: 1, paddingTop: FAB_BOTTOM + space.sm, paddingBottom: space.lg },
  // As tall as the zone. As wide as the screen, so the names beside the
  // column are inside it.
  rail: { flex: 1 },
  card: {
    flex: 1,
    width: RAIL,
    marginLeft: RAIL_LEFT,
    borderRadius: RAIL_RADIUS,
    backgroundColor: colors.surface,
    shadowColor: colors.ink,
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.18,
    shadowRadius: 40,
    elevation: 12,
  },
  body: { flex: 1, borderRadius: RAIL_RADIUS },
  bodyContent: { flexGrow: 1, paddingVertical: RAIL_PAD, alignItems: 'center', gap: GAP },
  group: { alignItems: 'center', gap: 4 },
  button: { alignItems: 'center', justifyContent: 'center' },
  // A press sinks the button a little, like a real key.
  pressed: { transform: [{ scale: 0.94 }] },

  // Room for the ring around the parea you are in.
  ring: { width: PAREA + 8, height: PAREA + 8, borderRadius: 20, borderWidth: 2, borderColor: 'transparent', alignItems: 'center', justifyContent: 'center' },
  ringOn: { borderColor: colors.primary },
  parea: { borderRadius: 16 },
  pareaBadge: { top: -1, right: -2 },
  add: { width: PAREA, height: PAREA, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.sunk },
  sep: { width: 34, height: 1.5, backgroundColor: colors.border, marginVertical: 6 },
  spacer: { flex: 1 },

  tool: {
    width: 56,
    paddingTop: 7,
    paddingBottom: 6,
    borderRadius: 14,
    alignItems: 'center',
    gap: 3,
  },
  // The screen you are on: a soft blue key, blue words.
  toolHere: { backgroundColor: colors.accentSoft },
  toolText: { color: colors.textSoft, ...typo.semi, fontSize: 10.5 },
  toolTextHere: { color: colors.accentInk },
  toolDot: { position: 'absolute', top: 2, right: 6, width: 8, height: 8, borderRadius: 4, backgroundColor: colors.danger },
  soonDot: {
    position: 'absolute',
    right: 7,
    top: 4,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: sun,
    borderWidth: 2,
    borderColor: colors.surface,
  },
  me: { borderRadius: 9 },
  badge: {
    position: 'absolute',
    minWidth: 19,
    height: 19,
    paddingHorizontal: 5,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.danger,
    borderWidth: 2,
    borderColor: colors.surface,
  },
  badgeText: { color: '#FFFFFF', ...typo.mono, fontSize: 10.5 },

  side: { position: 'absolute', top: 0, right: 0, bottom: 0, left: RAIL_LEFT + RAIL + 10 },
  // The first few times: each parea's name on a white card beside it.
  name: {
    position: 'absolute',
    left: 0,
    height: NAME_HEIGHT,
    maxWidth: 220,
    justifyContent: 'center',
    paddingHorizontal: 14,
    borderRadius: 14,
    backgroundColor: colors.surface,
  },
  nameText: { color: colors.text, ...typo.semi, fontSize: textSize.base },
  footer: {
    position: 'absolute',
    right: 0,
    bottom: 0,
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
