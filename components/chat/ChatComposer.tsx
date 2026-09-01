import { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { paper, paperFont, radius, space } from '../../theme';

type ChatComposerProps = {
  onSend: (text: string) => void;
  placeholder?: string;
  disabled?: boolean;
};

export default function ChatComposer({
  onSend,
  placeholder = 'Message the squad',
  disabled = false,
}: ChatComposerProps) {
  const [text, setText] = useState('');
  const [focused, setFocused] = useState(false);

  const trimmed = text.trim();
  const canSend = trimmed.length > 0 && !disabled;

  function handleSend() {
    if (!canSend) return;

    onSend(trimmed);
    setText('');
  }

  function handleKeyPress(event: any) {
    if (Platform.OS !== 'web') {
      return;
    }

    const key = event.key ?? event.nativeEvent?.key;
    const withShift = event.shiftKey ?? event.nativeEvent?.shiftKey;
    const composing = event.nativeEvent?.isComposing === true;

    if (key === 'Enter' && !withShift && !composing) {
      event.preventDefault();
      handleSend();
    }
  }

  return (
    <View style={styles.bar}>
      <View style={[styles.box, focused && styles.boxFocused]}>
        <TextInput
          style={styles.input}
          value={text}
          onChangeText={setText}
          onKeyPress={handleKeyPress}
          onFocus={function () {
            setFocused(true);
          }}
          onBlur={function () {
            setFocused(false);
          }}
          placeholder={placeholder}
          placeholderTextColor={paper.inkFaint}
          editable={!disabled}
          multiline
        />

        <Pressable
          onPress={handleSend}
          disabled={!canSend}
          accessibilityRole="button"
          accessibilityLabel="Send"
          style={function ({ pressed }) {
            return [styles.send, canSend ? styles.sendReady : styles.sendIdle, pressed && canSend && styles.pressed];
          }}
        >
          <Ionicons
            name="arrow-up"
            size={17}
            color={canSend ? paper.onMine : paper.inkFaint}
          />
        </Pressable>
      </View>
    </View>
  );
}

const SEND = 30;

const styles = StyleSheet.create({
  bar: {
    paddingHorizontal: space.md,
    paddingTop: space.sm,
    paddingBottom: space.md,
    backgroundColor: paper.bg,
  },
  box: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: space.sm,
    paddingLeft: 14,
    paddingRight: 7,
    paddingVertical: 7,
    backgroundColor: paper.surface,
    borderWidth: 1,
    borderColor: paper.line,
    borderRadius: radius.xl,
  },
  boxFocused: { borderColor: paper.inkFaint },
  input: {
    flex: 1,
    maxHeight: 120,
    minHeight: SEND,
    paddingTop: 5,
    paddingBottom: 5,
    color: paper.ink,
    fontFamily: paperFont.regular,
    fontSize: 15,
    lineHeight: 21,
  },
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
