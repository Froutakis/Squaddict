import { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { colors, font, radius, shadow, space } from '../../theme';

type ChatComposerProps = {
  /** Επιστρέφει false αν η αποστολή απέτυχε — τότε το κείμενο μένει στο πεδίο. */
  onSend: (text: string) => Promise<boolean>;
  placeholder?: string;
  disabled?: boolean;
};

export default function ChatComposer({
  onSend,
  placeholder = 'Message',
  disabled = false,
}: ChatComposerProps) {
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);

  const trimmed = text.trim();
  const canSend = trimmed.length > 0 && !sending && !disabled;

  async function handleSend() {
    if (!canSend) return;

    setSending(true);
    const sent = await onSend(trimmed);
    setSending(false);

    if (sent) setText('');
  }

  return (
    <View style={styles.bar}>
      <TextInput
        style={styles.input}
        value={text}
        onChangeText={setText}
        placeholder={placeholder}
        placeholderTextColor={colors.textFaint}
        editable={!disabled}
        multiline
      />

      <Pressable
        onPress={handleSend}
        disabled={!canSend}
        accessibilityRole="button"
        accessibilityLabel="Send"
        style={({ pressed }) => [
          styles.send,
          !canSend && styles.sendDisabled,
          pressed && canSend && styles.pressed,
        ]}
      >
        {sending ? (
          <ActivityIndicator size="small" color="#FFFFFF" />
        ) : (
          <Ionicons name="send" size={18} color="#FFFFFF" />
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: space.sm,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    backgroundColor: colors.bg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  input: {
    flex: 1,
    minHeight: 46,
    maxHeight: 120,
    paddingHorizontal: space.md,
    paddingVertical: 12,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.xl,
    color: colors.text,
    fontFamily: font.medium,
    fontSize: 15,
  },
  send: {
    width: 46,
    height: 46,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.button,
  },
  sendDisabled: { backgroundColor: colors.borderStrong, shadowOpacity: 0, elevation: 0 },
  pressed: { opacity: 0.85 },
});
