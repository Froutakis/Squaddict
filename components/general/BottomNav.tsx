import { Ionicons } from '@expo/vector-icons';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, typo, layout, radius, space } from '../../theme';
import Glass from './Glass';

export type NavTab = 'home' | 'explore' | 'you';

type Icon = keyof typeof Ionicons.glyphMap;

type Slot = { key: NavTab; label: string; icon: Icon; iconActive: Icon };

// Us, the world, me.
const SLOTS: Slot[] = [
  { key: 'home', label: 'Parea', icon: 'people-outline', iconActive: 'people' },
  { key: 'explore', label: 'Explore', icon: 'compass-outline', iconActive: 'compass' },
  { key: 'you', label: 'You', icon: 'person-outline', iconActive: 'person' },
];

type BottomNavProps = {
  active: NavTab;
  onNavigate: (tab: NavTab) => void;
  badges?: Partial<Record<NavTab, number>>;
};

export default function BottomNav({ active, onNavigate, badges = {} }: BottomNavProps) {
  return (
    <View style={styles.dock} pointerEvents="box-none">
      <Glass style={styles.pill}>
        {SLOTS.map(function (slot) {
          const isActive = slot.key === active;
          const badge = badges[slot.key] ?? 0;

          return (
            <Pressable
              key={slot.key}
              onPress={() => onNavigate(slot.key)}
              accessibilityRole="button"
              accessibilityState={{ selected: isActive }}
              accessibilityLabel={badge > 0 ? `${slot.label}, ${badge} unread` : slot.label}
              style={({ pressed }) => [styles.slot, pressed && styles.pressed]}
            >
              <View>
                <Ionicons
                  name={isActive ? slot.iconActive : slot.icon}
                  size={22}
                  color={isActive ? colors.primary : colors.textSoft}
                />
                {badge > 0 ? (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{badge > 99 ? '99+' : badge}</Text>
                  </View>
                ) : null}
              </View>
              <Text style={[styles.label, isActive && styles.labelActive]}>{slot.label}</Text>
            </Pressable>
          );
        })}
      </Glass>
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
    paddingHorizontal: space.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
  },

  slot: { width: 72, alignItems: 'center', justifyContent: 'center', gap: 4 },
  pressed: { opacity: 0.6 },

  label: { color: colors.textSoft, ...typo.semi, fontSize: 9.5, letterSpacing: 0.2 },
  labelActive: { color: colors.primary },

  badge: {
    position: 'absolute',
    top: -5,
    right: -10,
    minWidth: 17,
    height: 17,
    paddingHorizontal: 4,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.danger,
    borderWidth: 1.5,
    borderColor: colors.surface,
  },
  badgeText: { color: '#FFFFFF', ...typo.semi, fontSize: 9.5 },
});
