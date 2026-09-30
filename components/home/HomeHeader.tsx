import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { Group } from '../../services/serviceGroup';
import { todayLabel } from '../../lib/datetime';
import Monogram from '../general/Monogram';
import { colors, radius, space, textSize, typo } from '../../theme';

type HomeHeaderProps = {
  // The squad Home is showing; switching squads happens in the side menu.
  squad?: Group;
  onMenu: () => void;
  // Unread messages across every squad, shown on the menu button.
  menuUnread?: number;
};

// The menu button and the squad you are looking at. Tapping either opens the
// side menu, where chat, plans and the other squads are.
export default function HomeHeader({ squad, onMenu, menuUnread = 0 }: HomeHeaderProps) {
  return (
    <View style={styles.header}>
      <Text style={styles.date}>{todayLabel()}</Text>

      <View style={styles.top}>
        <Pressable
          onPress={onMenu}
          accessibilityRole="button"
          accessibilityLabel={menuUnread > 0 ? `Open the menu, ${menuUnread} unread` : 'Open the menu'}
          hitSlop={6}
          style={({ pressed }) => [styles.menu, pressed && styles.pressed]}
        >
          <Ionicons name="menu" size={19} color={colors.text} />
          {menuUnread > 0 ? (
            <View style={styles.unread}>
              <Text style={styles.unreadText}>{menuUnread > 99 ? '99+' : menuUnread}</Text>
            </View>
          ) : null}
        </Pressable>

        {squad ? (
          <Pressable
            onPress={onMenu}
            accessibilityRole="button"
            accessibilityLabel={`${squad.name}. Open the menu to switch squads`}
            style={({ pressed }) => [styles.squad, pressed && styles.pressed]}
          >
            <Monogram name={squad.name} uri={squad.avatarUrl} size={30} />
            <Text style={styles.name} numberOfLines={1}>
              {squad.name}
            </Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: space.lg, paddingTop: space.xs },
  date: {
    color: colors.textFaint,
    ...typo.mono,
    fontSize: textSize.caption,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  top: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginTop: 3 },
  menu: {
    width: 38,
    height: 38,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  unread: {
    position: 'absolute',
    top: -4,
    right: -5,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.danger,
    borderWidth: 2,
    borderColor: colors.bg,
  },
  unreadText: { color: '#FFFFFF', ...typo.bold, fontSize: 9 },
  squad: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: space.xs },
  name: { flexShrink: 1, color: colors.text, ...typo.display, fontSize: textSize.heading, letterSpacing: -0.4 },
  pressed: { opacity: 0.7 },
});
