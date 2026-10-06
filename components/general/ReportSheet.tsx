import { useEffect, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Modal, Pressable, SafeAreaView, StyleSheet, Switch, Text, View } from 'react-native';
import { blockUser, isBlocked, reportContent, type ReportTarget } from '../../services/serviceSafety';
import { colors, layout, radius, scrim, space, textSize, typo } from '../../theme';

const REASONS = [
  'Harassment or hate',
  'Nudity or sexual content',
  'Violence or threats',
  'Spam or a scam',
  'Someone in a photo without agreeing',
  'Something else',
];

type ReportSheetProps = {
  // What is being reported; null keeps the sheet closed.
  target: ReportTarget | null;
  // The current user, so you never block yourself.
  userId: string;
  onClose: () => void;
  // Told when the author was blocked, so the screen can hide their things now.
  onBlocked?: (userId: string) => void;
};

// Report something, and block its author if you want to: a reason, one switch,
// one button. Reports are read and acted on within 24 hours (see the terms).
export default function ReportSheet({ target, userId, onClose, onBlocked }: ReportSheetProps) {
  const [reason, setReason] = useState<string | null>(null);
  const [block, setBlock] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  // Each new target starts clean.
  useEffect(() => {
    setReason(null);
    setBlock(false);
    setSending(false);
    setError(null);
    setDone(false);
  }, [target?.kind, target?.id]);

  if (!target) return null;
  const current = target;

  const person = current.userId && current.userId !== userId ? current.userId : null;
  const name = current.userName?.trim() || 'this person';
  const alreadyBlocked = isBlocked(person);

  async function send() {
    if (!reason) {
      setError('Pick what is wrong first.');
      return;
    }
    setSending(true);
    setError(null);
    try {
      await reportContent(current, reason);
      if (block && person && !alreadyBlocked) {
        await blockUser(person);
        onBlocked?.(person);
      }
      setDone(true);
    } catch {
      setError('Could not send the report. Check your connection and try again.');
    } finally {
      setSending(false);
    }
  }

  return (
    <Modal transparent visible animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close">
        <Pressable style={styles.sheet} accessibilityViewIsModal>
          {/* The safe area lifts it over the home bar; the body keeps its own padding. */}
          <SafeAreaView>
          <View style={styles.body}>
          <View style={styles.grab} />

          {done ? (
            <View style={styles.done}>
              <Ionicons name="shield-checkmark" size={30} color={colors.primary} />
              <Text style={[styles.title, styles.centered]}>Thanks for telling us</Text>
              <Text style={[styles.lead, styles.centered]}>
                We look at every report within 24 hours.
                {block && person ? ` You won't see ${name}'s messages or photos any more.` : ''}
              </Text>
              <Pressable
                onPress={onClose}
                accessibilityRole="button"
                accessibilityLabel="Done"
                style={({ pressed }) => [styles.button, styles.stretch, pressed && styles.pressed]}
              >
                <Text style={styles.buttonText}>Done</Text>
              </Pressable>
            </View>
          ) : (
            <>
              <Text style={styles.title} accessibilityRole="header">
                Report
              </Text>
              <Text style={styles.lead} numberOfLines={2}>
                {current.label}
              </Text>

              <View style={styles.list} accessibilityRole="radiogroup">
                {REASONS.map((one, i) => {
                  const on = reason === one;
                  return (
                    <Pressable
                      key={one}
                      onPress={() => {
                        setReason(one);
                        setError(null);
                      }}
                      accessibilityRole="radio"
                      accessibilityState={{ checked: on }}
                      style={({ pressed }) => [styles.row, i > 0 && styles.rowRule, pressed && styles.rowPressed]}
                    >
                      <Text style={[styles.rowText, on && styles.rowTextOn]}>{one}</Text>
                      <Ionicons
                        name={on ? 'radio-button-on' : 'radio-button-off'}
                        size={20}
                        color={on ? colors.primary : colors.textFaint}
                      />
                    </Pressable>
                  );
                })}
              </View>

              {person ? (
                <View style={styles.blockRow}>
                  <View style={styles.blockText}>
                    <Text style={styles.rowText}>{alreadyBlocked ? `${name} is blocked` : `Also block ${name}`}</Text>
                    <Text style={styles.small}>Their messages and photos are hidden from you.</Text>
                  </View>
                  {alreadyBlocked ? null : (
                    <Switch
                      value={block}
                      onValueChange={setBlock}
                      accessibilityLabel={`Also block ${name}`}
                      trackColor={{ true: colors.primary, false: colors.border }}
                    />
                  )}
                </View>
              ) : null}

              {error ? (
                <Text style={styles.error} accessibilityLiveRegion="polite">
                  {error}
                </Text>
              ) : null}

              <Pressable
                onPress={send}
                disabled={sending}
                accessibilityRole="button"
                accessibilityLabel="Send report"
                accessibilityState={{ disabled: sending }}
                style={({ pressed }) => [styles.button, styles.danger, (pressed || sending) && styles.pressed]}
              >
                <Text style={styles.buttonText}>{sending ? 'Sending…' : 'Send report'}</Text>
              </Pressable>
            </>
          )}
          </View>
          </SafeAreaView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: scrim.sheet },
  sheet: {
    width: '100%',
    maxWidth: layout.column,
    alignSelf: 'center',
    backgroundColor: colors.bg,
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
  },
  body: { paddingHorizontal: space.md + 4, paddingBottom: space.xl },
  grab: { alignSelf: 'center', width: 38, height: 5, marginTop: 7, marginBottom: space.sm, borderRadius: 3, backgroundColor: colors.borderStrong },
  title: { color: colors.text, ...typo.display, fontSize: textSize.heading, letterSpacing: -0.5 },
  lead: { color: colors.textSoft, ...typo.medium, fontSize: textSize.base, lineHeight: 20, marginTop: 4 },
  list: { marginTop: space.md, backgroundColor: colors.surface, borderRadius: radius.lg, overflow: 'hidden' },
  row: { minHeight: 50, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm, paddingHorizontal: space.md },
  rowRule: { borderTopWidth: 1, borderTopColor: colors.border },
  rowPressed: { backgroundColor: colors.surfaceAlt },
  rowText: { color: colors.text, ...typo.semi, fontSize: textSize.lead, flexShrink: 1 },
  rowTextOn: { color: colors.primary },
  blockRow: {
    marginTop: space.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    padding: space.md,
    backgroundColor: colors.surface,
    borderRadius: radius.md + 2,
  },
  blockText: { flex: 1, gap: 2 },
  small: { color: colors.textSoft, ...typo.medium, fontSize: textSize.small },
  error: { color: colors.danger, ...typo.semi, fontSize: textSize.body, marginTop: space.sm },
  button: {
    marginTop: space.md,
    height: 50,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
  },
  danger: { backgroundColor: colors.danger },
  buttonText: { color: colors.onInk, ...typo.bold, fontSize: textSize.lead },
  pressed: { opacity: 0.7 },
  done: { alignItems: 'center', gap: space.xs, paddingTop: space.md },
  centered: { textAlign: 'center' },
  // In the centred Done column the button would shrink to its word.
  stretch: { alignSelf: 'stretch' },
});
