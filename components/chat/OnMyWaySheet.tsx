import { useEffect, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import type { MyEvent } from '../../services/serviceEvents';
import { startOnMyWay } from '../../services/serviceLiveLocation';
import { getCurrentCoords } from '../../services/serviceLocation';
import { errorText } from '../../lib/postgres';
import { shortPlace } from '../home/LineTicket';
import SheetHeader from '../general/SheetHeader';
import { brand, colors, radius, space, sun, textSize, typo } from '../../theme';

type OnMyWaySheetProps = {
  // Tonight's plan you are in on; null keeps the sheet closed.
  plan: MyEvent | null;
  onClose: () => void;
  // The card went into the chat.
  onShared: () => void;
};

// "On my way": one look at the plan, what the parea will see, and one button.
export default function OnMyWaySheet({ plan, onClose, onShared }: OnMyWaySheetProps) {
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (plan) {
      setSending(false);
      setError(null);
    }
  }, [plan?.id]);

  async function share() {
    if (!plan || sending) return;
    setSending(true);
    setError(null);
    try {
      // Nothing to share without your spot: ask for it before telling anyone.
      const here = await getCurrentCoords();
      if (!here.ok) {
        setError(
          here.reason === 'denied'
            ? 'Location is off for Squaddict. Turn it on in Settings to share your spot.'
            : "Couldn't find where you are. Try again in a moment.",
        );
        return;
      }
      await startOnMyWay(plan.id);
      onShared();
    } catch (problem) {
      setError(errorText(problem, "Couldn't tell the parea. Try again."));
    } finally {
      setSending(false);
    }
  }

  const when = plan?.startTime ? `Tonight · ${plan.startTime}` : 'Tonight';
  const where = shortPlace(plan?.placeLabel ?? plan?.location);

  return (
    <Modal visible={plan !== null} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={sending ? undefined : onClose}>
        <Pressable style={styles.sheet} onPress={() => {}} accessible={false}>
          <SheetHeader title="On my way" onClose={onClose} closeDisabled={sending} grabber />

          {plan ? (
            <View style={styles.plan} accessible accessibilityLabel={`${plan.title}. ${when}${where ? `. ${where}` : ''}. You're in`}>
              <Text style={styles.planKicker}>{when}</Text>
              <Text style={styles.planTitle} numberOfLines={2}>
                {plan.title}
              </Text>
              <Text style={styles.planLine} numberOfLines={1}>
                {[where, "you're in"].filter(Boolean).join(' · ')}
              </Text>
            </View>
          ) : null}

          <Text style={styles.body}>
            The parea sees where you are on the plan's map until you stop sharing, and the chat gets a card
            that says you're on your way. Squaddict keeps no record of where you were.
          </Text>

          {error ? (
            <View style={styles.error} accessibilityLiveRegion="polite">
              <Ionicons name="alert-circle" size={16} color={colors.danger} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          <Pressable
            onPress={share}
            disabled={sending}
            accessibilityRole="button"
            accessibilityLabel="Share my spot and tell the parea"
            accessibilityState={{ disabled: sending, busy: sending }}
            style={({ pressed }) => [styles.cta, pressed && styles.pressed]}
          >
            {sending ? (
              <ActivityIndicator color={colors.ink} />
            ) : (
              <>
                <Ionicons name="navigate" size={18} color={colors.ink} />
                <Text style={styles.ctaText}>Share and tell the parea</Text>
              </>
            )}
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: {
    paddingHorizontal: space.lg,
    paddingTop: space.sm,
    paddingBottom: space.xl,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    backgroundColor: colors.bg,
    gap: space.md,
  },
  pressed: { opacity: 0.85 },
  plan: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: radius.lg,
    backgroundColor: brand[0],
    gap: 2,
  },
  planKicker: {
    color: 'rgba(255,255,255,0.75)',
    ...typo.mono,
    fontSize: textSize.micro,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  planTitle: { color: colors.onInk, ...typo.display, fontSize: textSize.lead, lineHeight: 19 },
  planLine: { color: 'rgba(255,255,255,0.82)', ...typo.semi, fontSize: textSize.small },
  body: { color: colors.textSoft, ...typo.regular, fontSize: textSize.base, lineHeight: 20 },
  error: { flexDirection: 'row', gap: space.xs, alignItems: 'flex-start' },
  errorText: { flex: 1, color: colors.danger, ...typo.medium, fontSize: textSize.body, lineHeight: 18 },
  cta: {
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.xs + 2,
    borderRadius: radius.md + 2,
    backgroundColor: sun,
  },
  ctaText: { color: colors.ink, ...typo.display, fontSize: textSize.lead },
});
