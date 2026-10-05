import { useEffect, useState, type ComponentProps } from 'react';
import { Ionicons } from '@expo/vector-icons';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { updateDisplayName } from '../../services/serviceUser';
import { deleteAccount } from '../../services/serviceAuth';
import { getExploreDefault, setExploreDefault } from '../events/EventPhotos';
import { APP_VERSION, SUPPORT_EMAIL } from '../../lib/config';
import { PRIVACY_SECTIONS, PRIVACY_UPDATED } from '../../lib/legal';
import { colors, radius, space, textSize, typo } from '../../theme';

type Page = 'main' | 'name' | 'privacy' | 'delete';
type Icon = ComponentProps<typeof Ionicons>['name'];

const CONFIRM_WORD = 'DELETE';

type SettingsSheetProps = {
  visible: boolean;
  userId: string;
  displayName: string;
  onClose: () => void;
  onNameChanged: (name: string) => void;
  onEditPhoto: () => void;
  onJoinWithCode: () => void;
  onSignOut: () => void;
};

export default function SettingsSheet({
  visible,
  userId,
  displayName,
  onClose,
  onNameChanged,
  onEditPhoto,
  onJoinWithCode,
  onSignOut,
}: SettingsSheetProps) {
  const [page, setPage] = useState<Page>('main');
  const [shareDefault, setShareDefault] = useState(false);
  const [name, setName] = useState(displayName);
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    setPage('main');
    setName(displayName);
    setConfirm('');
    setError(null);
    getExploreDefault().then(setShareDefault).catch(() => {});
  }, [visible, displayName]);

  function close() {
    if (!busy) onClose();
  }

  function go(next: Page) {
    setError(null);
    setPage(next);
  }

  async function saveName() {
    const trimmed = name.trim();
    if (trimmed.length < 2) {
      setError('Use at least 2 characters.');
      return;
    }
    if (trimmed === displayName) {
      go('main');
      return;
    }

    setBusy(true);
    setError(null);
    try {
      await updateDisplayName(userId, trimmed);
      onNameChanged(trimmed);
      go('main');
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : 'Could not save your name.');
    } finally {
      setBusy(false);
    }
  }

  async function removeAccount() {
    if (confirm.trim().toUpperCase() !== CONFIRM_WORD) {
      setError(`Type ${CONFIRM_WORD} to confirm.`);
      return;
    }

    setBusy(true);
    setError(null);
    try {
      await deleteAccount();
    } catch {
      setError('Could not delete your account. Check your connection and try again.');
      setBusy(false);
    }
  }

  function toggleShare(next: boolean) {
    setShareDefault(next);
    setExploreDefault(next).catch(() => {});
  }

  function header(title: string, back = true) {
    return (
      <View style={styles.head}>
        {back ? (
          <Pressable
            onPress={() => go('main')}
            disabled={busy}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Back to settings"
          >
            <Ionicons name="chevron-back" size={22} color={colors.text} />
          </Pressable>
        ) : null}
        <Text style={styles.title}>{title}</Text>
        <View style={styles.spacer} />
        <Pressable
          onPress={close}
          disabled={busy}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Close settings"
          style={styles.closeButton}
        >
          <Ionicons name="close" size={18} color={colors.text} />
        </Pressable>
      </View>
    );
  }

  function renderMain() {
    return (
      <>
        {header('Settings', false)}
        <ScrollView contentContainerStyle={styles.pageBody}>
          <View style={styles.group}>
            <Row icon="person-outline" label="Name" value={displayName} onPress={() => go('name')} />
            <Row
              icon="camera-outline"
              label="Profile photo"
              onPress={() => {
                onClose();
                onEditPhoto();
              }}
            />
            <Row
              icon="ticket-outline"
              label="Join with a code"
              onPress={() => {
                onClose();
                onJoinWithCode();
              }}
            />
          </View>

          <View style={styles.group}>
            <Row
              icon="notifications-outline"
              label="Notifications"
              hint="Opens your phone's settings"
              trailing="external"
              onPress={() => Linking.openSettings().catch(() => {})}
            />
            <View style={styles.row}>
              <Ionicons name="globe-outline" size={20} color={colors.text} />
              <View style={styles.rowText}>
                <Text style={styles.rowLabel}>Share photos to Explore</Text>
                <Text style={styles.rowHint}>Starting point when you add a photo to a public plan</Text>
              </View>
              <Switch
                value={shareDefault}
                onValueChange={toggleShare}
                accessibilityLabel="Share photos to Explore by default"
                trackColor={{ true: colors.primary, false: colors.border }}
              />
            </View>
          </View>

          <View style={styles.group}>
            <Row icon="shield-checkmark-outline" label="Privacy policy" onPress={() => go('privacy')} />
            <Row
              icon="chatbox-ellipses-outline"
              label="Send feedback"
              trailing="external"
              onPress={() =>
                Linking.openURL(`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent('Squaddict feedback')}`).catch(
                  () => {},
                )
              }
            />
          </View>

          <View style={styles.group}>
            <Row icon="log-out-outline" label="Sign out" trailing="none" onPress={onSignOut} />
            <Row icon="trash-outline" label="Delete account" danger trailing="none" onPress={() => go('delete')} />
          </View>

          <Text style={styles.version}>Squaddict {APP_VERSION}</Text>
        </ScrollView>
      </>
    );
  }

  function renderName() {
    return (
      <>
        {header('Your name')}
        <View style={styles.pageBody}>
          <Text style={styles.paragraph}>This is how your friends see you in chats and plans.</Text>
          <TextInput
            value={name}
            onChangeText={(text) => {
              setName(text);
              setError(null);
            }}
            autoFocus
            maxLength={40}
            editable={!busy}
            returnKeyType="done"
            onSubmitEditing={saveName}
            accessibilityLabel="Your name"
            style={styles.input}
            selectionColor={colors.primary}
          />
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Pressable
            onPress={saveName}
            disabled={busy}
            accessibilityRole="button"
            accessibilityLabel="Save name"
            style={({ pressed }) => [styles.primary, pressed && styles.pressed]}
          >
            {busy ? <ActivityIndicator color={colors.textOnBrand} /> : <Text style={styles.primaryText}>Save</Text>}
          </Pressable>
        </View>
      </>
    );
  }

  function renderPrivacy() {
    return (
      <>
        {header('Privacy policy')}
        <ScrollView contentContainerStyle={styles.pageBody}>
          <Text style={styles.updated}>Last updated {PRIVACY_UPDATED}</Text>
          {PRIVACY_SECTIONS.map((section) => (
            <View key={section.title} style={styles.section}>
              <Text style={styles.sectionTitle}>{section.title}</Text>
              <Text style={styles.paragraph}>{section.body}</Text>
            </View>
          ))}
        </ScrollView>
      </>
    );
  }

  function renderDelete() {
    const ready = confirm.trim().toUpperCase() === CONFIRM_WORD;

    return (
      <>
        {header('Delete account')}
        <View style={styles.pageBody}>
          <View style={styles.warning}>
            <Ionicons name="warning-outline" size={20} color={colors.danger} />
            <Text style={styles.warningText}>This can't be undone.</Text>
          </View>
          <Text style={styles.paragraph}>
            Your login, profile photo, photos, answers and memberships are removed for good. Messages you sent
            stay in your friends' chats as "Deleted user".
          </Text>
          <Text style={styles.label}>Type {CONFIRM_WORD} to confirm</Text>
          <TextInput
            value={confirm}
            onChangeText={(text) => {
              setConfirm(text);
              setError(null);
            }}
            autoCapitalize="characters"
            autoCorrect={false}
            editable={!busy}
            accessibilityLabel={`Type ${CONFIRM_WORD} to confirm`}
            style={styles.input}
            selectionColor={colors.danger}
          />
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Pressable
            onPress={removeAccount}
            disabled={busy}
            accessibilityRole="button"
            accessibilityLabel="Delete my account"
            accessibilityState={{ disabled: !ready || busy }}
            style={({ pressed }) => [
              styles.primary,
              styles.danger,
              !ready && styles.dim,
              pressed && styles.pressed,
            ]}
          >
            {busy ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.primaryText}>Delete my account</Text>
            )}
          </Pressable>
        </View>
      </>
    );
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={close}>
      {/* On iOS the keyboard would cover the fields; the sheet rises above it. */}
      <KeyboardAvoidingView style={styles.keyboard} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable style={styles.backdrop} onPress={close}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            <View style={styles.grabber} />
            {page === 'main'
              ? renderMain()
              : page === 'name'
                ? renderName()
                : page === 'privacy'
                  ? renderPrivacy()
                  : renderDelete()}
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

