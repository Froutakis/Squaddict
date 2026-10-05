import { Ionicons } from '@expo/vector-icons';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import type { MyEvent, RsvpStatus } from '../../services/serviceEvents';
import type { FeedPhoto } from '../../services/servicePhotoFeed';
import { waitsOnMe, type SquadVote } from '../../services/serviceVotes';
import { membersWhoVote, voteProgress, voteQuestion } from '../../lib/squadVote';
import { formatDateTime, parseDateKey, timeLabel } from '../../lib/datetime';
import { shortPlace } from '../home/LineTicket';
import { UsedVoteTicket, voteTally } from '../votes/VoteTicket';
import Monogram from '../general/Monogram';
import type { ChatEventItem } from './chatEvents';
import { brand, colors, radius, shadow, space, textSize, tint, typo } from '../../theme';

const DASHES = 24;
// On the blue ticket, as in LineTicket.
const ON_BLUE_KICKER = '#C3CEF7';
const ON_BLUE_LINE = '#DCE3FA';
// The dashed line of Home's timeline.
const LINE = '#B9C6F3';
const NOTCH = 14;
const THUMB = 42;

type ChatEventProps = {
  item: ChatEventItem;
  userId: string;
  // Member names by id, for "Eleni made a plan".
  names: Record<string, string>;
  // How many are in the parea, for a vote's tally.
  members: number;
  // Signed links for a memory's first two photos.
  thumbs?: (string | undefined)[];
  onAnswer: (plan: MyEvent, status: RsvpStatus | null) => void;
  onOpenPlan: (plan: MyEvent) => void;
  onOpenVotes: () => void;
  // Absent when the night can't be opened from here: the ticket just shows it.
  onOpenMemory?: (memory: FeedPhoto) => void;
};

// A plan, a vote or new photos of a night, in the chat as one of Home's
// tickets, with a short line above saying who did it and when. A plan is
// answered right here; a vote opens Votes, where votes are answered.
export default function ChatEvent({
  item,
  userId,
  names,
  members,
  thumbs = [],
  onAnswer,
  onOpenPlan,
  onOpenVotes,
  onOpenMemory,
}: ChatEventProps) {
  const time = timeLabel(item.at);

  if (item.kind === 'plan') {
    const plan = item.plan;
    const who = personOf(plan.createdBy, userId, names);
    return (
      <View style={styles.wrap}>
        <SysLine who={who} what="made a plan" time={time} />
        <PlanTicket plan={plan} userId={userId} onAnswer={onAnswer} onOpen={() => onOpenPlan(plan)} />
      </View>
    );
  }

  if (item.kind === 'vote') {
    const vote = item.vote;
    if (vote.status !== 'open') {
      const question = voteQuestion(vote.kind, vote.targetName);
      return (
        <View style={styles.wrap}>
          <SysLine icon="checkmark-done" what="A vote is decided" time={time} />
          <Pressable
            onPress={onOpenVotes}
            accessibilityRole="button"
            accessibilityLabel={`${sentence(question)} Decided. Open Votes`}
            style={({ pressed }) => pressed && styles.pressed}
          >
            <UsedVoteTicket vote={vote} userId={userId} />
          </Pressable>
        </View>
      );
    }
    const who = personOf(vote.proposedBy, userId, names, vote.proposerName);
    return (
      <View style={styles.wrap}>
        <SysLine who={who} what="started a vote" time={time} />
        <VoteChatTicket vote={vote} userId={userId} members={members} who={who} time={time} onOpen={onOpenVotes} />
      </View>
    );
  }

  const memory = item.memory;
  const who = personOf(memory.photo.userId, userId, names);
  return (
    <View style={styles.wrap}>
      <SysLine who={who} what="added photos to a memory" time={time} />
      <MemoryTicket memory={memory} thumbs={thumbs} onOpen={onOpenMemory ? () => onOpenMemory(memory) : undefined} />
    </View>
  );
}

type Who = { name: string; me: boolean };

