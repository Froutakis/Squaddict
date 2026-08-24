import { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { createGroup, joinByInviteCode, type Group } from '../../services/serviceGroup';
import { colors, font, radius, space } from '../../theme';
import AuthField from '../general/AuthField';
import Button from '../general/Button';

type Mode = 'create' | 'join';

const TABS: { key: Mode; label: string }[] = [
  { key: 'create', label: 'Create' },
  { key: 'join', label: 'Join' },
];

const HINTS: Record<Mode, string> = {
  create: 'Only members see the name. You can change it later.',
  join: 'Ask someone already in the squad for its handle.',
};

type GroupFormSheetProps = {
  visible: boolean;
  userId: string;
  onClose: () => void;
  onDone: (group: Group) => void | Promise<void>;
};

export default function GroupFormSheet({ visible, userId, onClose, onDone }: GroupFormSheetProps) {
  const [mode, setMode] = useState<Mode>('create');
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;

    setMode('create');
    setName('');
    setCode('');
    setSaving(false);
    setFormError(null);
  }, [visible]);

  function switchMode(next: Mode) {
    setMode(next);
    setFormError(null);
  }

  async function handleSave() {
    const squadName = name.trim();
    const inviteCode = code.trim();

    if (mode === 'create' && !squadName) {
      setFormError('Give your squad a name.');
      return;
    }
    if (mode === 'join' && !inviteCode) {
      setFormError('Enter the squad handle.');
      return;
    }

    setSaving(true);
    setFormError(null);
    try {
      const group = mode === 'create'
        ? await createGroup(squadName)
        : await joinByInviteCode(inviteCode, userId);

      await onDone(group);
      onClose();
    }
    catch (e) {
      if (e instanceof Error && mode === 'join') setFormError(e.message);
      else setFormError(mode === 'create' ? 'Could not create the squad. Try again.' : 'Could not join that squad. Try again.');
    }
    finally {
      setSaving(false);
    }
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          <View style={styles.grabber} />

          <Text style={styles.sheetTitle}>New squad</Text>

          <View style={styles.tabs}>
            {TABS.map((tab) => {
              const active = tab.key === mode;

              return (
                <Pressable
                  key={tab.key}
                  onPress={() => switchMode(tab.key)}
                  disabled={saving}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  accessibilityLabel={tab.label}
                  style={({ pressed }) => [styles.tab, active && styles.tabActive, pressed && styles.pressed]}
                >
                  <Text style={[styles.tabText, active && styles.tabTextActive]}>{tab.label}</Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={styles.hint}>{HINTS[mode]}</Text>

          <View style={styles.form}>
            {mode === 'create' ? (
              <AuthField
                label="Name"
                icon="people-outline"
                value={name}
                onChangeText={setName}
                placeholder="Mpala"
                loading={saving}
                onSubmit={handleSave}
              />
            ) : (
              <AuthField
                label="Squad handle"
                icon="key-outline"
                value={code}
                onChangeText={(text) => setCode(text.toLowerCase())}
                placeholder="mvps"
                loading={saving}
                onSubmit={handleSave}
              />
            )}

            {formError ? <Text style={styles.formError}>{formError}</Text> : null}

            <Button title={mode === 'create' ? 'Create' : 'Join'} onPress={handleSave} loading={saving} />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingHorizontal: space.lg,
    paddingTop: space.sm,
    paddingBottom: space.xl,
    gap: space.sm,
  },
  grabber: {
    width: 40,
    height: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.border,
    alignSelf: 'center',
    marginBottom: space.xs,
  },
  sheetTitle: { color: colors.text, fontFamily: font.bold, fontSize: 20 },
  tabs: {
    flexDirection: 'row',
    gap: 4,
    padding: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceAlt,
  },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 9, borderRadius: radius.pill },
  tabActive: { backgroundColor: colors.surface },
  tabText: { color: colors.textSoft, fontFamily: font.medium, fontSize: 14 },
  tabTextActive: { color: colors.primary, fontFamily: font.semi },
  pressed: { opacity: 0.7 },
  hint: { color: colors.textSoft, fontFamily: font.medium, fontSize: 14 },
  form: { gap: space.md, marginTop: space.xs },
  formError: { color: colors.danger, fontFamily: font.medium, fontSize: 13 },
});
