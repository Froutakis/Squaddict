import { Ionicons } from '@expo/vector-icons';
import type { Group } from '../../services/serviceGroup';
import { todayLabel } from '../../lib/datetime';
import GradientAvatar, { initialsFor } from '../general/GradientAvatar';
import { useRef, useState } from 'react';
import { Dimensions, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, font, radius, shadow, solidFor, space, textSize } from '../../theme';

const MENU_WIDTH = 230;

type HomeHeaderProps = {
  displayName: string;
  squads: Group[];
  squadId: string | null;
  onSquadSelect: (squadId: string | null) => void;
  onSignOut: () => void;
};

export default function HomeHeader({
  displayName,
  squads,
  squadId,
  onSquadSelect,
  onSignOut,
}: HomeHeaderProps) {
  const [open, setOpen] = useState(false);
  const [picker, setPicker] = useState(false);
  const [anchor, setAnchor] = useState({ top: 0, left: 0 });
  const trigger = useRef<View>(null);

  const active = squads.find((group) => group.id === squadId);
  const squadLabel = active ? active.name : 'All squads';

  function openPicker() {
    setOpen(false);

    trigger.current?.measureInWindow((x, y, width, height) => {
      const maxLeft = Dimensions.get('window').width - MENU_WIDTH - space.md;
      setAnchor({ top: y + height + 6, left: Math.max(space.md, Math.min(x, maxLeft)) });
      setPicker(true);
    });
  }

  function choose(id: string | null) {
    onSquadSelect(id);
    setPicker(false);
  }

  return (
    <View>
      <View style={styles.header}>
        <View style={styles.text}>
          <Text style={styles.date}>{todayLabel()}</Text>

          <Pressable
            ref={trigger}
            onPress={openPicker}
            disabled={squads.length === 0}
            accessibilityRole="button"
            accessibilityLabel="Select squad"
            accessibilityState={{ expanded: picker }}
            style={({ pressed }) => [styles.picker, pressed && styles.pressed]}
          >
            <Text style={styles.pickerText} numberOfLines={1}>
              {squadLabel}
            </Text>
            {squads.length > 0 ? (
              <Ionicons
                name={picker ? 'chevron-up' : 'chevron-down'}
                size={18}
                color={colors.textSoft}
              />
            ) : null}
          </Pressable>
        </View>

        {displayName.trim() !== '' ? (
          <Pressable
            onPress={() => {
              setPicker(false);
              setOpen((was) => !was);
            }}
            accessibilityRole="button"
            accessibilityLabel="Account"
            accessibilityState={{ expanded: open }}
            style={({ pressed }) => (pressed ? styles.pressed : null)}
          >
            <GradientAvatar
              label={displayName}
              initials={initialsFor(displayName)}
              size={40}
            />
          </Pressable>
        ) : null}
      </View>

      {open ? (
        <View style={styles.menu}>
          <Pressable
            onPress={onSignOut}
            accessibilityRole="button"
            accessibilityLabel="Sign out"
            style={({ pressed }) => [styles.signOut, pressed && styles.pressed]}
          >
            <Text style={styles.signOutText}>Sign out</Text>
          </Pressable>
        </View>
      ) : null}

      <Modal
        visible={picker}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setPicker(false)}
      >
        <Pressable style={styles.backdrop} onPress={() => setPicker(false)}>
          <View style={[styles.squadMenu, { top: anchor.top, left: anchor.left }]}>
            <Pressable
              onPress={() => choose(null)}
              accessibilityRole="button"
              accessibilityLabel="All squads"
              style={({ pressed }) => [styles.squadRow, pressed && styles.pressed]}
            >
              <View style={styles.allDot} />
              <Text style={styles.squadName}>All squads</Text>
              {squadId === null ? (
                <Ionicons name="checkmark" size={16} color={colors.primary} />
              ) : null}
            </Pressable>

            {squads.map((group) => (
              <Pressable
                key={group.id}
                onPress={() => choose(group.id)}
                accessibilityRole="button"
                accessibilityLabel={group.name}
                style={({ pressed }) => [styles.squadRow, pressed && styles.pressed]}
              >
                <View style={[styles.mono, { backgroundColor: solidFor(group.name) }]}>
                  <Text style={styles.monoText}>{initialsFor(group.name)}</Text>
                </View>
                <Text style={styles.squadName} numberOfLines={1}>
                  {group.name}
                </Text>
                {squadId === group.id ? (
                  <Ionicons name="checkmark" size={16} color={colors.primary} />
                ) : null}
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.sm,
    paddingHorizontal: space.lg,
    paddingTop: space.xs,
  },
  text: { flex: 1 },
  date: {
    color: colors.textFaint,
    fontFamily: font.mono,
    fontSize: textSize.caption,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },

  picker: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 3 },
  pickerText: {
    flexShrink: 1,
    color: colors.text,
    fontFamily: font.display,
    fontSize: textSize.hero,
    letterSpacing: -0.5,
  },

  backdrop: { flex: 1, backgroundColor: 'rgba(12,25,38,0.18)' },
  squadMenu: {
    position: 'absolute',
    width: MENU_WIDTH,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    overflow: 'hidden',
    ...shadow.button,
  },
  squadRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingHorizontal: space.md,
    paddingVertical: 11,
  },
  squadName: { flex: 1, color: colors.text, fontFamily: font.medium, fontSize: textSize.base },
  allDot: {
    width: 24,
    height: 24,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
  },
  mono: {
    width: 24,
    height: 24,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monoText: { color: '#FFFFFF', fontFamily: font.semi, fontSize: 9 },

  pressed: { opacity: 0.7 },
  menu: { alignItems: 'flex-end', paddingHorizontal: space.lg, paddingTop: space.xs },
  signOut: {
    height: 34,
    paddingHorizontal: 14,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  signOutText: { color: colors.danger, fontFamily: font.semi, fontSize: textSize.base },
});
