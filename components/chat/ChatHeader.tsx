import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Monogram from '../general/Monogram';
import { FAB_CENTER_Y, FAB_INSET } from '../general/MenuFab';
import { presenceLabel } from './typing';
import { colors, radius, space, textSize, typo } from '../../theme';

const BUTTON = 44;
const NAME_ROW = 32;
const FADE = 22;
// Sun text dark enough for small type on the page (4.5:1).
const SUN_TEXT = '#8A5300';

type ChatHeaderProps = {
  name: string;
  avatarUrl?: string | null;
  memberCount: number;
  online: number;
  // "Nikos is typing…", in place of the kicker while it lasts.
  typing?: string | null;
  // "Reconnecting…" while the chat is not live; it wins over typing.
  connection?: string | null;
  // Where Back goes: "Close chat, back to MVPS".
  backLabel: string;
  onBack: () => void;
  onSearch: () => void;
  onOpenGroup: () => void;
};

// The chat reads like another page of Home: no bar, a white back button where
// the menu button always is, the squad's name and a kicker under it. The
// messages fade out under it as they scroll up.
export default function ChatHeader({
  name,
  avatarUrl,
  memberCount,
  online,
  typing = null,
  connection = null,
  backLabel,
  onBack,
  onSearch,
  onOpenGroup,
}: ChatHeaderProps) {
  const presence = presenceLabel(memberCount, online);
  const kicker = connection ? `Chat · ${connection}` : typing ? typing : `Chat · ${presence}`;

  return (
    <View style={styles.header}>
      <View style={styles.row}>
        <Pressable
          onPress={onBack}
          accessibilityRole="button"
          accessibilityLabel={backLabel}
          hitSlop={4}
          style={({ pressed }) => [styles.back, pressed && styles.backPressed]}
        >
          <Ionicons name="chevron-back" size={22} color={colors.text} />
        </Pressable>

        <Pressable
          onPress={onOpenGroup}
          accessibilityRole="button"
          accessibilityLabel={`${name}, ${presence}. Open the squad page`}
          style={({ pressed }) => [styles.squad, pressed && styles.pressed]}
        >
          <View style={styles.nameRow}>
            <Monogram name={name} uri={avatarUrl} size={30} />
            <Text style={styles.name} numberOfLines={1}>
              {name}
            </Text>
            <Ionicons name="chevron-forward" size={16} color={colors.textSoft} />
          </View>
          <Text
            style={[styles.kicker, !!typing && !connection && styles.kickerLive, !!connection && styles.kickerWarn]}
            numberOfLines={1}
            accessibilityLiveRegion="polite"
          >
            {kicker}
          </Text>
        </Pressable>

        <Pressable
          onPress={onSearch}
          accessibilityRole="button"
          accessibilityLabel="Search messages"
          style={({ pressed }) => [styles.search, pressed && styles.searchPressed]}
        >
          <Ionicons name="search" size={22} color={colors.text} />
        </Pressable>
      </View>

      <LinearGradient
        colors={[colors.bg, `${colors.bg}00`]}
        style={styles.fade}
        pointerEvents="none"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  // Above the list, so the fade lies over the messages.
  header: { zIndex: 1, backgroundColor: colors.bg },
  // The back button sits exactly where MenuFab's does on every other screen.
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingTop: FAB_CENTER_Y - BUTTON / 2,
    paddingLeft: space.md,
    paddingRight: space.sm + 2,
    paddingBottom: space.xs,
  },
  back: {
    width: BUTTON,
    height: BUTTON,
    marginRight: FAB_INSET - space.md - BUTTON,
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
  backPressed: { opacity: 0.7, transform: [{ scale: 0.96 }] },
  // The name lines up with the back button's middle, as HomeHeader's does.
  squad: {
    flex: 1,
    minWidth: 0,
    minHeight: BUTTON,
    paddingTop: (BUTTON - NAME_ROW) / 2,
    paddingRight: space.xs,
    borderRadius: radius.sm,
  },
  pressed: { opacity: 0.7 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: space.xs, height: NAME_ROW },
  name: { flexShrink: 1, color: colors.text, ...typo.display, fontSize: textSize.heading, letterSpacing: -0.4 },
  kicker: {
    marginTop: 1,
    color: colors.textSoft,
    ...typo.mono,
    fontSize: textSize.caption,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  kickerLive: { color: colors.primary },
  kickerWarn: { color: SUN_TEXT },
  search: {
    width: BUTTON,
    height: BUTTON,
    borderRadius: BUTTON / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchPressed: { backgroundColor: colors.surfaceAlt },
  fade: { position: 'absolute', left: 0, right: 0, top: '100%', height: FADE },
});