function personOf(id: string | null, userId: string, names: Record<string, string>, fallback?: string | null): Who {
  if (id === userId) return { name: 'You', me: true };
  const name = (id ? names[id] : null) ?? fallback ?? '';
  return { name: name ? firstName(name) : 'Someone', me: false };
}

// "Friday?" stays as it is, "Follow MVPS" gets its full stop, for the screen reader.
function sentence(text: string): string {
  return /[.?!]$/.test(text) ? text : `${text}.`;
}

function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] || 'Someone';
}

// "Eleni made a plan · 18:33", above the ticket.
function SysLine({
  who,
  icon,
  what,
  time,
}: {
  who?: Who;
  icon?: keyof typeof Ionicons.glyphMap;
  what: string;
  time: string;
}) {
  return (
    <View style={styles.sys}>
      {who ? (
        <Monogram name={who.name} size={20} />
      ) : (
        <View style={styles.sysIcon}>
          <Ionicons name={icon ?? 'ellipse'} size={13} color={colors.textSoft} />
        </View>
      )}
      <Text style={styles.sysText} numberOfLines={1}>
        {who ? <Text style={styles.sysWho}>{who.name} </Text> : null}
        {who ? what : <Text style={styles.sysWho}>{what}</Text>}
        {time ? ` · ${time}` : ''}
      </Text>
    </View>
  );
}

// "Maria, Giorgos in", "You, Nikos +2 in", "Nobody in yet".
function goingLine(plan: MyEvent, userId: string): string {
  const people = [...plan.going].sort((a, b) => (a.id === userId ? -1 : b.id === userId ? 1 : 0));
  if (people.length === 0) return 'Nobody in yet';
  const shown = people.slice(0, 2).map((person) => (person.id === userId ? 'You' : firstName(person.name)));
  return `${shown.join(', ')}${people.length > 2 ? ` +${people.length - 2}` : ''} in`;
}

function PlanTicket({
  plan,
  userId,
  onAnswer,
  onOpen,
}: {
  plan: MyEvent;
  userId: string;
  onAnswer: (plan: MyEvent, status: RsvpStatus | null) => void;
  onOpen: () => void;
}) {
  const status = plan.myStatus;
  const kicker = formatDateTime(plan.date, plan.startTime).toUpperCase();
  const line = [shortPlace(plan.placeLabel ?? plan.location), goingLine(plan, userId)].filter(Boolean).join(' · ');

  return (
    <View style={styles.ticket}>
      <Pressable
        onPress={onOpen}
        accessibilityRole="button"
        accessibilityLabel={`${plan.title}. ${kicker}. ${line}. Open the plan`}
        style={({ pressed }) => [styles.main, pressed && styles.pressed]}
      >
        <Text style={styles.kicker} numberOfLines={1}>
          {kicker}
        </Text>
        <Text style={styles.title} numberOfLines={2}>
          {plan.title}
        </Text>
        <Text style={styles.line} numberOfLines={1}>
          {line}
        </Text>
      </Pressable>

      <Perforation />

      <View style={styles.stub}>
        {status === 'in' ? (
          <>
            <Pressable
              onPress={() => onAnswer(plan, null)}
              accessibilityRole="button"
              accessibilityLabel="You're in"
              accessibilityHint="Takes back your answer"
              accessibilityState={{ selected: true }}
              style={({ pressed }) => [styles.act, styles.actIn, pressed && styles.actPressed]}
            >
              <Ionicons name="checkmark" size={14} color={colors.success} />
              <Text style={[styles.actText, styles.actTextIn]} numberOfLines={1}>
                You're in
              </Text>
            </Pressable>
            <StubAction label="Pass" onPress={() => onAnswer(plan, 'out')} />
          </>
        ) : (
          <>
            <StubAction label="I'm in" strong onPress={() => onAnswer(plan, 'in')} />
            <StubAction
              label={status === 'out' ? 'Passed' : 'Pass'}
              hint={status === 'out' ? 'Takes back your answer' : undefined}
              selected={status === 'out'}
              onPress={() => onAnswer(plan, status === 'out' ? null : 'out')}
            />
          </>
        )}
      </View>
    </View>
  );
}

