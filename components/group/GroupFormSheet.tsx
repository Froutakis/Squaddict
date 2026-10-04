import { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { inviteCodeFrom } from '../../lib/invite';
import {
  createGroup,
  joinByInviteCode,
  normalizeHandle,
  HANDLE_PATTERN,
  type Group,
} from '../../services/serviceGroup';
import { colors, typo, radius, space } from '../../theme';
import AuthField from '../general/AuthField';
import Button from '../general/Button';
import SheetHeader from '../general/SheetHeader';

type Mode = 'create' | 'join';

const TABS: { key: Mode; label: string }[] = [
  { key: 'create', label: 'Create' },
  { key: 'join', label: 'Join' },
];

const HINTS: Record<Mode, string> = {
  create: 'The handle is permanent and unique. The name you can change later.',
  join: 'Ask someone already in the squad for its invite code.',
};

type GroupFormSheetProps = {
  visible: boolean;
  onClose: () => void;
  onDone: (group: Group) => void | Promise<void>;
  initialMode?: Mode;
};

export default function GroupFormSheet({
  visible,
  onClose,
  onDone,
  initialMode = 'create',
}: GroupFormSheetProps) {
  const [mode, setMode] = useState<Mode>(initialMode);
  const [name, setName] = useState('');
  const [handle, setHandle] = useState('');
  const [code, setCode] = useState('');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  // An invite code sitting on the clipboard, offered with one tap.
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;

    setMode(initialMode);
    setName('');
    setHandle('');
    setCode('');
    setSaving(false);
    setFormError(null);
    setCopied(null);
  }, [visible, initialMode]);

  useEffect(() => {
    if (!visible || mode !== 'join') return;

    let cancelled = false;
    Clipboard.getStringAsync()
      .then((text) => {
        if (!cancelled) setCopied(inviteCodeFrom(text));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [visible, mode]);

  function switchMode(next: Mode) {
    setMode(next);
    setFormError(null);
  }

  async function handleSave() {
    const groupName = name.trim();
    const cleanHandle = normalizeHandle(handle);
    const inviteCode = code.trim();

    if (mode === 'create' && !groupName) {
      setFormError('Give your squad a name.');
      return;
    }
    if (mode === 'create' && !HANDLE_PATTERN.test(cleanHandle)) {
      setFormError('A handle is 3-30 characters: a-z, 0-9 and _ only.');
      return;
    }
    if (mode === 'join' && !inviteCode) {
      setFormError('Enter the invite code.');
      return;
    }

    setSaving(true);
    setFormError(null);
    try {
      const group = mode === 'create'
        ? await createGroup(cleanHandle, groupName)
        : await joinByInviteCode(inviteCode);

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
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={function () {
        if (!saving) onClose();
      }}
    >
      <Pressable
        style={styles.backdrop}
        onPress={function () {
          if (!saving) onClose();
        }}
      >
        <Pressable style={styles.sheet} onPress={() => {}}>
          <SheetHeader title="New squad" onClose={onClose} closeDisabled={saving} grabber />

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
              <>
                <AuthField
                  label="Name"
                  icon="people-outline"
                  value={name}
                  onChangeText={setName}
                  placeholder="Mpala"
                  loading={saving}
                  onSubmit={handleSave}
                />
                <AuthField
                  label="Handle"
                  icon="at-outline"
                  value={handle}
                  onChangeText={(text) => setHandle(text.toLowerCase())}
                  placeholder="mvps"
                  loading={saving}
                  onSubmit={handleSave}
                />
              </>
            ) : (
              <AuthField
                label="Invite code"
                icon="key-outline"
                value={code}
                onChangeText={(text) => setCode(text.toUpperCase())}
                placeholder="7KQ2XM"
                loading={saving}
                onSubmit={handleSave}
              />
            )}

            {mode === 'join' && copied && copied !== code ? (
              <Pressable
                onPress={() => setCode(copied)}
                accessibilityRole="button"
                accessibilityLabel={`Paste invite code ${copied}`}
                style={({ pressed }) => [styles.paste, pressed && styles.pastePressed]}
              >
                <Ionicons name="clipboard-outline" size={15} color={colors.primary} />
                <Text style={styles.pasteText}>Paste {copied}</Text>
              </Pressable>
            ) : null}

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
  tabs: {
    flexDirection: 'row',
    gap: 4,
    padding: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceAlt,
  },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 9, borderRadius: radius.pill },
  tabActive: { backgroundColor: colors.surface },
  tabText: { color: colors.textSoft, ...typo.medium, fontSize: 14 },
  tabTextActive: { color: colors.primary, ...typo.semi },
  pressed: { opacity: 0.7 },
  hint: { color: colors.textSoft, ...typo.medium, fontSize: 14 },
  form: { gap: space.md, marginTop: space.xs },
  formError: { color: colors.danger, ...typo.medium, fontSize: 13 },
  paste: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    minHeight: 36,
    paddingHorizontal: space.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  pastePressed: { opacity: 0.6 },
  pasteText: { color: colors.primary, ...typo.semi, fontSize: 13 },
});
