import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { Group } from '../../services/serviceGroup';
import { todayLabel } from '../../lib/datetime';
import Monogram from '../general/Monogram';
import { colors, space, textSize, typo } from '../../theme';
import { FAB_CENTER_Y, FAB_INSET } from '../general/MenuFab';

type HomeHeaderProps = {
  // The squad Home is showing; switching squads happens in the side rail.
  squad?: Group;
  // Which face of Parea this is: Memories or Plans.
  label: string;
  onMenu: () => void;
};

// The squad you are looking at, and under it which face of it this is. Tapping the squad opens the side
// rail, where chat, plans and the other squads are; the floating menu button
// opens it from anywhere.
export default function HomeHeader({ squad, label, onMenu }: HomeHeaderProps) {
  return (
    <View style={styles.header}>
      <View style={styles.top}>
        {squad ? (
          <Pressable
            onPress={onMenu}
            accessibilityRole="button"
            accessibilityLabel={`${squad.name}. Open the side rail to switch squads`}
            style={({ pressed }) => [styles.squad, pressed && styles.pressed]}
          >
            <Monogram name={squad.name} uri={squad.avatarUrl} size={30} />
            <Text style={styles.name} numberOfLines={1}>
              {squad.name}
            </Text>
          </Pressable>
        ) : null}
      </View>

      <Text style={styles.date}>
        {label} · {todayLabel()}
      </Text>
    </View>
  );
}

const NAME_ROW = 32;

const styles = StyleSheet.create({
  // Starts right of the floating menu button, the squad's name level with it
  // (Home's page already pads space.md above).
  header: { paddingLeft: FAB_INSET, paddingRight: space.lg, paddingTop: FAB_CENTER_Y - NAME_ROW / 2 - space.md },
  date: {
    color: colors.textFaint,
    ...typo.mono,
    fontSize: textSize.caption,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginTop: 2,
  },
  top: { flexDirection: 'row', alignItems: 'center', gap: space.sm, height: NAME_ROW },
  squad: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: space.xs },
  name: { flexShrink: 1, color: colors.text, ...typo.display, fontSize: textSize.heading, letterSpacing: -0.4 },
  pressed: { opacity: 0.7 },
});