function VoteChatTicket({
  vote,
  userId,
  members,
  who,
  time,
  onOpen,
}: {
  vote: SquadVote;
  userId: string;
  members: number;
  who: Who;
  time: string;
  onOpen: () => void;
}) {
  const question = voteQuestion(vote.kind, vote.targetName);
  const kicker = `${who.name} asked${time ? ` · ${time}` : ''}`.toUpperCase();
  const deciding = membersWhoVote(vote.kind, members);
  const tally = voteTally(vote, members);
  const target = vote.target;
  const waits = waitsOnMe(vote, userId);
  const aboutMe = target.type === 'user' && target.user.id === userId;

  let line: string;
  if (target.type === 'poll') {
    const top = [...target.options].sort((a, b) => b.votes - a.votes)[0];
    const leads = top && top.votes > 0 && target.options.filter((option) => option.votes === top.votes).length === 1;
    line = `${vote.voted} of ${deciding} answered${leads ? ` · ${top.label} leads` : ''}`;
  } else if (target.type === 'plan') {
    line = `${formatDateTime(target.event.date, target.event.startTime)} · ${voteProgress(vote.yes, vote.no, deciding)}`;
  } else {
    line = voteProgress(vote.yes, vote.no, deciding);
  }
  const note = aboutMe ? 'About you' : waits ? 'Waits on you' : 'You voted';

  return (
    <View style={styles.ticket}>
      <Pressable
        onPress={onOpen}
        accessibilityRole="button"
        accessibilityLabel={`Vote: ${sentence(question)} ${line}. ${note}. Open Votes`}
        style={({ pressed }) => [styles.main, pressed && styles.pressed]}
      >
        <Text style={styles.kicker} numberOfLines={1}>
          {kicker}
        </Text>
        <Text style={styles.title} numberOfLines={2}>
          {question}
        </Text>
        <Text style={styles.line} numberOfLines={2}>
          {line}
        </Text>
      </Pressable>

      <Perforation />

      <View style={styles.stub}>
        <View style={styles.tally} accessible accessibilityLabel={`${tally.label} ${tally.value}`}>
          <Text style={styles.tallyLabel}>{tally.label.toUpperCase()}</Text>
          <Text style={styles.tallyValue}>{tally.value}</Text>
        </View>
        {waits ? (
          <StubAction
            label={target.type === 'poll' ? 'Pick' : 'Vote'}
            hint="Opens Votes, where votes are answered"
            strong
            onPress={onOpen}
          />
        ) : (
          <Text style={styles.stubNote} numberOfLines={1}>
            {note}
          </Text>
        )}
      </View>
    </View>
  );
}

function MemoryTicket({
  memory,
  thumbs,
  onOpen,
}: {
  memory: FeedPhoto;
  thumbs: (string | undefined)[];
  onOpen?: () => void;
}) {
  const event = memory.event;
  const day = parseDateKey(event.date) ? formatDateTime(event.date).toUpperCase() : '';
  const count = memory.photoCount;
  const photos = `${count} ${count === 1 ? 'photo' : 'photos'}`;
  const line = [photos, memory.wentCount > 1 ? `${memory.wentCount} were there` : null].filter(Boolean).join(' · ');
  const label = `Memory: ${event.title}, ${day}. ${line}.${onOpen ? ' Open it' : ''}`;
  const shots = [memory.photo, ...memory.more].slice(0, 2);

  const body = (
    <>
      <Text style={[styles.kicker, styles.kickerBlue]} numberOfLines={1}>
        MEMORY{day ? ` · ${day}` : ''}
      </Text>
      <Text style={[styles.title, styles.titleInk]} numberOfLines={2}>
        {event.title}
      </Text>
      <Text style={[styles.line, styles.lineSoft]} numberOfLines={1}>
        {line}
      </Text>
    </>
  );

  return (
    <View style={styles.memory}>
      {onOpen ? (
        <Pressable
          onPress={onOpen}
          accessibilityRole="button"
          accessibilityLabel={label}
          style={({ pressed }) => [styles.main, styles.memoryMain, pressed && styles.pressed]}
        >
          {body}
        </Pressable>
      ) : (
        <View style={[styles.main, styles.memoryMain]} accessible accessibilityLabel={label}>
          {body}
        </View>
      )}

      {/* The tear between the night and its stub, notched top and bottom. */}
      <View style={styles.memoryPerf} pointerEvents="none">
        <View style={[styles.memoryNotch, styles.memoryNotchTop]} />
        <View style={styles.memoryDashes}>
          {Array.from({ length: DASHES }, (_, i) => (
            <View key={i} style={styles.memoryDash} />
          ))}
        </View>
        <View style={[styles.memoryNotch, styles.memoryNotchBottom]} />
      </View>

      <View style={styles.memoryStub} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <View style={styles.thumbs}>
          {shots.map((shot, i) => (
            <View key={shot.id} style={[styles.thumb, i === 0 ? styles.thumbBack : styles.thumbFront]}>
              {thumbs[i] ? <Image source={{ uri: thumbs[i] }} style={styles.thumbImage} resizeMode="cover" /> : null}
            </View>
          ))}
          <Text style={styles.thumbCount}>{count}</Text>
        </View>
      </View>
    </View>
  );
}

