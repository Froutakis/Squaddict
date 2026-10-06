import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps, ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import TicketShape from '../general/TicketShape';
import DashedDivider from '../general/DashedDivider';
import AnswerSeg, { type Answer } from '../general/AnswerSeg';
import { colors, radius, space, sun, sunOn, textSize, tint, typo } from '../../theme';

// One plan on the line, as a ticket. Plain: white, with one small pill on a
// perforated stub. Chosen (first tap): the whole ticket turns blue and the
// stub gives way to In | Maybe | Out. Live: small, with a sun stripe, and it
// grows on the first tap to show who is there and what to do. Past: no card,
// just muted words.

export type PillTone = 'ask' | 'accent' | 'quiet' | 'done';

export type TicketPill = {
  label: string;
  tone: PillTone;
  icon?: ComponentProps<typeof Ionicons>['name'];
  // A pill that does something of its own (Suggest), apart from the row.
  onPress?: () => void;
  accessibilityLabel?: string;
  disabled?: boolean;
};

type PlanTicketProps = {
  title: string;
  sub: string;
  pill?: TicketPill | null;
  state: 'plain' | 'chosen' | 'live' | 'past';
  // A live plan, opened: the longer line, and `extra` (people, actions).
  grown?: boolean;
  long?: string;
  extra?: ReactNode;
  answer?: { value: Answer | null; onChange: (answer: Answer) => void; disabled?: boolean };
  onPress: () => void;
  accessibilityLabel: string;
  accessibilityHint?: string;
};

export default function PlanTicket({
  title,
  sub,
  pill = null,
  state,
  grown = false,
  long,
  extra,
  answer,
  onPress,
  accessibilityLabel,
  accessibilityHint,
}: PlanTicketProps) {
  const chosen = state === 'chosen';
  const live = state === 'live';
  const past = state === 'past';

  if (past) {
    return (
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityHint={accessibilityHint}
        style={({ pressed }) => [styles.past, pressed && styles.pressed]}
      >
        <View style={styles.body}>
          <Text style={[styles.title, styles.titlePast]} numberOfLines={1}>
            {title}
          </Text>
          <Text style={styles.sub} numberOfLines={1}>
            {sub}
          </Text>
        </View>
        {pill ? <Text style={styles.pastTag}>{pill.label}</Text> : null}
      </Pressable>
    );
  }

  return (
    <View style={[styles.wrap, chosen && styles.wrapChosen, live && grown && styles.wrapGrown]}>
      <TicketShape fill={chosen ? colors.primary : colors.surface} stripe={live ? sun : undefined} />
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityHint={accessibilityHint}
        accessibilityState={{ expanded: chosen || grown }}
        style={({ pressed }) => [styles.press, live && !grown && styles.pressLive, pressed && styles.pressed]}
      >
        <View style={styles.body}>
          {live ? (
            <View style={styles.liveHead}>
              <Text style={[styles.title, !grown && styles.titleSmall]} numberOfLines={1}>
                {title}
              </Text>
              <OnNow big={grown} />
            </View>
          ) : (
            <Text style={[styles.title, chosen && styles.titleChosen]} numberOfLines={1}>
              {title}
            </Text>
          )}
          <Text style={[styles.sub, chosen && styles.subChosen]} numberOfLines={1}>
            {live && grown && long ? long : sub}
          </Text>
        </View>
        {!chosen && !live && pill ? (
          <View style={styles.stub}>
            <VerticalDashes />
            <Pill {...pill} />
          </View>
        ) : null}
      </Pressable>
      {chosen && answer ? (
        <View style={styles.answer}>
          <AnswerSeg value={answer.value} onChange={answer.onChange} disabled={answer.disabled} label={`Your answer to ${title}`} />
        </View>
      ) : null}
      {(chosen || (live && grown)) && extra ? <View style={styles.extra}>{extra}</View> : null}
    </View>
  );
}

// The small yellow "On now" tag with its dot.
export function OnNow({ big = false, label = 'On now' }: { big?: boolean; label?: string }) {
  return (
    <View style={[styles.onNow, big && styles.onNowBig]}>
      <View style={styles.onNowDot} />
      <Text style={[styles.onNowText, big && styles.onNowTextBig]}>{label}</Text>
    </View>
  );
}

export function Pill({ label, tone, icon, onPress, accessibilityLabel, disabled = false }: TicketPill) {
  const inside = (
    <>
      {icon ? <Ionicons name={icon} size={13} color={pillText[tone].color} /> : null}
      <Text style={[styles.pillText, pillText[tone]]} numberOfLines={1}>
        {label}
      </Text>
    </>
  );
  if (!onPress) return <View style={[styles.pill, pillBox[tone]]}>{inside}</View>;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled }}
      hitSlop={6}
      style={({ pressed }) => [styles.pill, styles.pillButton, pillBox[tone], (pressed || disabled) && styles.pressed]}
    >
      {inside}
    </Pressable>
  );
}

