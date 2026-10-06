import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { VoteIdea } from '../../services/serviceVoteIdeas';
import { voteQuestion } from '../../lib/squadVote';
import { features } from '../../lib/features';
import type { Person } from '../../lib/people';
import Monogram from '../general/Monogram';
import { shortPlace } from '../home/LineTicket';
import { alpha, brand, colors, paper, radius, shadow, space, textSize, typo } from '../../theme';

// What fills the Votes line when nothing is open: how the parea decides, a
// few ideas worth a vote, and one-tap ways to start one.

const LINE = alpha(colors.primary, 0.28);
const MEMO = 'rgba(232,237,253,0.6)';
const ON_BLUE_KICKER = colors.accentSoft;
const PILE_SHOWN = 5;
const DASHES = 24;

// "3 of 5 decide", with the faces, and the last thing they decided.
export function DecideStrip({ people, needed, members, last }: { people: Person[]; needed: number; members: number; last: string }) {
  const shown = people.slice(0, PILE_SHOWN);
  const more = Math.max(0, members - shown.length);

  return (
    <View style={styles.strip} accessible accessibilityLabel={`${needed} of ${members} decide. Last: ${last}`}>
      {shown.length > 0 ? (
        <View style={styles.pile}>
          {shown.map((person, index) => (
            <Monogram
              key={person.id}
              name={person.name || '?'}
              uri={person.avatarUrl ?? null}
              size={24}
              ring={2}
              ringColor={colors.bg}
              style={index > 0 ? styles.pileFace : undefined}
            />
          ))}
          {more > 0 && people.length > 0 ? <Text style={styles.pileMore}>+{more}</Text> : null}
        </View>
      ) : null}
      <View style={styles.stripText}>
        <Text style={styles.stripTitle}>
          {needed} of {members} decide
        </Text>
        <Text style={styles.stripSub} numberOfLines={1}>
          Last: {last}
        </Text>
      </View>
    </View>
  );
}

