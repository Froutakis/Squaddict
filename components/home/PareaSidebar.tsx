import { useEffect, useRef, useState, type ComponentProps, type ReactNode } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Animated, Modal, Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import type { Group } from '../../services/serviceGroup';
import Monogram from '../general/Monogram';
import Glass from '../general/Glass';
import { colors, radius, space, sun, textSize, typo } from '../../theme';

const RAIL = 64;
const RAIL_RADIUS = 26;
// Buttons sit on the glass as frosted white, not as solid grey.
const GLASS_FILL = 'rgba(255,255,255,0.72)';
const SQUAD = 42;
const TOOL = 44;
const SLIDE_MS = 200;
const LABEL_MS = 1600;

type IconName = ComponentProps<typeof Ionicons>['name'];

type Tool = {
  key: string;
  label: string;
  icon: IconName;
  badge?: number;
  // The one action worth a colour: making a plan.
  primary?: boolean;
  onPress?: () => void;
};

type PareaSidebarProps = {
  visible: boolean;
  squads: Group[];
  activeId: string | null;
  unread: Record<string, number>;
  onSelectSquad: (id: string) => void;
  onNewSquad: () => void;
  onChat: () => void;
  onPlan: () => void;
  onCalendar: () => void;
  onClose: () => void;
};

// The Parea side menu: a slim floating rail of icons. Squads on top (tap to
// switch), the squad's tools below. Hold any icon to see what it is.
export default function PareaSidebar({
  visible,
  squads,
  activeId,
  unread,
  onSelectSquad,
  onNewSquad,
  onChat,
  onPlan,
  onCalendar,
  onClose,
}: PareaSidebarProps) {
  const slide = useRef(new Animated.Value(0)).current;
  // Stays mounted while it slides out, then unmounts.
  const [mounted, setMounted] = useState(visible);
  const [label, setLabel] = useState<{ text: string; y: number } | null>(null);
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

  useEffect(() => () => {
    if (labelTimer.current) clearTimeout(labelTimer.current);
  }, []);

  if (!mounted) return null;

  function showLabel(text: string, y: number) {
    if (labelTimer.current) clearTimeout(labelTimer.current);
    setLabel({ text, y });
    labelTimer.current = setTimeout(() => setLabel(null), LABEL_MS);
  }

  // Tapping a tool that isn't built yet just says so.
  function soon(name: string) {
    return (y: number) => showLabel(`${name} · coming soon`, y);
  }

  const active = squads.find((squad) => squad.id === activeId);
  const tools: Tool[] = [
    { key: 'plan', label: 'New plan', icon: 'add', primary: true, onPress: onPlan },
    { key: 'chat', label: 'Chat', icon: 'chatbubble-ellipses-outline', badge: activeId ? unread[activeId] ?? 0 : 0, onPress: onChat },
    { key: 'calendar', label: 'Calendar', icon: 'calendar-outline', onPress: onCalendar },
    { key: 'map', label: 'Map', icon: 'map-outline' },
    { key: 'voice', label: 'Voice', icon: 'mic-outline' },
  ];

  const translateX = slide.interpolate({ inputRange: [0, 1], outputRange: [-(RAIL + space.md), 0] });

  return (
    <Modal visible transparent animationType="none" onRequestClose={onClose}>
      <Animated.View style={[styles.scrim, { opacity: slide }]}>
        <Pressable style={styles.fill} onPress={onClose} accessibilityLabel="Close the menu" />
      </Animated.View>

      <SafeAreaView style={styles.safe} pointerEvents="box-none">
        <Animated.View style={[styles.rail, { transform: [{ translateX }] }]}>
          <Glass radius={RAIL_RADIUS} style={styles.glass}>
          {squads.map((squad) => {
            const isActive = squad.id === activeId;
            const count = unread[squad.id] ?? 0;
            return (
              <RailButton
                key={squad.id}
                label={squad.name}
                onPress={() => onSelectSquad(squad.id)}
                onHold={showLabel}
                accessibilityState={{ selected: isActive }}
                accessibilityLabel={`${squad.name}${isActive ? ', current squad' : ''}${count > 0 ? `, ${count} unread` : ''}`}
              >
                <View style={[styles.squad, isActive && styles.squadActive]}>
                  <Monogram name={squad.name} uri={squad.avatarUrl} size={isActive ? SQUAD : SQUAD - 6} />
                </View>
                {count > 0 && !isActive ? <View style={styles.dot} /> : null}
              </RailButton>
            );
          })}

          <RailButton label="New squad" onPress={onNewSquad} onHold={showLabel} accessibilityLabel="New squad or join with a code">
            <View style={styles.add}>
              <Ionicons name="add" size={18} color={colors.textSoft} />
            </View>
          </RailButton>

          <View style={styles.sep} />

          {tools.map((tool) => (
            <RailButton
              key={tool.key}
              label={active ? `${tool.label} · ${active.name}` : tool.label}
              onPress={tool.onPress}
              onPressAt={tool.onPress ? undefined : soon(tool.label)}
              onHold={showLabel}
              accessibilityLabel={tool.onPress ? tool.label : `${tool.label}, coming soon`}
            >
              <View style={[styles.tool, tool.primary && styles.toolPrimary, !tool.onPress && styles.toolSoon]}>
                <Ionicons
                  name={tool.icon}
                  size={tool.primary ? 22 : 20}
                  color={tool.primary ? colors.textOnBrand : tool.onPress ? colors.text : colors.textFaint}
                />
              </View>
              {tool.badge ? (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{tool.badge > 99 ? '99+' : tool.badge}</Text>
                </View>
              ) : null}
            </RailButton>
          ))}
          </Glass>
        </Animated.View>

        {label ? (
          <View style={[styles.label, { top: label.y }]} pointerEvents="none">
            <Text style={styles.labelText} numberOfLines={1}>
              {label.text}
            </Text>
          </View>
        ) : null}
      </SafeAreaView>
    </Modal>
  );
}

