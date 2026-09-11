import { Ionicons } from '@expo/vector-icons';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, font, layout, radius, shadow, space } from '../../theme';

export type NavTab = 'home' | 'explore' | 'groups' | 'you';

type Icon = keyof typeof Ionicons.glyphMap;

type Slot =
  | { kind: 'tab'; key: NavTab; label: string; icon: Icon; iconActive: Icon }
  | { kind: 'soon'; label: string; icon: Icon }
  | { kind: 'create' };

const SLOTS: Slot[] = [
  { kind: 'tab', key: 'home', label: 'Today', icon: 'ticket-outline', iconActive: 'ticket' },
  { kind: 'tab', key: 'explore', label: 'Explore', icon: 'compass-outline', iconActive: 'compass' },
  { kind: 'create' },
  { kind: 'tab', key: 'groups', label: 'Parea', icon: 'chatbubbles-outline', iconActive: 'chatbubbles' },
  { kind: 'tab', key: 'you', label: 'You', icon: 'person-outline', iconActive: 'person' },
];

type BottomNavProps = {
  active: NavTab;
  onNavigate: (tab: NavTab) => void;
  onCreate: () => void;
};

export default function BottomNav({ active, onNavigate, onCreate }: BottomNavProps) {
  return (
    <View style={styles.dock} pointerEvents="box-none">
      <View style={styles.pill}>
        {SLOTS.map(function (slot) {
          if (slot.kind === 'create') {
            return (
              <Pressable
                key="create"
                onPress={onCreate}
                accessibilityRole="button"
                accessibilityLabel="New plan"
                style={({ pressed }) => [styles.create, pressed && styles.pressed]}
              >
                <Ionicons name="add" size={24} color={colors.textOnBrand} />
              </Pressable>
            );
          }

          if (slot.kind === 'soon') {
            return (
              <View
                key={slot.label}
                accessibilityLabel={`${slot.label}, not available yet`}
                accessibilityState={{ disabled: true }}
                style={[styles.slot, styles.soon]}
              >
                <Ionicons name={slot.icon} size={22} color={colors.textSoft} />
                <Text style={styles.label}>{slot.label}</Text>
              </View>
            );
          }

          const isActive = slot.key === active;

          return (
            <Pressable
              key={slot.key}
              onPress={() => onNavigate(slot.key)}
              accessibilityRole="button"
              accessibilityState={{ selected: isActive }}
              accessibilityLabel={slot.label}
              style={({ pressed }) => [styles.slot, pressed && styles.pressed]}
            >
              <Ionicons
                name={isActive ? slot.iconActive : slot.icon}
                size={22}
                color={isActive ? colors.primary : colors.textSoft}
              />
              <Text style={[styles.label, isActive && styles.labelActive]}>{slot.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  dock: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: Platform.OS === 'ios' ? 28 : 16,
    paddingHorizontal: 14,
    alignItems: 'center',
  },
  pill: {
    width: '100%',
    maxWidth: layout.column,
    height: 66,
    borderRadius: radius.xl,
    paddingHorizontal: space.xs,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#0C1926',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
    elevation: 12,
  },

  slot: { width: 56, alignItems: 'center', justifyContent: 'center', gap: 4 },
  soon: { opacity: 0.4 },
  pressed: { opacity: 0.6 },

  label: { color: colors.textSoft, fontFamily: font.semi, fontSize: 9.5, letterSpacing: 0.2 },
  labelActive: { color: colors.primary },

  create: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.button,
  },
});
