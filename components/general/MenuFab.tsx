import { Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { colors, radius, space, typo } from '../../theme';

const SIZE = 44;
const TOP = space.sm;
// The button's gap from the left edge; a button on the right mirrors it.
export const FAB_LEFT = space.md;

// How far a screen's top row starts from the left, to clear the button.
export const FAB_INSET = space.md + SIZE + space.sm;
// Where the button's middle sits, so a screen can line its title up with it.
export const FAB_CENTER_Y = TOP + SIZE / 2;
// Where the button ends, so the side rail can start below it.
export const FAB_BOTTOM = TOP + SIZE;

type MenuFabProps = {
  // Unread messages across every parea.
  unread: number;
  onPress: () => void;
  // Extra room above, for a screen whose title sits lower.
  drop?: number;
};

// The way into the side rail, from any screen: a white button that floats over
// the top-left corner and stays put while the page scrolls under it. Each
// screen's top row starts at FAB_INSET so nothing hides behind it.
export default function MenuFab({ unread, onPress, drop = 0 }: MenuFabProps) {
  return (
    <SafeAreaView style={styles.dock} pointerEvents="box-none">
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={unread > 0 ? `Open the side rail, ${unread} unread` : 'Open the side rail'}
        hitSlop={4}
        style={({ pressed }) => [styles.fab, { marginTop: TOP + drop }, pressed && styles.pressed]}
      >
        {/* Three lines, the middle one short. */}
        <View style={styles.lines}>
          <View style={styles.line} />
          <View style={[styles.line, styles.lineShort]} />
          <View style={styles.line} />
        </View>
        {unread > 0 ? (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{unread > 99 ? '99+' : unread}</Text>
          </View>
        ) : null}
      </Pressable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  dock: { position: 'absolute', top: 0, left: 0 },
  fab: {
    width: SIZE,
    height: SIZE,
    marginLeft: FAB_LEFT,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    shadowColor: colors.ink,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 4,
  },
  pressed: { opacity: 0.7, transform: [{ scale: 0.96 }] },
  lines: { width: 16, gap: 4 },
  line: { height: 2, borderRadius: 1, backgroundColor: colors.text },
  lineShort: { width: 10 },
  badge: {
    position: 'absolute',
    top: -5,
    right: -5,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 5,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.danger,
    borderWidth: 2,
    borderColor: colors.bg,
  },
  badgeText: { color: '#FFFFFF', ...typo.display, fontSize: 10 },
});