type RailButtonProps = {
  label: string;
  children: ReactNode;
  onPress?: () => void;
  // For a button that answers a tap with its label (tools not built yet).
  onPressAt?: (y: number) => void;
  onHold: (text: string, y: number) => void;
  accessibilityLabel: string;
  accessibilityState?: { selected?: boolean };
};

function RailButton({ label, children, onPress, onPressAt, onHold, accessibilityLabel, accessibilityState }: RailButtonProps) {
  const y = useRef(0);

  return (
    <Pressable
      onLayout={(event) => {
        y.current = event.nativeEvent.layout.y;
      }}
      onPress={() => (onPressAt ? onPressAt(y.current) : onPress?.())}
      onLongPress={() => onHold(label, y.current)}
      delayLongPress={300}
      // On the web a mouse can just point at an icon to see its name.
      onHoverIn={() => onHold(label, y.current)}
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
  // Light, so the page stays readable behind the glass.
  scrim: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: 'rgba(12,25,38,0.16)' },
  safe: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
  rail: {
    position: 'absolute',
    top: space.sm,
    left: space.xs,
    width: RAIL,
    marginTop: space.lg,
  },
  glass: {
    paddingVertical: space.sm,
    alignItems: 'center',
    gap: space.xs,
  },
  button: { width: RAIL, height: TOOL + 4, alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.6 },
  squad: { borderRadius: radius.pill },
  squadActive: { padding: 2, borderWidth: 2, borderColor: sun },
  dot: {
    position: 'absolute',
    top: 5,
    right: 12,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.danger,
    borderWidth: 2,
    borderColor: colors.surface,
  },
  add: {
    width: SQUAD - 6,
    height: SQUAD - 6,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: 'rgba(12,25,38,0.25)',
  },
  sep: { width: 26, height: 2, borderRadius: 1, backgroundColor: 'rgba(12,25,38,0.1)', marginVertical: 2 },
  tool: {
    width: TOOL,
    height: TOOL,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: GLASS_FILL,
  },
  toolPrimary: { backgroundColor: colors.primary },
  toolSoon: { backgroundColor: 'transparent', borderWidth: 1.5, borderStyle: 'dashed', borderColor: 'rgba(12,25,38,0.18)' },
  badge: {
    position: 'absolute',
    top: 0,
    right: 6,
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
  badgeText: { color: '#FFFFFF', ...typo.bold, fontSize: 9 },
  label: {
    position: 'absolute',
    left: RAIL + space.md,
    marginTop: space.lg + space.sm + 12,
    maxWidth: 240,
    paddingHorizontal: space.sm,
    paddingVertical: 6,
    borderRadius: radius.sm,
    backgroundColor: colors.ink,
  },
  labelText: { color: colors.onInk, ...typo.semi, fontSize: textSize.small },
});
