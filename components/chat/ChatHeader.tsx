import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Monogram from '../general/Monogram';
import { FAB_CENTER_Y, FAB_INSET } from '../general/MenuFab';
import { presenceLabel } from './typing';
import { colors, radius, space, textSize, typo } from '../../theme';

const BUTTON = 44;
const NAME_ROW = 32;
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

// A white bar over the ticket-patterned chat: back where the menu button
// always is, the squad's face and name, and who is around under it.
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
  const kicker = connection ?? typing ?? presence;

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
          accessibilityLabel={`${name}, ${presence}. Open the parea page`}
          style={({ pressed }) => [styles.squad, pressed && styles.pressed]}
        >
          <View style={styles.nameRow}>
            <Monogram name={name} uri={avatarUrl} size={30} style={styles.face} />
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
    </View>
  );
}

const styles = StyleSheet.create({
  header: { zIndex: 1, backgroundColor: colors.surface },
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
  face: { borderRadius: 10 },
  name: { flexShrink: 1, color: colors.text, ...typo.bold, fontSize: 17, letterSpacing: -0.3 },
  kicker: { marginTop: 1, marginLeft: 30 + space.xs, color: colors.textFaint, ...typo.medium, fontSize: textSize.small },
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
});
