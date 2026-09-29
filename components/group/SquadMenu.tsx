import { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, space, textSize, typo } from '../../theme';

type SquadMenuProps = {
  visible: boolean;
  squadName: string;
  onClose: () => void;
  onEditLook: () => void;
  onInvite: () => void;
  onLeave: () => Promise<void>;
};

// The ⋯ sheet on a squad page: the things you do now and then.
export default function SquadMenu({ visible, squadName, onClose, onEditLook, onInvite, onLeave }: SquadMenuProps) {
  const [confirming, setConfirming] = useState(false);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    if (!visible) {
      setConfirming(false);
      setLeaving(false);
    }
  }, [visible]);

  async function leave() {
    setLeaving(true);
    try {
      await onLeave();
    } finally {
      setLeaving(false);
    }
  }

  function close() {
    if (!leaving) onClose();
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={close}>
      <Pressable style={styles.backdrop} onPress={close} accessibilityLabel="Close menu">
        <Pressable style={styles.sheet} onPress={() => {}}>
          <View style={styles.grabber} />

          {confirming ? (
            <View style={styles.confirm}>
              <Text style={styles.confirmTitle}>Leave {squadName}?</Text>
              <Text style={styles.confirmBody}>You can come back with an invite code.</Text>
              <Pressable
                onPress={leave}
                disabled={leaving}
                accessibilityRole="button"
                accessibilityLabel={`Leave ${squadName}`}
                style={({ pressed }) => [styles.leaveButton, pressed && styles.pressed]}
              >
                {leaving ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.leaveButtonText}>Leave squad</Text>
                )}
              </Pressable>
              <Pressable
                onPress={() => setConfirming(false)}
                disabled={leaving}
                accessibilityRole="button"
                accessibilityLabel="Cancel"
                style={({ pressed }) => [styles.cancel, pressed && styles.pressed]}
              >
                <Text style={styles.cancelText}>Cancel</Text>
              </Pressable>
            </View>
          ) : (
            <View style={styles.group}>
              <MenuRow icon="color-palette-outline" label="Edit look" onPress={onEditLook} />
              <MenuRow icon="person-add-outline" label="Invite people" onPress={onInvite} divider />
              <MenuRow
                icon="exit-outline"
                label="Leave squad"
                danger
                divider
                onPress={() => setConfirming(true)}
              />
            </View>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

type MenuRowProps = {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  danger?: boolean;
  divider?: boolean;
  onPress: () => void;
};

function MenuRow({ icon, label, danger = false, divider = false, onPress }: MenuRowProps) {
  const tint = danger ? colors.danger : colors.text;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [styles.row, divider && styles.divider, pressed && styles.rowPressed]}
    >
      <Ionicons name={icon} size={20} color={tint} />
      <Text style={[styles.rowText, { color: tint }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(6,14,22,0.42)' },
  sheet: {
    backgroundColor: colors.bg,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingHorizontal: space.md,
    paddingTop: space.xs,
    paddingBottom: space.xl,
  },
  grabber: {
    alignSelf: 'center',
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.borderStrong,
    marginBottom: space.md,
  },
  group: { backgroundColor: colors.surface, borderRadius: radius.lg, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingHorizontal: space.md, height: 54 },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  rowPressed: { backgroundColor: colors.surfaceAlt },
  rowText: { ...typo.medium, fontSize: textSize.lead },
  confirm: { gap: space.sm, alignItems: 'stretch' },
  confirmTitle: { color: colors.text, ...typo.bold, fontSize: textSize.heading, textAlign: 'center' },
  confirmBody: { color: colors.textSoft, ...typo.medium, fontSize: textSize.body, textAlign: 'center', marginBottom: space.xs },
  leaveButton: {
    height: 48,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.danger,
  },
  leaveButtonText: { color: '#FFFFFF', ...typo.semi, fontSize: textSize.base },
  cancel: { height: 48, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface },
  cancelText: { color: colors.text, ...typo.semi, fontSize: textSize.base },
  pressed: { opacity: 0.7 },
});
