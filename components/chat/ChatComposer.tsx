import { useState, type ReactElement } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Image, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import type { LocalImage } from './messageRows';
import { applyMention, matchMembers, mentionQuery } from './mentions';
import type { Person } from '../../lib/people';
import { GroupMonogram } from './GroupPicker';
import { colors, paper, typo, radius, space } from '../../theme';

type ChatComposerProps = {
  onSend: (text: string) => void;
  placeholder?: string;
  disabled?: boolean;
  initialText?: string;
  editing?: boolean;
  replyTo?: { senderName: string; content: string; deleted: boolean } | null;
  onCancel?: () => void;
  onTyping?: () => void;
  members?: Person[];
  meId?: string;
  attachment?: LocalImage | null;
  onClearImage?: () => void;
  // The + on the left: opens the tray (photo, plan, question) in place of the
  // keyboard. Focusing the field closes it again (onFocusInput).
  trayOpen?: boolean;
  onToggleTray?: () => void;
  onFocusInput?: () => void;
  autoFocus?: boolean;
};

type Dismissed = { at: number; query: string };

export default function ChatComposer({
  onSend,
  placeholder = 'Message the squad',
  disabled = false,
  initialText = '',
  editing = false,
  replyTo = null,
  onCancel,
  onTyping,
  members,
  meId,
  attachment = null,
  onClearImage,
  trayOpen = false,
  onToggleTray,
  onFocusInput,
  autoFocus = false,
}: ChatComposerProps) {
  const inputRef = useRef<TextInput>(null);
  const turn = useRef(new Animated.Value(trayOpen ? 1 : 0)).current;

  // The + turns into an x while the tray is open.
  useEffect(() => {
    Animated.timing(turn, {
      toValue: trayOpen ? 1 : 0,
      duration: 220,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: Platform.OS !== 'web',
    }).start();
  }, [trayOpen, turn]);

  function toggleTray() {
    if (!trayOpen) {
      // The tray takes the keyboard's place, never both at once.
      inputRef.current?.blur();
      Keyboard.dismiss();
    }
    onToggleTray?.();
  }

  const [text, setText] = useState(initialText);
  const [focused, setFocused] = useState(false);
  const [cursor, setCursor] = useState(initialText.length);
  const [forcedCursor, setForcedCursor] = useState<number | null>(null);
  const [dismissed, setDismissed] = useState<Dismissed | null>(null);
  const [active, setActive] = useState(0);

  const trimmed = text.trim();
  const canSend = (trimmed.length > 0 || attachment !== null) && !disabled;

  const found = disabled ? null : mentionQuery(text, cursor);

  const hushed =
    found !== null &&
    dismissed !== null &&
    found.at === dismissed.at &&
    found.query.startsWith(dismissed.query);

  const suggestions =
    found && !hushed && members && members.length > 0
      ? matchMembers(members, found.query, meId)
      : [];

  const picking = suggestions.length > 0;
  const highlighted = Math.min(active, suggestions.length - 1);

  function pick(member: Person) {
    if (!found) {
      return;
    }

    const next = applyMention(text, found, member);
    setText(next.text);
    setCursor(next.cursor);
    setForcedCursor(next.cursor);
    setDismissed({ at: found.at, query: next.text.slice(found.at + 1, next.cursor) });
    setActive(0);
  }

  function closeList() {
    if (found) {
      setDismissed({ at: found.at, query: found.query });
    }
  }

  function handleSend() {
    if (!canSend) return;

    onSend(trimmed);
    setText('');
    setCursor(0);
    setDismissed(null);
    setActive(0);
  }

  function handleKeyPress(event: any) {
    if (Platform.OS !== 'web') {
      return;
    }

    const key = event.key ?? event.nativeEvent?.key;
    const withShift = event.shiftKey ?? event.nativeEvent?.shiftKey;
    const composing = event.nativeEvent?.isComposing === true;

    if (picking && !composing) {
      if (key === 'Enter' && !withShift) {
        event.preventDefault();
        pick(suggestions[highlighted]);
        return;
      }
      if (key === 'ArrowDown') {
        event.preventDefault();
        setActive((highlighted + 1) % suggestions.length);
        return;
      }
      if (key === 'ArrowUp') {
        event.preventDefault();
        setActive((highlighted - 1 + suggestions.length) % suggestions.length);
        return;
      }
      if (key === 'Escape') {
        event.preventDefault();
        closeList();
        return;
      }
    }

    if (key === 'Enter' && !withShift && !composing) {
      event.preventDefault();
      handleSend();
    }

    if (key === 'Escape' && (editing || replyTo) && onCancel) {
      event.preventDefault();
      onCancel();
    }
  }

  // What the next message is about, above the tear: an edit, a reply, a photo.
  const banners: ReactElement[] = [];
  if (editing) {
    banners.push(
      <Banner
        key="edit"
        icon="pencil"
        kicker="Editing your message"
        body={initialText}
        closeLabel="Cancel edit"
        onClose={onCancel}
      />,
    );
  } else if (replyTo) {
    banners.push(
      <Banner
        key="reply"
        icon="arrow-undo"
        kicker={`Replying to ${replyTo.senderName || 'someone'}`}
        body={replyTo.deleted ? 'Message deleted' : replyTo.content}
        closeLabel="Cancel reply"
        onClose={onCancel}
      />,
    );
  }
  if (attachment) {
    banners.push(
      <View key="photo" style={styles.banner}>
        <View style={styles.bannerText}>
          <View style={styles.photoRow}>
            <Image source={{ uri: attachment.uri }} style={styles.thumb} />
            <Text style={styles.photoLabel} numberOfLines={1}>
              Photo ready to send
            </Text>
          </View>
        </View>
        <CloseButton label="Remove photo" onPress={onClearImage} />
      </View>,
    );
  }

  return (
    <View style={styles.bar}>
      {/* The messages fade out into the composer. */}
      <LinearGradient colors={[`${paper.bg}00`, paper.bg]} style={styles.fade} pointerEvents="none" />

      {picking ? (
        <View style={styles.picker}>
          <ScrollView
            keyboardShouldPersistTaps="always"
            showsVerticalScrollIndicator={false}
            style={styles.pickerScroll}
          >
            {suggestions.map(function (member, index) {
              return (
                <Pressable
                  key={member.id}
                  onPress={function () {
                    pick(member);
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={'Mention ' + member.name}
                  style={function ({ pressed }) {
                    return [
                      styles.suggestion,
                      index > 0 && styles.suggestionDivider,
                      index === highlighted && styles.suggestionActive,
                      pressed && styles.pressed,
                    ];
                  }}
                >
                  <GroupMonogram name={member.name} uri={member.avatarUrl} size={28} />
                  <Text style={styles.suggestionName} numberOfLines={1}>
                    {member.name}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      ) : null}

      {/* A white ticket: what it is about above a tear, the field below. */}
      <View style={[styles.ticket, focused && styles.ticketFocused]}>
        <View style={styles.ticketInner}>
          {banners.length > 0 ? (
            <>
              {banners}
              <Tear />
            </>
          ) : null}

          <View style={styles.box}>
            {onPickImage && !editing ? (
              <Pressable
                onPress={onPickImage}
                disabled={disabled}
                accessibilityRole="button"
                accessibilityLabel="Add a photo"
                style={function ({ pressed }) {
                  return [styles.attach, pressed && styles.attachPressed];
                }}
              >
                <Ionicons name="image-outline" size={22} color={paper.inkSoft} />
              </Pressable>
            ) : null}
            <TextInput
              style={[styles.input, (editing || !onPickImage) && styles.inputAlone]}
              value={text}
              selection={forcedCursor === null ? undefined : { start: forcedCursor, end: forcedCursor }}
              onChangeText={function (next) {
                setText(next);
                const moved = next.length - text.length;
                setCursor(function (prev) {
                  return Math.max(0, Math.min(next.length, prev + moved));
                });
                if (next.length > text.length) {
                  onTyping?.();
                }
              }}
              onSelectionChange={function (event) {
                setCursor(event.nativeEvent.selection.start);
                setForcedCursor(null);
              }}
              onKeyPress={handleKeyPress}
              onFocus={function () {
                setFocused(true);
              }}
              onBlur={function () {
                setFocused(false);
              }}
              placeholder={placeholder}
              placeholderTextColor={paper.inkSoft}
              accessibilityLabel={placeholder}
              editable={!disabled}
              multiline
              // The web's textarea starts two rows tall; one, like the phones.
              numberOfLines={Platform.OS === 'web' ? 1 : undefined}
            />

            <Pressable
              onPress={handleSend}
              disabled={!canSend}
              accessibilityRole="button"
              accessibilityLabel={editing ? "Save edit" : "Send"}
              accessibilityState={{ disabled: !canSend }}
              style={styles.sendTarget}
            >
              {function ({ pressed }) {
                return (
                  <View style={[styles.send, canSend ? styles.sendReady : styles.sendIdle, pressed && canSend && styles.pressed]}>
                    <Ionicons
                      name={editing ? "checkmark" : "arrow-up"}
                      size={18}
                      color={canSend ? paper.onMine : paper.inkSoft}
                    />
                  </View>
                );
              }}
            </Pressable>
          </View>
        </View>
      </View>
    </View>
  );
}

function Banner({
  icon,
  kicker,
  body,
  closeLabel,
  onClose,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  kicker: string;
  body: string;
  closeLabel: string;
  onClose?: () => void;
}) {
  return (
    <View style={styles.banner}>
      <View style={styles.bannerText}>
        <View style={styles.kickerRow}>
          <Ionicons name={icon} size={13} color={paper.accent} />
          <Text style={styles.kicker} numberOfLines={1}>
            {kicker}
          </Text>
        </View>
        <Text style={styles.bannerBody} numberOfLines={1}>
          {body}
        </Text>
      </View>
      <CloseButton label={closeLabel} onPress={onClose} />
    </View>
  );
}

function CloseButton({ label, onPress }: { label: string; onPress?: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={function ({ pressed }) {
        return [styles.close, pressed && styles.pressed];
      }}
    >
      <Ionicons name="close" size={18} color={paper.inkSoft} />
    </Pressable>
  );
}

// The tear across the ticket, a half notch cut on each side.
function Tear() {
  return (
    <View style={styles.tear} pointerEvents="none">
      <View style={[styles.notch, styles.notchLeft]} />
      <View style={styles.tearDashes}>
        {Array.from({ length: TEAR_DASHES }, (_, i) => (
          <View key={i} style={styles.tearDash} />
        ))}
      </View>
      <View style={[styles.notch, styles.notchRight]} />
    </View>
  );
}

const TARGET = 44;
const SEND = 36;
const NOTCH = 14;
const TEAR_DASHES = 60;

const styles = StyleSheet.create({
  bar: {
    paddingHorizontal: space.sm + 2,
    paddingTop: space.xs,
    paddingBottom: space.sm,
    backgroundColor: paper.bg,
  },
  fade: { position: 'absolute', left: 0, right: 0, bottom: '100%', height: 18 },
  ticket: {
    borderRadius: 22,
    backgroundColor: paper.surface,
    borderWidth: 1,
    borderColor: paper.line,
    shadowColor: paper.ink,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.07,
    shadowRadius: 14,
    elevation: 3,
  },
  ticketFocused: { borderColor: colors.borderStrong },
  ticketInner: { borderRadius: 21, overflow: 'hidden' },
  box: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 2,
  },

  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    paddingLeft: 14,
    paddingTop: 2,
  },
  bannerText: { flex: 1, minWidth: 0, gap: 1 },
  kickerRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  kicker: {
    flexShrink: 1,
    color: paper.accent,
    ...typo.mono,
    fontSize: 10.5,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  bannerBody: { color: paper.inkSoft, ...typo.regular, fontSize: 14, lineHeight: 19 },
  photoRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  thumb: { width: 34, height: 34, borderRadius: 8, backgroundColor: paper.surfaceAlt },
  photoLabel: { flexShrink: 1, color: paper.ink, ...typo.semi, fontSize: 14 },
  close: { width: TARGET, height: TARGET, alignItems: 'center', justifyContent: 'center' },

  tear: { height: NOTCH, flexDirection: 'row', alignItems: 'center' },
  notch: {
    position: 'absolute',
    top: 0,
    width: NOTCH,
    height: NOTCH,
    borderRadius: NOTCH / 2,
    backgroundColor: paper.bg,
    borderWidth: 1,
    borderColor: paper.line,
  },
  notchLeft: { left: -NOTCH / 2 - 1 },
  notchRight: { right: -NOTCH / 2 - 1 },
  tearDashes: { flex: 1, flexDirection: 'row', gap: 4, height: 2, marginHorizontal: NOTCH, overflow: 'hidden' },
  tearDash: { width: 5, height: 2, borderRadius: 1, backgroundColor: colors.borderStrong },

  attach: {
    width: TARGET,
    height: TARGET,
    borderRadius: TARGET / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  attachPressed: { backgroundColor: paper.surfaceAlt },
  picker: {
    marginBottom: space.xs + 2,
    backgroundColor: paper.surface,
    borderWidth: 1,
    borderColor: paper.line,
    borderRadius: radius.md + 2,
    overflow: 'hidden',
    shadowColor: paper.ink,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.14,
    shadowRadius: 24,
    elevation: 6,
  },
  pickerScroll: { maxHeight: 4 * TARGET },
  suggestion: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    minHeight: TARGET,
    paddingHorizontal: 14,
  },
  suggestionDivider: { borderTopWidth: 1, borderTopColor: paper.line },
  suggestionActive: { backgroundColor: paper.accentSoft },
  suggestionName: {
    flex: 1,
    color: paper.ink,
    ...typo.semi,
    fontSize: 15,
  },
  input: {
    flex: 1,
    minWidth: 0,
    maxHeight: 112,
    minHeight: TARGET,
    paddingTop: 11,
    paddingBottom: 11,
    paddingHorizontal: 4,
    color: paper.ink,
    ...typo.regular,
    fontSize: 16,
    lineHeight: 22,
    outlineStyle: 'none',
  } as any,
  inputAlone: { paddingLeft: 14 },
  sendTarget: { width: TARGET, height: TARGET, alignItems: 'center', justifyContent: 'center' },
  send: {
    width: SEND,
    height: SEND,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendReady: { backgroundColor: paper.accent },
  sendIdle: { backgroundColor: paper.surfaceAlt },
  pressed: { opacity: 0.85 },
});
