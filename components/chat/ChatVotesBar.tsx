import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import type { SquadVote } from '../../services/serviceVotes';
import { membersWhoVote, votesNeeded, voteQuestion } from '../../lib/squadVote';
import { colors, paper, radius, space, sun, textSize, typo } from '../../theme';

export type ChatFilter = 'all' | 'votes';

type ChatVotesBarProps = {
  filter: ChatFilter;
  onFilter: (filter: ChatFilter) => void;
  // The parea's open votes, newest first.
  open: SquadVote[];
  members: number;
  onJump: (vote: SquadVote) => void;
};

const RING = 30;
const STROKE = 4;

// You have not answered it yet.
export function needsYou(vote: SquadVote): boolean {
  if (vote.target.type === 'poll') return vote.target.myOption === null;
  return vote.myVote === null;
}

function progressOf(vote: SquadVote, members: number): { done: number; of: number; label: string } {
  const deciding = membersWhoVote(vote.kind, members);
  if (vote.target.type === 'poll') {
    return { done: vote.voted, of: deciding, label: `${vote.voted} of ${deciding} answered` };
  }
  const needed = votesNeeded(deciding);
  return { done: vote.yes, of: needed, label: `${vote.yes} of ${deciding} yes` };
}

function titleOf(vote: SquadVote): string {
  if (vote.target.type === 'plan') return vote.target.event.title;
  return voteQuestion(vote.kind, vote.targetName);
}

function ringColor(vote: SquadVote): string {
  if (vote.kind === 'plan') return colors.primary;
  if (vote.kind === 'poll') return sun;
  return colors.success;
}

// Above the chat: All | Votes, and the parea's open votes pinned in a row,
// each a tap away from its card. Votes live in the chat; this is where they
// are found.
export default function ChatVotesBar({ filter, onFilter, open, members, onJump }: ChatVotesBarProps) {
  return (
    <View style={styles.bar}>
      <View style={styles.tabs} accessibilityRole="tablist">
        <Tab label="All" on={filter === 'all'} onPress={() => onFilter('all')} />
        <Tab label="Votes" count={open.length} on={filter === 'votes'} onPress={() => onFilter('votes')} />
      </View>

      {open.length > 0 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.pins}
          accessibilityLabel="Open votes"
        >
          {open.map((vote) => {
            const progress = progressOf(vote, members);
            const mine = needsYou(vote);
            const title = titleOf(vote);
            return (
              <Pressable
                key={vote.id}
                onPress={() => onJump(vote)}
                accessibilityRole="button"
                accessibilityLabel={`${title}, ${progress.label}${mine ? ', needs your vote' : ''}`}
                style={({ pressed }) => [styles.pin, mine && styles.pinMine, pressed && styles.pressed]}
              >
                <Ring done={progress.done} of={progress.of} color={ringColor(vote)} />
                <View style={styles.pinText}>
                  <Text style={styles.pinTitle} numberOfLines={1}>
                    {title}
                  </Text>
                  <Text style={styles.pinMeta} numberOfLines={1}>
                    {progress.label}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </ScrollView>
      ) : null}
    </View>
  );
}

function Tab({ label, count = 0, on, onPress }: { label: string; count?: number; on: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="tab"
      accessibilityState={{ selected: on }}
      accessibilityLabel={count > 0 ? `${label}, ${count} open` : label}
      hitSlop={5}
      style={({ pressed }) => [styles.tab, on && styles.tabOn, pressed && styles.pressed]}
    >
      <Text style={[styles.tabText, on && styles.tabTextOn]}>{label}</Text>
      {count > 0 ? (
        <View style={[styles.count, on && styles.countOn]}>
          <Text style={[styles.countText, on && styles.countTextOn]}>{count}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

function Ring({ done, of, color }: { done: number; of: number; color: string }) {
  const r = (RING - STROKE) / 2;
  const length = 2 * Math.PI * r;
  const share = Math.min(1, of > 0 ? done / of : 0);
  return (
    <Svg width={RING} height={RING} style={styles.ring}>
      <Circle cx={RING / 2} cy={RING / 2} r={r} stroke={colors.sunk} strokeWidth={STROKE} fill="none" />
      <Circle
        cx={RING / 2}
        cy={RING / 2}
        r={r}
        stroke={color}
        strokeWidth={STROKE}
        fill="none"
        strokeLinecap="round"
        strokeDasharray={`${length * share} ${length}`}
        transform={`rotate(-90 ${RING / 2} ${RING / 2})`}
      />
    </Svg>
  );
}

const styles = StyleSheet.create({
  bar: {
    paddingBottom: space.xs + 2,
    gap: space.xs + 2,
    borderBottomWidth: 1,
    borderBottomColor: paper.line,
    backgroundColor: paper.surface,
  },
  tabs: { flexDirection: 'row', gap: space.xs, paddingHorizontal: space.md },
  tab: {
    minHeight: 34,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    borderRadius: radius.pill,
    backgroundColor: paper.bg,
  },
  tabOn: { backgroundColor: colors.primary },
  tabText: { color: paper.inkSoft, ...typo.semi, fontSize: 13.5 },
  tabTextOn: { color: paper.onMine },
  count: {
    minWidth: 18,
    height: 18,
    paddingHorizontal: 5,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.danger,
  },
  countOn: { backgroundColor: sun },
  countText: { color: colors.onInk, ...typo.mono, fontSize: 10.5 },
  countTextOn: { color: colors.ink },

  pins: { gap: space.xs + 2, paddingHorizontal: space.md },
  // Every pin is one height: one line of title, one of tally.
  pin: {
    width: 200,
    height: 50,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingVertical: space.xs + 2,
    paddingHorizontal: space.sm + 1,
    borderRadius: radius.md,
    backgroundColor: paper.bg,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  pinMine: { borderColor: colors.primary },
  ring: { flexShrink: 0 },
  pinText: { flex: 1, minWidth: 0 },
  pinTitle: { color: paper.ink, ...typo.semi, fontSize: 12.5, lineHeight: 16 },
  pinMeta: { marginTop: 1, color: paper.inkFaint, ...typo.mono, fontSize: 10 },
  pressed: { opacity: 0.8 },
});
