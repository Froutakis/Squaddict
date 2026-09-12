import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { Group } from '../../services/serviceGroup';
import { colors, radius, space, textSize, tracking, typo } from '../../theme';
import Monogram from '../general/Monogram';

type ShareToSquadSheetProps = {
  visible: boolean;
  groups: Group[];
  eventTitle: string;
  savingId?: string | null;
  sharedIds?: string[];
  onPick: (groupId: string) => void;
  onClose: () => void;
};

export default function ShareToSquadSheet({
  visible,
  groups,
  eventTitle,
  savingId = null,
  sharedIds = [],
  onPick,
  onClose,
}: ShareToSquadSheetProps) {
  const shared = new Set(sharedIds);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          <View style={styles.grabber} />

          <Text style={styles.title}>Share to a parea</Text>
          <Text style={styles.sub} numberOfLines={2}>
            {eventTitle} lands on their board. Everyone answers for themselves.
          </Text>

          {groups.length === 0 ? (
            <Text style={styles.empty}>You are not in a parea yet.</Text>
          ) : (
            <ScrollView style={styles.list} contentContainerStyle={styles.listBody}>
              {groups.map(function (group) {
                const already = shared.has(group.id);
                const busy = savingId === group.id;

                return (
                  <Pressable
                    key={group.id}
                    onPress={() => onPick(group.id)}
                    disabled={already || savingId !== null}
                    accessibilityRole="button"
                    accessibilityLabel={
                      already ? `${group.name}, already shared` : `Share to ${group.name}`
                    }
                    accessibilityState={{ disabled: already || savingId !== null }}
                    style={({ pressed }) => [styles.row, pressed && !already ? styles.pressed : null]}
                  >
                    <Monogram name={group.name} size={36} />

                    <View style={styles.rowText}>
                      <Text style={styles.name} numberOfLines={1}>
                        {group.name}
                      </Text>
                      <Text style={styles.members}>
                        {group.memberCount === 1 ? '1 member' : `${group.memberCount} members`}
                      </Text>
                    </View>

                    {busy ? (
                      <ActivityIndicator color={colors.primary} />
                    ) : already ? (
                      <Ionicons name="checkmark" size={18} color={colors.success} />
                    ) : (
                      <Ionicons name="chevron-forward" size={16} color={colors.textFaint} />
                    )}
                  </Pressable>
                );
              })}
            </ScrollView>
          )}

          <Pressable
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Close"
            style={({ pressed }) => [styles.cancel, pressed && styles.pressed]}
          >
            <Text style={styles.cancelText}>Cancel</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(4,8,16,0.55)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.bg,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingHorizontal: space.lg,
    paddingBottom: space.xl,
    paddingTop: space.sm,
    maxHeight: '78%',
  },
  grabber: {
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.borderStrong,
    alignSelf: 'center',
    marginBottom: space.md,
  },

  title: { color: colors.text, ...typo.title, fontSize: textSize.heading, letterSpacing: tracking.title },
  sub: {
    marginTop: space.xxs,
    color: colors.textSoft,
    ...typo.medium,
    fontSize: textSize.base,
    lineHeight: 20,
  },

  list: { marginTop: space.md },
  listBody: { gap: space.xs },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    padding: space.sm,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pressed: { opacity: 0.7 },
  rowText: { flex: 1, minWidth: 0 },
  name: { color: colors.text, ...typo.semi, fontSize: textSize.base },
  members: { marginTop: 1, color: colors.textFaint, ...typo.mono, fontSize: textSize.caption },

  empty: {
    marginTop: space.md,
    color: colors.textFaint,
    ...typo.medium,
    fontSize: textSize.base,
  },

  cancel: { alignSelf: 'center', marginTop: space.md, paddingVertical: space.xs },
  cancelText: { color: colors.textSoft, ...typo.semi, fontSize: textSize.base },
});