type RowProps = {
  icon: Icon;
  label: string;
  value?: string;
  hint?: string;
  danger?: boolean;
  trailing?: 'chevron' | 'external' | 'none';
  onPress: () => void;
};

function Row({ icon, label, value, hint, danger = false, trailing = 'chevron', onPress }: RowProps) {
  const tint = danger ? colors.danger : colors.text;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={value ? `${label}, ${value}` : label}
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
    >
      <Ionicons name={icon} size={20} color={tint} />
      <View style={styles.rowText}>
        <Text style={[styles.rowLabel, { color: tint }]}>{label}</Text>
        {hint ? <Text style={styles.rowHint}>{hint}</Text> : null}
      </View>
      {value ? (
        <Text style={styles.rowValue} numberOfLines={1}>
          {value}
        </Text>
      ) : null}
      {trailing === 'chevron' ? <Ionicons name="chevron-forward" size={17} color={colors.textFaint} /> : null}
      {trailing === 'external' ? <Ionicons name="open-outline" size={16} color={colors.textFaint} /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  keyboard: { flex: 1 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: {
    maxHeight: '90%',
    minHeight: '55%',
    paddingTop: space.sm,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    backgroundColor: colors.bg,
  },
  grabber: {
    width: 40,
    height: 4,
    alignSelf: 'center',
    marginBottom: space.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.borderStrong,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    paddingHorizontal: space.lg,
    paddingBottom: space.sm,
  },
  title: { color: colors.text, ...typo.display, fontSize: textSize.heading, letterSpacing: -0.3 },
  spacer: { flex: 1 },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  pageBody: { paddingHorizontal: space.lg, paddingBottom: space.xl, gap: space.sm },

  group: { borderRadius: radius.lg, backgroundColor: colors.surface, overflow: 'hidden' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    minHeight: 50,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  rowPressed: { backgroundColor: colors.surfaceAlt },
  rowText: { flex: 1, minWidth: 0, gap: 1 },
  rowLabel: { color: colors.text, ...typo.medium, fontSize: textSize.base },
  rowHint: { color: colors.textFaint, ...typo.medium, fontSize: textSize.caption },
  rowValue: { maxWidth: 140, color: colors.textSoft, ...typo.medium, fontSize: textSize.body },
  version: {
    marginTop: space.xs,
    textAlign: 'center',
    color: colors.textFaint,
    ...typo.mono,
    fontSize: textSize.caption,
  },

  paragraph: { color: colors.textSoft, ...typo.medium, fontSize: textSize.body, lineHeight: 20 },
  label: { marginTop: space.xs, color: colors.text, ...typo.semi, fontSize: textSize.body },
  input: {
    height: 48,
    paddingHorizontal: space.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    color: colors.text,
    ...typo.medium,
    fontSize: 16,
  },
  error: { color: colors.danger, ...typo.medium, fontSize: textSize.body },
  primary: {
    height: 48,
    marginTop: space.xs,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
  },
  primaryText: { color: '#FFFFFF', ...typo.semi, fontSize: textSize.base },
  danger: { backgroundColor: colors.danger },
  dim: { opacity: 0.45 },
  pressed: { opacity: 0.75 },

  updated: { color: colors.textFaint, ...typo.mono, fontSize: textSize.caption },
  section: { gap: 4, marginTop: space.xs },
  sectionTitle: { color: colors.text, ...typo.semi, fontSize: textSize.base },
  warning: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  warningText: { color: colors.danger, ...typo.semi, fontSize: textSize.base },
});