// An empty chat's suggestion: a draft ticket that opens New plan.
export function PlanDraftTicket({ onNewPlan }: { onNewPlan: () => void }) {
  return (
    <View style={styles.draft}>
      <View style={styles.draftMain}>
        <Text style={[styles.kicker, styles.kickerBlue]}>NO PLAN YET</Text>
        <Text style={[styles.title, styles.titleInk]}>Got a night in mind?</Text>
        <Text style={[styles.line, styles.lineSoft]}>Make it a plan. The parea votes on it.</Text>
      </View>
      <View style={styles.draftPerf} pointerEvents="none">
        {Array.from({ length: DASHES }, (_, i) => (
          <View key={i} style={styles.draftDash} />
        ))}
      </View>
      <View style={styles.draftStub}>
        <Pressable
          onPress={onNewPlan}
          accessibilityRole="button"
          accessibilityLabel="New plan"
          style={({ pressed }) => [styles.act, styles.actInk, pressed && styles.actPressed]}
        >
          <Text style={[styles.actText, styles.actTextInk]} numberOfLines={1}>
            New plan
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

function Perforation() {
  return (
    <View style={styles.perf} pointerEvents="none">
      <View style={styles.dashes}>
        {Array.from({ length: DASHES }, (_, i) => (
          <View key={i} style={styles.dash} />
        ))}
      </View>
    </View>
  );
}

function StubAction({
  label,
  hint,
  strong = false,
  selected,
  onPress,
}: {
  label: string;
  hint?: string;
  strong?: boolean;
  selected?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={hint}
      accessibilityState={selected === undefined ? undefined : { selected }}
      style={({ pressed }) => [styles.act, strong ? styles.actStrong : styles.actSoft, pressed && styles.actPressed]}
    >
      <Text style={[styles.actText, strong && styles.actTextStrong]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingTop: 18, gap: space.xs + 2 },
  pressed: { opacity: 0.85 },

  sys: { flexDirection: 'row', alignItems: 'center', gap: space.xs, paddingLeft: 2 },
  sysIcon: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceAlt,
  },
  sysText: { flexShrink: 1, color: colors.textSoft, ...typo.semi, fontSize: 12.5 },
  sysWho: { color: colors.text, ...typo.bold },

  // The blue ticket of a plan or a vote, as LineTicket on Home.
  ticket: {
    flexDirection: 'row',
    borderRadius: radius.lg,
    backgroundColor: brand[0],
    shadowColor: brand[0],
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.22,
    shadowRadius: 14,
    elevation: 5,
  },
  main: { flex: 1, minWidth: 0, paddingVertical: 12, paddingLeft: 14, paddingRight: space.sm, gap: 3 },
  kicker: { color: ON_BLUE_KICKER, ...typo.mono, fontSize: 10.5, letterSpacing: 1.2 },
  kickerBlue: { color: colors.primary },
  title: { color: '#FFFFFF', ...typo.display, fontSize: 16, lineHeight: 20, letterSpacing: -0.2 },
  titleInk: { color: colors.text },
  line: { color: ON_BLUE_LINE, ...typo.semi, fontSize: textSize.small },
  lineSoft: { color: colors.textSoft },

  perf: { width: 2, marginVertical: 8 },
  dashes: { position: 'absolute', top: 0, bottom: 0, left: 0, width: 2, gap: 4, overflow: 'hidden' },
  dash: { width: 2, height: 5, borderRadius: 1, backgroundColor: 'rgba(255,255,255,0.3)' },

  stub: { width: 106, justifyContent: 'center', gap: 6, padding: 10 },
  act: {
    height: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    paddingHorizontal: 2,
    borderRadius: radius.sm,
  },
  actStrong: { backgroundColor: '#FFFFFF' },
  actSoft: { backgroundColor: 'rgba(255,255,255,0.15)' },
  actIn: { backgroundColor: tint.success },
  actInk: { backgroundColor: colors.ink, alignSelf: 'stretch' },
  actPressed: { transform: [{ scale: 0.95 }] },
  actText: { color: '#FFFFFF', ...typo.display, fontSize: 13 },
  actTextStrong: { color: brand[0] },
  actTextIn: { color: colors.success },
  actTextInk: { color: colors.onInk },

  tally: { alignItems: 'center' },
  tallyLabel: { color: ON_BLUE_KICKER, ...typo.mono, fontSize: 10.5, letterSpacing: 1.2 },
  tallyValue: { color: '#FFFFFF', ...typo.display, fontSize: 20, lineHeight: 24, fontVariant: ['tabular-nums'] },
  stubNote: { color: ON_BLUE_LINE, ...typo.semi, fontSize: textSize.small, textAlign: 'center' },

  // A memory: a white used ticket, two of its photos on the stub.
  memory: { flexDirection: 'row', borderRadius: radius.md + 2, backgroundColor: colors.surface, ...shadow.bubble },
  memoryMain: { paddingVertical: 11, gap: 2 },
  memoryPerf: { width: NOTCH, alignItems: 'center' },
  memoryNotch: {
    position: 'absolute',
    left: 0,
    width: NOTCH,
    height: NOTCH,
    borderRadius: NOTCH / 2,
    backgroundColor: colors.bg,
  },
  memoryNotchTop: { top: -NOTCH / 2 },
  memoryNotchBottom: { bottom: -NOTCH / 2 },
  memoryDashes: { position: 'absolute', top: 10, bottom: 10, width: 2, gap: 4, overflow: 'hidden' },
  memoryDash: { width: 2, height: 5, borderRadius: 1, backgroundColor: colors.border },
  memoryStub: { width: 92, alignItems: 'center', justifyContent: 'center', paddingVertical: space.xs, paddingRight: 8 },
  thumbs: { width: 64, height: 52 },
  thumb: {
    position: 'absolute',
    width: THUMB,
    height: THUMB,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    backgroundColor: colors.surfaceAlt,
    overflow: 'hidden',
  },
  thumbBack: { left: 0, top: 6, transform: [{ rotate: '-8deg' }] },
  thumbFront: { left: 20, top: 2, transform: [{ rotate: '6deg' }] },
  thumbImage: { width: '100%', height: '100%' },
  thumbCount: {
    position: 'absolute',
    right: -4,
    bottom: -2,
    overflow: 'hidden',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.pill,
    backgroundColor: colors.ink,
    color: colors.onInk,
    ...typo.display,
    fontSize: textSize.caption,
  },

  draft: {
    flexDirection: 'row',
    borderRadius: radius.lg,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: LINE,
    backgroundColor: 'rgba(255,255,255,0.5)',
  },
  draftMain: { flex: 1, minWidth: 0, paddingVertical: 12, paddingLeft: 14, paddingRight: 8, gap: 2 },
  draftPerf: { width: 2, marginVertical: 8, gap: 4, overflow: 'hidden' },
  draftDash: { width: 2, height: 5, borderRadius: 1, backgroundColor: LINE },
  draftStub: { width: 104, justifyContent: 'center', padding: 10 },
});
