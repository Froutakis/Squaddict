import { Ionicons } from '@expo/vector-icons';
import { useRef, useState } from 'react';
import { Dimensions, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import type { Group } from '../../services/serviceGroup';
import { colors, radius, shadow, space, textSize, typo } from '../../theme';
import Monogram, { initialsFor } from './Monogram';

const MENU_WIDTH = 230;

type GroupSelectProps = {
  groups: Group[];
  groupId: string | null;
  onSelect: (groupId: string | null) => void;
  allLabel?: string;
  allAvatarLabel?: string;
};

export default function GroupSelect({
  groups,
  groupId,
  onSelect,
  allLabel = 'You',
  allAvatarLabel = '',
}: GroupSelectProps) {
  const [picker, setPicker] = useState(false);
  const [anchor, setAnchor] = useState({ top: 0, left: 0 });
  const trigger = useRef<View>(null);

  const active = groups.find((group) => group.id === groupId);
  const label = active ? active.name : allLabel;
  const avatarLabel = active ? active.name : allAvatarLabel || allLabel;

  function openPicker() {
    trigger.current?.measureInWindow((x, y, width, height) => {
      const maxLeft = Dimensions.get('window').width - MENU_WIDTH - space.md;
      setAnchor({ top: y + height + 6, left: Math.max(space.md, Math.min(x, maxLeft)) });
      setPicker(true);
    });
  }

  function choose(id: string | null) {
    onSelect(id);
    setPicker(false);
  }

  return (
    <>
      <Pressable
        ref={trigger}
        onPress={openPicker}
        disabled={groups.length === 0}
        accessibilityRole="button"
        accessibilityLabel="Filter by parea"
        accessibilityState={{ expanded: picker }}
        style={({ pressed }) => [styles.trigger, pressed && styles.pressed]}
      >
        <Monogram name={avatarLabel} initials={initialsFor(avatarLabel)} size={25} />

        <Text style={styles.triggerText} numberOfLines={1}>
          {label}
        </Text>

        {groups.length > 0 ? (
          <Ionicons
            name={picker ? 'chevron-up' : 'chevron-down'}
            size={18}
            color={colors.textSoft}
          />
        ) : null}
      </Pressable>

      <Modal
        visible={picker}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setPicker(false)}
      >
        <Pressable style={styles.backdrop} onPress={() => setPicker(false)}>
          <View style={[styles.menu, { top: anchor.top, left: anchor.left }]}>
            <Pressable
              onPress={() => choose(null)}
              accessibilityRole="button"
              accessibilityLabel={`${allLabel}, everything you are in`}
              style={({ pressed }) => [styles.row, pressed && styles.pressed]}
            >
              <Monogram
                name={allAvatarLabel || allLabel}
                initials={initialsFor(allAvatarLabel || allLabel)}
                size={24}
              />
              <Text style={styles.name}>{allLabel}</Text>
              {groupId === null ? (
                <Ionicons name="checkmark" size={16} color={colors.primary} />
              ) : null}
            </Pressable>

            {groups.map((group) => (
              <Pressable
                key={group.id}
                onPress={() => choose(group.id)}
                accessibilityRole="button"
                accessibilityLabel={group.name}
                style={({ pressed }) => [styles.row, pressed && styles.pressed]}
              >
                <Monogram name={group.name} size={24} />
                <Text style={styles.name} numberOfLines={1}>
                  {group.name}
                </Text>
                {groupId === group.id ? (
                  <Ionicons name="checkmark" size={16} color={colors.primary} />
                ) : null}
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  trigger: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  triggerText: {
    flexShrink: 1,
    color: colors.text,
    ...typo.display,
    fontSize: textSize.hero,
    letterSpacing: -0.5,
  },

  backdrop: { flex: 1, backgroundColor: 'rgba(12,25,38,0.18)' },
  menu: {
    position: 'absolute',
    width: MENU_WIDTH,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    overflow: 'hidden',
    ...shadow.button,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingHorizontal: space.md,
    paddingVertical: 11,
  },
  name: { flex: 1, color: colors.text, ...typo.medium, fontSize: textSize.base },

  pressed: { opacity: 0.7 },
});
