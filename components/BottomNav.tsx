import { Ionicons } from '@expo/vector-icons';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, font, layout, space } from '../theme';

export type NavTab = 'home' | 'chat';

type TabDef = {
  key: NavTab;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  iconActive: keyof typeof Ionicons.glyphMap;
};

const TABS: TabDef[] = [
  { key: 'home', label: 'Home', icon: 'home-outline', iconActive: 'home' },
  { key: 'chat', label: 'Chats', icon: 'chatbubbles-outline', iconActive: 'chatbubbles' },
];

type BottomNavProps = {
  active: NavTab;
  onNavigate: (tab: NavTab) => void;
};

export default function BottomNav({ active, onNavigate }: BottomNavProps) {
  return (
    <View style={styles.bar}>
      <View style={styles.inner}>
      {TABS.map((tab) => {
        const isActive = tab.key === active;
        return (
          <Pressable
            key={tab.key}
            onPress={() => onNavigate(tab.key)}
            accessibilityRole="button"
            accessibilityState={{ selected: isActive }}
            accessibilityLabel={tab.label}
            style={({ pressed }) => [styles.tab, pressed && styles.pressed]}
          >
            <Ionicons
              name={isActive ? tab.iconActive : tab.icon}
              size={23}
              color={isActive ? colors.primary : colors.textSoft}
            />
            <Text style={[styles.label, isActive && styles.labelActive]}>{tab.label}</Text>
          </Pressable>
        );
      })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: space.sm,
    // Χώρος για το home indicator στο iOS.
    paddingBottom: Platform.OS === 'ios' ? 24 : space.sm,
  },
  inner: { flexDirection: 'row', width: '100%', maxWidth: layout.column, alignSelf: 'center' },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 3 },
  pressed: { opacity: 0.6 },
  label: { color: colors.textSoft, fontFamily: font.medium, fontSize: 11 },
  labelActive: { color: colors.primary, fontFamily: font.semi },
});