// The stub's tear line, top to bottom.
function VerticalDashes() {
  return (
    <View style={styles.vdashes} pointerEvents="none">
      {Array.from({ length: 14 }, (_, i) => (
        <View key={i} style={styles.vdash} />
      ))}
    </View>
  );
}

// A full-width pair of buttons under a grown plan: the strong one blue, the other soft.
export function TicketActions({
  actions,
}: {
  actions: { label: string; icon: ComponentProps<typeof Ionicons>['name']; strong?: boolean; disabled?: boolean; onPress: () => void }[];
}) {
  return (
    <View style={styles.actionsWrap}>
      <DashedDivider />
      <View style={styles.actions}>
        {actions.map((action) => (
          <Pressable
            key={action.label}
            onPress={action.onPress}
            disabled={action.disabled}
            accessibilityRole="button"
            accessibilityLabel={action.label}
            accessibilityState={{ disabled: action.disabled }}
            style={({ pressed }) => [
              styles.action,
              action.strong ? styles.actionStrong : styles.actionSoft,
              action.disabled && styles.disabled,
              pressed && styles.actionPressed,
            ]}
          >
            <Ionicons name={action.icon} size={16} color={action.strong ? colors.onInk : colors.text} />
            <Text style={[styles.actionText, action.strong && styles.actionTextStrong]} numberOfLines={1}>
              {action.label}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const pillBox = StyleSheet.create({
  ask: { backgroundColor: tint.danger },
  accent: { backgroundColor: colors.accentSoft },
  quiet: { backgroundColor: colors.sunk },
  done: { backgroundColor: tint.success },
});

const pillText = StyleSheet.create({
  ask: { color: tint.dangerInk },
  accent: { color: colors.accentInk },
  quiet: { color: colors.textSoft },
  done: { color: colors.success },
});

const styles = StyleSheet.create({
  // The radius only rounds the shadow; the ticket itself is drawn.
  wrap: { marginBottom: 2, borderRadius: 16 },
  wrapChosen: {
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.28,
    shadowRadius: 14,
  },
  wrapGrown: {
    shadowColor: colors.ink,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.07,
    shadowRadius: 16,
  },
  press: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 62,
    paddingVertical: 12,
    paddingLeft: 14,
    paddingRight: 12,
  },
  pressLive: { minHeight: 0, paddingVertical: 9 },
  pressed: { opacity: 0.85 },
  body: { flex: 1, minWidth: 0 },
  title: { color: colors.text, ...typo.bold, fontSize: textSize.lead, letterSpacing: -0.2 },
  titleSmall: { fontSize: textSize.base },
  titleChosen: { color: colors.onInk },
  titlePast: { color: colors.textFaint, ...typo.semi },
  sub: { marginTop: 2, color: colors.textSoft, ...typo.medium, fontSize: 12.5 },
  subChosen: { color: 'rgba(255,255,255,0.78)' },
  liveHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.xs },

  stub: { flexDirection: 'row', alignItems: 'center', alignSelf: 'stretch', paddingLeft: 11 },
  // As tall as the ticket, never taller: the dashes are cut to fit.
  vdashes: { position: 'absolute', left: 0, top: -12, bottom: -12, width: 1.5, gap: 3, overflow: 'hidden' },
  vdash: { width: 1.5, height: 4, borderRadius: 1, backgroundColor: colors.border },

  pill: {
    height: 28,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    borderRadius: radius.pill,
  },
  pillButton: { height: 34, paddingHorizontal: 12 },
  pillText: { ...typo.bold, fontSize: textSize.small },

  answer: { paddingHorizontal: 14, paddingBottom: 12, marginTop: -4 },
  extra: { paddingHorizontal: 14, paddingBottom: 14, marginTop: -4 },

  onNow: {
    height: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 7,
    borderRadius: radius.pill,
    backgroundColor: sun,
  },
  onNowBig: { height: 24, paddingHorizontal: 9, gap: 6 },
  onNowDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: sunOn },
  onNowText: { color: sunOn, ...typo.bold, fontSize: 10.5 },
  onNowTextBig: { fontSize: 11.5 },

  past: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 48, paddingLeft: 14, paddingRight: 12, paddingVertical: 6 },
  pastTag: { alignSelf: 'flex-start', marginTop: 2, color: colors.textFaint, ...typo.medium, fontSize: textSize.small },

  actionsWrap: { marginTop: 12, gap: 12 },
  actions: { flexDirection: 'row', gap: 8 },
  action: {
    flex: 1,
    height: 40,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 12,
    borderRadius: radius.pill,
  },
  actionStrong: { backgroundColor: colors.primary },
  actionSoft: { backgroundColor: colors.sunk },
  actionPressed: { transform: [{ scale: 0.97 }] },
  disabled: { opacity: 0.5 },
  actionText: { color: colors.text, ...typo.semi, fontSize: 13.5 },
  actionTextStrong: { color: colors.onInk },
});
