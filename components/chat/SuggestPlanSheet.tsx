import { useEffect, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { getFeed, type FeedEvent } from '../../services/serviceFeed';
import { suggestPlan } from '../../services/serviceSuggestions';
import { dateParts, weekdayShort } from '../../lib/datetime';
import { errorText } from '../../lib/postgres';
import { shortPlace } from '../home/LineTicket';
import SheetHeader from '../general/SheetHeader';
import { colors, radius, space, textSize, typo } from '../../theme';

type SuggestPlanSheetProps = {
  visible: boolean;
  groupId: string;
  groupName: string;
  // Plans this parea had suggested already: shown, not offered again.
  suggestedIds: string[];
  onClose: () => void;
  // The card went into the chat.
  onSuggested: () => void;
};

// "Suggest a plan" from the chat: another parea's public plan, the same ones
// Explore shows. It lands in the chat as a card; not a vote, everyone answers
// I'm in or Pass on their own.
export default function SuggestPlanSheet({
  visible,
  groupId,
  groupName,
  suggestedIds,
  onClose,
  onSuggested,
}: SuggestPlanSheetProps) {
  const [plans, setPlans] = useState<FeedEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [sending, setSending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    setError(null);

    getFeed({}, 0)
      .then(function (page) {
        if (cancelled) return;
        // Your own pareas' plans are yours already: only other pareas'.
        setPlans(page.events.filter((event) => !event.isMember && event.groupId !== groupId));
      })
      .catch(function () {
        if (!cancelled) setLoadError("Couldn't load the plans. Try again.");
      })
      .finally(function () {
        if (!cancelled) setLoading(false);
      });

    return function cleanup() {
      cancelled = true;
    };
  }, [visible, groupId, attempt]);

  async function pick(plan: FeedEvent) {
    if (sending) return;
    setSending(plan.id);
    setError(null);
    try {
      await suggestPlan(groupId, plan.id);
      onSuggested();
    } catch (problem) {
      setError(errorText(problem, "Couldn't suggest it. Try again."));
    } finally {
      setSending(null);
    }
  }

  function renderBody() {
    if (loading && plans.length === 0) {
      return (
        <View style={styles.state}>
          <ActivityIndicator color={colors.primary} />
        </View>
      );
    }
    if (loadError) {
      return (
        <View style={styles.state}>
          <Text style={styles.stateText}>{loadError}</Text>
          <Pressable
            onPress={() => setAttempt((n) => n + 1)}
            accessibilityRole="button"
            accessibilityLabel="Try again"
            style={({ pressed }) => [styles.retry, pressed && styles.pressed]}
          >
            <Text style={styles.retryText}>Try again</Text>
          </Pressable>
        </View>
      );
    }
    if (plans.length === 0) {
      return (
        <View style={styles.state}>
          <Ionicons name="compass-outline" size={26} color={colors.textFaint} />
          <Text style={styles.stateText}>No public plans from other pareas coming up. Look again later.</Text>
        </View>
      );
    }

    return plans.map((plan) => {
      const already = suggestedIds.includes(plan.id);
      const busy = sending === plan.id;
      const meta = [plan.groupName, plan.startTime, shortPlace(plan.placeLabel || plan.location)].filter(Boolean).join(' · ');
      const { day } = dateParts(plan.date);

      return (
        <Pressable
          key={plan.id}
          onPress={() => pick(plan)}
          disabled={already || sending !== null}
          accessibilityRole="button"
          accessibilityLabel={`${plan.title}. ${meta}. ${plan.goingCount} in. ${already ? `Already suggested to ${groupName}` : `Suggest it to ${groupName}`}`}
          accessibilityState={{ disabled: already || sending !== null }}
          style={({ pressed }) => [styles.row, already && styles.rowDone, pressed && styles.pressed]}
        >
          <View style={styles.date}>
            <Text style={styles.dateDay}>{weekdayShort(plan.date)}</Text>
            <Text style={styles.dateNum}>{day}</Text>
          </View>
          <View style={styles.text}>
            <Text style={styles.title} numberOfLines={1}>
              {plan.title}
            </Text>
            <Text style={styles.meta} numberOfLines={1}>
              {meta}
            </Text>
            <Text style={styles.meta}>
              {already ? 'Suggested already' : plan.goingCount > 0 ? `${plan.goingCount} in` : 'Nobody in yet'}
            </Text>
          </View>
          {busy ? (
            <ActivityIndicator color={colors.primary} />
          ) : (
            <Ionicons
              name={already ? 'checkmark-circle' : 'arrow-up-circle'}
              size={24}
              color={already ? colors.success : colors.primary}
            />
          )}
        </Pressable>
      );
    });
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={() => {}} accessible={false}>
          <SheetHeader title="Suggest a plan" onClose={onClose} closeDisabled={sending !== null} grabber />
          <Text style={styles.intro}>
            {`Public plans from other pareas. ${groupName} sees it in the chat and on Home, and each of you answers I'm in or Pass.`}
          </Text>
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
            {renderBody()}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: {
    maxHeight: '82%',
    paddingHorizontal: space.lg,
    paddingTop: space.sm,
    paddingBottom: space.xl,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    backgroundColor: colors.bg,
    gap: space.sm,
  },
  intro: { color: colors.textSoft, ...typo.regular, fontSize: textSize.body, lineHeight: 19 },
  error: { color: colors.danger, ...typo.medium, fontSize: textSize.body },
  list: { gap: space.sm - 2, paddingBottom: space.sm },
  pressed: { opacity: 0.75 },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: radius.lg - 2,
    backgroundColor: colors.surface,
  },
  rowDone: { opacity: 0.6 },
  date: {
    width: 52,
    height: 56,
    borderRadius: radius.md - 2,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateDay: { color: colors.textSoft, ...typo.mono, fontSize: 9.5, letterSpacing: 1 },
  dateNum: { color: colors.text, ...typo.display, fontSize: 20, letterSpacing: -0.5 },
  text: { flex: 1, minWidth: 0, gap: 3 },
  title: { color: colors.text, ...typo.display, fontSize: textSize.lead, letterSpacing: -0.3 },
  meta: {
    color: colors.textSoft,
    ...typo.mono,
    fontSize: 10.5,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },

  state: { alignItems: 'center', gap: space.sm, paddingVertical: space.xl },
  stateText: { color: colors.textSoft, ...typo.medium, fontSize: textSize.base, textAlign: 'center' },
  retry: {
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
  },
  retryText: { color: colors.primary, ...typo.semi, fontSize: textSize.base },
});