// An idea as a draft ticket: dashed, like a memo on Home, with why it came up
// and the stub to put it to the vote or let it go.
export function IdeaTicket({
  idea,
  busy = false,
  onPropose,
  onLater,
}: {
  idea: VoteIdea;
  busy?: boolean;
  onPropose: () => void;
  onLater: () => void;
}) {
  const question = voteQuestion(idea.kind, idea.name);
  const place = shortPlace(idea.place);
  const line = place ? `You were both at ${place}` : 'You were out the same night';

  return (
    <View style={styles.memo}>
      <View style={styles.memoMain} accessible accessibilityLabel={`${question} ${idea.why}. ${line}`}>
        <Text style={styles.why}>{idea.why}</Text>
        <Text style={styles.memoTitle} numberOfLines={3}>
          {question}
        </Text>
        <Text style={styles.memoLine} numberOfLines={2}>
          {line}
        </Text>
      </View>
      <View style={styles.perf} pointerEvents="none">
        <View style={styles.dashes}>
          {Array.from({ length: DASHES }, (_, i) => (
            <View key={i} style={styles.dash} />
          ))}
        </View>
      </View>
      <View style={styles.memoStub}>
        <Pressable
          onPress={onPropose}
          disabled={busy}
          accessibilityRole="button"
          accessibilityLabel={`Put to the vote: ${question}`}
          accessibilityState={{ disabled: busy }}
          style={({ pressed }) => [styles.act, styles.actInk, busy && styles.disabled, pressed && styles.actPressed]}
        >
          <Text style={[styles.actText, styles.actTextInk]} numberOfLines={1}>
            Put to vote
          </Text>
        </Pressable>
        <Pressable
          onPress={onLater}
          disabled={busy}
          accessibilityRole="button"
          accessibilityLabel={`Not now: ${question}`}
          accessibilityHint="Hides this idea on this phone"
          style={({ pressed }) => [styles.act, styles.actLater, pressed && styles.actPressed]}
        >
          <Text style={[styles.actText, styles.actTextLater]} numberOfLines={1}>
            Not now
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

// 'plan' opens the plan form instead of New vote.
export type QuickStep = 'poll' | 'invite' | 'plan' | 'follow';

const QUICK: { step: QuickStep; icon: keyof typeof Ionicons.glyphMap; title: string; rule: string }[] = [
  { step: 'poll', icon: 'help-circle-outline', title: 'Ask the parea', rule: 'Most picks win' },
  { step: 'invite', icon: 'person-add-outline', title: 'Invite a friend', rule: 'Link works once' },
  { step: 'plan', icon: 'calendar-outline', title: 'Throw a plan', rule: 'Most say yes' },
  { step: 'follow', icon: 'compass-outline', title: 'Follow a parea', rule: 'See their nights' },
];

// Four ways to start a vote in one tap, each opening New vote on its step.
export function QuickStarts({ onStart, onAll }: { onStart: (step: QuickStep) => void; onAll: () => void }) {
  const tiles = QUICK.filter((tile) => tile.step !== 'follow' || features.squadFollows);
  const rows: (typeof tiles)[] = [];
  for (let i = 0; i < tiles.length; i += 2) rows.push(tiles.slice(i, i + 2));

  return (
    <View style={styles.quick}>
      {rows.map((row) => (
        <View key={row[0].step} style={styles.quickRow}>
          {row.map((tile) => {
            const blue = tile.step === 'poll';
            return (
              <Pressable
                key={tile.step}
                onPress={() => onStart(tile.step)}
                accessibilityRole="button"
                accessibilityLabel={`${tile.title}. ${tile.rule}`}
                accessibilityHint="Starts this vote"
                style={({ pressed }) => [styles.tile, blue && styles.tileBlue, pressed && styles.tilePressed]}
              >
                <View style={[styles.tileIcon, blue && styles.tileIconBlue]}>
                  <Ionicons name={tile.icon} size={18} color={blue ? colors.onInk : colors.text} />
                </View>
                <Text style={[styles.tileTitle, blue && styles.onBlue]}>{tile.title}</Text>
                <Text style={[styles.tileRule, blue && styles.tileRuleBlue]}>{tile.rule.toUpperCase()}</Text>
              </Pressable>
            );
          })}
          {row.length === 1 ? <View style={styles.tileSpacer} /> : null}
        </View>
      ))}
      <Pressable
        onPress={onAll}
        accessibilityRole="button"
        accessibilityLabel="All kinds of votes"
        style={({ pressed }) => [styles.all, pressed && styles.pressed]}
      >
        <Text style={styles.allText}>All kinds of votes</Text>
        <Ionicons name="chevron-forward" size={16} color={colors.primary} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  pressed: { opacity: 0.6 },
  disabled: { opacity: 0.5 },

  strip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    minHeight: 54,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: 'rgba(255,255,255,0.62)',
  },
  pile: { flexDirection: 'row', alignItems: 'center' },
  pileFace: { marginLeft: -7 },
  pileMore: { marginLeft: 4, color: colors.textSoft, ...typo.semi, fontSize: textSize.small },
  stripText: { flex: 1, minWidth: 0 },
  stripTitle: { color: colors.text, ...typo.bold, fontSize: textSize.base },
  stripSub: { color: colors.textSoft, ...typo.medium, fontSize: textSize.small },

  memo: {
    flexDirection: 'row',
    marginTop: 2,
    marginBottom: space.xs,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: LINE,
    backgroundColor: MEMO,
  },
  memoMain: { flex: 1, minWidth: 0, gap: 4, paddingVertical: 11, paddingLeft: 13, paddingRight: 8 },
  why: {
    alignSelf: 'flex-start',
    overflow: 'hidden',
    color: colors.primary,
    backgroundColor: paper.accentSoft,
    ...typo.bold,
    fontSize: textSize.caption,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
  },
  memoTitle: { color: colors.text, ...typo.display, fontSize: textSize.lead, lineHeight: 19, letterSpacing: -0.2 },
  memoLine: { color: colors.textSoft, ...typo.semi, fontSize: textSize.small },
  perf: { width: 2, marginVertical: 8 },
  dashes: { position: 'absolute', top: 0, bottom: 0, left: 0, width: 2, gap: 4, overflow: 'hidden' },
  dash: { width: 2, height: 5, borderRadius: 1, backgroundColor: LINE },
  memoStub: { width: 100, justifyContent: 'center', gap: 6, padding: 9 },
  act: { minHeight: 44, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4, borderRadius: radius.sm },
  actInk: { backgroundColor: colors.ink },
  actLater: { backgroundColor: 'rgba(33,69,230,0.08)' },
  actPressed: { transform: [{ scale: 0.95 }] },
  actText: { ...typo.display, fontSize: textSize.body },
  actTextInk: { color: colors.onInk },
  actTextLater: { color: colors.primary },

  quick: { gap: 8, marginTop: space.xs },
  quickRow: { flexDirection: 'row', gap: 8 },
  tile: {
    flex: 1,
    minHeight: 92,
    alignItems: 'flex-start',
    gap: 6,
    paddingVertical: 11,
    paddingHorizontal: 12,
    borderRadius: 16,
    backgroundColor: colors.surface,
    ...shadow.card,
  },
  tileBlue: {
    backgroundColor: brand[0],
    shadowColor: brand[0],
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 14,
    elevation: 4,
  },
  tilePressed: { transform: [{ scale: 0.98 }] },
  tileSpacer: { flex: 1 },
  tileIcon: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
  tileIconBlue: { backgroundColor: 'rgba(255,255,255,0.16)' },
  tileTitle: { color: colors.text, ...typo.bold, fontSize: textSize.base, lineHeight: 17 },
  onBlue: { color: colors.onInk },
  tileRule: { marginTop: 'auto', color: colors.textSoft, ...typo.mono, fontSize: 10.5, letterSpacing: 1.2 },
  tileRuleBlue: { color: ON_BLUE_KICKER },
  all: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 2, minHeight: 44 },
  allText: { color: colors.primary, ...typo.bold, fontSize: textSize.body },
});
