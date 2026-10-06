import { useState, type ReactNode } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Platform, Pressable, Share, StyleSheet, Text, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { getVoteLink, type SquadVote } from '../../services/serviceVotes';
import { INVITE_DAYS, inviteExpiry, membersWhoVote, votesNeeded, voteQuestion } from '../../lib/squadVote';
import { formatDateTime, keyOf } from '../../lib/datetime';
import { inviteMessage } from '../../lib/invite';
import { placeLines } from '../../lib/place';
import type { Person } from '../../lib/people';
import Monogram from '../general/Monogram';
import { brand, colors, paper, radius, shadow, space, sunInk, textSize, tint, typo } from '../../theme';

// Votes on the line, the Home way: the vote that waits on you is a blue
// ticket you answer on its stub (VoteTicket); the others are rows you tap to
// make them the ticket (VoteRow); a passed invite is a white admit-one ticket
// (InviteTicket); and a decided vote is a used ticket with a stamp
// (UsedVoteTicket).

const DASHES = 24;
const FACE = 24;
const MINI = 16;
// More faces than this and the rest become "+3".
const FACES_SHOWN = 7;
const PICKERS_SHOWN = 3;
const DAY_MS = 24 * 60 * 60 * 1000;

// On the blue ticket, as in LineTicket.
const ON_BLUE_KICKER = colors.accentSoft;
const ON_BLUE_LINE = colors.accentSoft;
// Red and sun text dark enough for small type on white and on their tints
// (4.5:1), which colors.danger is not.
const RED_TEXT = '#B23624';
const SUN_TEXT = sunInk;

type Ballot = 'yes' | 'no' | 'wait';

// "YOU", "NIKOS".
function askerOf(vote: SquadVote, userId: string): string {
  if (vote.proposedBy === userId) return 'You';
  return firstName(vote.proposerName ?? '') || 'Someone';
}

// "Nikos wants to throw a plan", "You want to throw a plan".
function plannerLine(vote: SquadVote, userId: string): string {
  const who = askerOf(vote, userId);
  return `${who} ${who === 'You' ? 'want' : 'wants'} to throw a plan`;
}

function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] ?? '';
}

// "TODAY", or "SAT 3 OCT", for a timestamp.
function dayOf(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const key = keyOf(d);
  return key === keyOf(new Date()) ? 'TODAY' : formatDateTime(key).toUpperCase();
}

// "Fri 2 Oct" (or "Today") for the quieter lines.
function softDay(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const key = keyOf(d);
  return key === keyOf(new Date()) ? 'Today' : formatDateTime(key);
}

// Whole days an invite link has left, at least 1 while it works.
export function inviteDaysLeft(createdAt: string, now: Date = new Date()): number {
  const made = new Date(createdAt).getTime();
  if (Number.isNaN(made)) return INVITE_DAYS;
  return Math.max(1, Math.ceil((made + INVITE_DAYS * DAY_MS - now.getTime()) / DAY_MS));
}

// The member a remove vote is about sees it, but does not vote on it.
function removalTarget(vote: SquadVote): string | null {
  return vote.target.type === 'user' ? vote.target.user.id : null;
}

function ballotOf(vote: SquadVote, memberId: string): Ballot {
  const ballot = vote.ballots.find((one) => one.userId === memberId);
  if (!ballot) return 'wait';
  if (vote.target.type === 'poll') return ballot.optionId ? 'yes' : 'wait';
  return ballot.approve === true ? 'yes' : ballot.approve === false ? 'no' : 'wait';
}

function nameOf(person: Person, userId: string): string {
  return person.id === userId ? 'You' : firstName(person.name) || 'Someone';
}

// The rail beside a vote: how far it has got.
export function voteTally(vote: SquadVote, members: number): { label: string; value: string } {
  const deciding = membersWhoVote(vote.kind, members);
  if (vote.target.type === 'poll') return { label: 'Voted', value: `${vote.voted}/${deciding}` };
  return { label: 'Yes', value: `${vote.yes}/${votesNeeded(deciding)}` };
}

// Every member's face, with how they answered: a green tick, a red cross, or
// a dashed ring while they haven't. The member a removal is about stands
// apart, not counted.
// The faces, said out loud: "Maria: yes, Nikos: not yet".
function facesSummary(vote: SquadVote, people: Person[], userId: string): string {
  const outId = removalTarget(vote);
  const poll = vote.target.type === 'poll';
  const said = people
    .filter((person) => person.id !== outId)
    .map((person) => {
      const ballot = ballotOf(vote, person.id);
      const word = ballot === 'wait' ? 'not yet' : poll ? 'answered' : ballot;
      return `${nameOf(person, userId)}: ${word}`;
    })
    .join(', ');
  const out = people.find((person) => person.id === outId);
  return out ? `${said}. ${nameOf(out, userId)} does not vote on it` : said;
}

function Faces({ vote, people, userId }: { vote: SquadVote; people: Person[]; userId: string }) {
  if (people.length === 0) return null;
  const outId = removalTarget(vote);
  const voters = people.filter((person) => person.id !== outId);
  const out = people.find((person) => person.id === outId) ?? null;
  const shown = voters.slice(0, FACES_SHOWN);
  const more = voters.length - shown.length;

  // Read out by the ticket around it, with the rest of the vote.
  return (
    <View style={styles.faces} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
      {shown.map((person) => {
        const ballot = ballotOf(vote, person.id);
        return (
          <View
            key={person.id}
            style={[
              styles.face,
              ballot === 'yes' && styles.faceYes,
              ballot === 'no' && styles.faceNo,
              ballot === 'wait' && styles.faceWait,
            ]}
          >
            {ballot === 'yes' ? <Ionicons name="checkmark" size={14} color={colors.onInk} /> : null}
            {ballot === 'no' ? <Ionicons name="close" size={14} color={RED_TEXT} /> : null}
            {ballot === 'wait' ? <Text style={styles.faceInitial}>{nameOf(person, userId).charAt(0)}</Text> : null}
          </View>
        );
      })}
      {more > 0 ? <Text style={styles.facesMore}>+{more}</Text> : null}
      {out ? (
        <>
          <View style={styles.facesRule} />
          <View style={[styles.face, styles.faceOut]}>
            <Text style={styles.faceInitial}>{nameOf(out, userId).charAt(0)}</Text>
          </View>
        </>
      ) : null}
    </View>
  );
}

// "Maria, Nikos said yes · 1 more passes it".
function progressLine(vote: SquadVote, people: Person[], userId: string, deciding: number): string {
  const yes = vote.ballots
    .filter((ballot) => ballot.approve === true)
    .map((ballot) => people.find((person) => person.id === ballot.userId))
    .filter((person): person is Person => person !== undefined)
    .map((person) => nameOf(person, userId));
  const said =
    yes.length > 0
      ? `${yes.slice(0, 2).join(', ')}${yes.length > 2 ? ` +${yes.length - 2}` : ''} said yes`
      : vote.yes > 0
        ? `${vote.yes} said yes`
        : 'No one yet';
  const more = Math.max(0, votesNeeded(deciding) - vote.yes);
  return more > 0 ? `${said} · ${more} more ${more === 1 ? 'passes' : 'pass'} it` : said;
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

// Across a ticket, with a notch cut on each side in the colour behind it.
function TearLine({ notch = colors.bg, light = true }: { notch?: string; light?: boolean }) {
  return (
    <View style={styles.tear} pointerEvents="none">
      <View style={[styles.notch, styles.notchLeft, { backgroundColor: notch }]} />
      <View style={styles.tearDashes}>
        {Array.from({ length: DASHES * 2 }, (_, i) => (
          <View key={i} style={[styles.tearDash, !light && styles.tearDashDark]} />
        ))}
      </View>
      <View style={[styles.notch, styles.notchRight, { backgroundColor: notch }]} />
    </View>
  );
}

function StubButton({
  text,
  label,
  hint,
  tone,
  icon,
  disabled = false,
  onPress,
}: {
  // What the button says, when the screen reader should hear more (label).
  text?: string;
  label: string;
  hint?: string;
  tone: 'strong' | 'soft' | 'ink';
  icon?: keyof typeof Ionicons.glyphMap;
  disabled?: boolean;
  onPress: () => void;
}) {
  const color = tone === 'strong' ? brand[0] : colors.onInk;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={hint}
      accessibilityState={{ disabled }}
      style={({ pressed }) => [
        styles.act,
        tone === 'strong' && styles.actStrong,
        tone === 'soft' && styles.actSoft,
        tone === 'ink' && styles.actInk,
        disabled && styles.disabled,
        pressed && styles.actPressed,
      ]}
    >
      {icon ? <Ionicons name={icon} size={15} color={color} /> : null}
      <Text style={[styles.actText, { color }]} numberOfLines={1}>
        {text ?? label}
      </Text>
    </Pressable>
  );
}

// What you said, on the stub: not a button, it is already done.
function SaidChip({ yes }: { yes: boolean }) {
  return (
    <View
      style={[styles.act, yes ? styles.saidYes : styles.saidNo]}
      accessible
      accessibilityLabel={yes ? 'You said yes' : 'You said no'}
    >
      <Ionicons name={yes ? 'checkmark' : 'close'} size={14} color={yes ? colors.success : RED_TEXT} />
      <Text style={[styles.actText, { color: yes ? colors.success : RED_TEXT }]} numberOfLines={1}>
        {yes ? 'You: yes' : 'You: no'}
      </Text>
    </View>
  );
}

type VoteTicketProps = {
  vote: SquadVote;
  // How many members the squad has: a vote needs more than half of them.
  members: number;
  // The members themselves, for the faces. Empty while they load.
  people: Person[];
  userId: string;
  busy?: boolean;
  onYes: () => void;
  onNo: () => void;
  onPick: (optionId: string) => void;
  onCancel: () => void;
  // Opens the squad or plan the vote is about.
  onOpen: () => void;
};

// The vote in front: blue, answered on its stub. Yes / No sit on a stub to
// the right; a question's choices hang under a tear line instead.
export function VoteTicket({ vote, members, people, userId, busy = false, onYes, onNo, onPick, onCancel, onOpen }: VoteTicketProps) {
  const mine = vote.proposedBy === userId;
  const question = voteQuestion(vote.kind, vote.targetName);
  const target = vote.target;
  const event = target.type === 'plan' ? target.event : null;
  const aboutMe = target.type === 'user' && target.user.id === userId;
  const deciding = membersWhoVote(vote.kind, members);
  const kicker = (
    target.type === 'plan' ? plannerLine(vote, userId) : `${askerOf(vote, userId)} asked · ${dayOf(vote.createdAt)}`
  ).toUpperCase();
  // A plan opens once the vote made it.
  const opensTarget = target.type === 'squad' || (target.type === 'plan' && target.created);
  const faces = people.length > 0 ? ` ${facesSummary(vote, people, userId)}.` : '';

  const head = (lineText: string) => (
    <>
      <Text style={styles.kick} numberOfLines={target.type === 'plan' ? 2 : 1}>
        {kicker}
      </Text>
      <Text style={styles.ttl} numberOfLines={3}>
        {question}
      </Text>
      <Text style={styles.line} numberOfLines={2}>
        {lineText}
      </Text>
      <Faces vote={vote} people={people} userId={userId} />
    </>
  );

  if (target.type === 'poll') {
    const picked = target.myOption;
    return (
      <View style={[styles.ticket, styles.ticketTall]}>
        <View style={[styles.main, styles.mainTall]} accessible accessibilityLabel={`${question}. ${kicker}. ${vote.voted} of ${deciding} answered.${faces}`}>
          {head(`${vote.voted} of ${deciding} answered · more than half wins`)}
        </View>
        <TearLine />
        <View style={styles.options}>
          {target.options.map((option) => {
            const chosen = picked === option.id;
            const share = Math.min(1, option.votes / Math.max(1, deciding));
            const pickers = vote.ballots
              .filter((ballot) => ballot.optionId === option.id)
              .map((ballot) => people.find((person) => person.id === ballot.userId))
              .filter((person): person is Person => person !== undefined);
            return (
              <Pressable
                key={option.id}
                onPress={() => onPick(option.id)}
                disabled={busy || chosen}
                accessibilityRole="button"
                accessibilityLabel={`${option.label}, ${option.votes} ${option.votes === 1 ? 'vote' : 'votes'}${
                  pickers.length > 0 ? `: ${pickers.map((person) => nameOf(person, userId)).join(', ')}` : ''
                }${chosen ? ', your choice' : ''}`}
                accessibilityState={{ selected: chosen, disabled: busy }}
                style={({ pressed }) => [styles.opt, chosen && styles.optMine, (pressed || busy) && styles.pressed]}
              >
                <View style={[styles.bar, chosen && styles.barMine, { width: `${Math.round(share * 100)}%` }]} />
                {chosen ? <Ionicons name="checkmark" size={16} color={brand[0]} /> : null}
                <Text style={[styles.optText, chosen && styles.optTextMine]} numberOfLines={2}>
                  {option.label}
                </Text>
                {/* Who picked it, while a few faces fit. */}
                {pickers.length > 0 && pickers.length <= PICKERS_SHOWN ? (
                  <View style={styles.pickers}>
                    {pickers.map((person) => (
                      <Monogram
                        key={person.id}
                        name={person.name || '?'}
                        uri={person.avatarUrl ?? null}
                        size={MINI}
                        ring={1.5}
                        ringColor={chosen ? colors.surface : brand[0]}
                        style={styles.picker}
                      />
                    ))}
                  </View>
                ) : null}
                <Text style={[styles.optCount, chosen && styles.optTextMine]}>{option.votes}</Text>
              </Pressable>
            );
          })}
          <View style={styles.optFoot}>
            <Text style={styles.optHint}>
              {picked ? 'Tap another choice to change your pick.' : 'Tap one. You can change it while it is open.'}
            </Text>
            {mine ? (
              <Pressable
                onPress={onCancel}
                disabled={busy}
                accessibilityRole="button"
                accessibilityLabel="Cancel this vote"
                style={({ pressed }) => [styles.cancel, (pressed || busy) && styles.pressed]}
              >
                <Text style={styles.cancelText}>Cancel vote</Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      </View>
    );
  }

  const where = event ? placeLines(event.location, event.placeLabel).primary : '';
  const lineText = event
    ? [formatDateTime(event.date, event.startTime), where].filter(Boolean).join(' · ')
    : target.type === 'user'
      ? `${aboutMe ? 'You' : vote.targetName} ${aboutMe ? "don't" : "doesn't"} vote · ${vote.yes} yes, ${vote.no} no`
      : progressLine(vote, people, userId, deciding);

  let stub: ReactNode;
  if (aboutMe) {
    stub = <Text style={styles.stubNote}>About you. You don't vote on it.</Text>;
  } else if (mine) {
    stub = (
      <>
        {vote.myVote === null ? (
          <StubButton text="Yes" label={`Vote yes: ${question}`} tone="strong" disabled={busy} onPress={onYes} />
        ) : (
          <SaidChip yes={vote.myVote} />
        )}
        <StubButton label="Cancel" hint="Cancels this vote for everyone" tone="soft" disabled={busy} onPress={onCancel} />
      </>
    );
  } else if (vote.myVote === true) {
    stub = (
      <>
        <SaidChip yes />
        <StubButton label="No" hint="Changes your vote to no" tone="soft" disabled={busy} onPress={onNo} />
      </>
    );
  } else if (vote.myVote === false) {
    stub = (
      <>
        <StubButton label="Yes" hint="Changes your vote to yes" tone="strong" disabled={busy} onPress={onYes} />
        <SaidChip yes={false} />
      </>
    );
  } else {
    stub = (
      <>
        <StubButton text="Yes" label={`Vote yes: ${question}`} tone="strong" disabled={busy} onPress={onYes} />
        <StubButton text="No" label={`Vote no: ${question}`} tone="soft" disabled={busy} onPress={onNo} />
      </>
    );
  }

  return (
    <View style={styles.ticket}>
      {opensTarget ? (
        <Pressable
          onPress={onOpen}
          accessibilityRole="button"
          accessibilityLabel={`${question}. ${lineText}.${faces} Open ${vote.targetName}`}
          style={({ pressed }) => [styles.main, pressed && styles.mainPressed]}
        >
          {head(lineText)}
        </Pressable>
      ) : (
        <View style={styles.main} accessible accessibilityLabel={`${question}. ${kicker}. ${lineText}.${faces}`}>
          {head(lineText)}
        </View>
      )}
      <Perforation />
      <View style={styles.stub}>{stub}</View>
    </View>
  );
}

// Any other open vote: one line on the rail. Tap it and it becomes the ticket.
export function VoteRow({ vote, userId, waiting, onPress }: { vote: SquadVote; userId: string; waiting: boolean; onPress: () => void }) {
  const question = voteQuestion(vote.kind, vote.targetName);
  const by = askerOf(vote, userId);
  const aboutMe = vote.target.type === 'user' && vote.target.user.id === userId;
  const poll = vote.target.type === 'poll';
  const sub =
    vote.target.type === 'user'
      ? `${by} asked · ${aboutMe ? "you don't vote" : `${vote.targetName} doesn't vote`}`
      : vote.target.type === 'plan'
        ? `${plannerLine(vote, userId)} · ${formatDateTime(vote.target.event.date, vote.target.event.startTime)}`
        : `${by} asked · ${softDay(vote.createdAt)}`;
  const said = aboutMe ? 'about you' : poll ? 'picked' : vote.myVote ? 'you: yes' : 'you: no';

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${question}. ${sub}. ${waiting ? 'Needs your vote' : said}. Show it`}
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
    >
      <View style={styles.rowText}>
        <Text style={styles.rowTitle} numberOfLines={1}>
          {question}
        </Text>
        <Text style={styles.rowSub} numberOfLines={1}>
          {sub}
        </Text>
      </View>
      {waiting ? <Text style={styles.askChip}>{poll ? 'PICK' : 'VOTE'}</Text> : <Text style={styles.rowMeta}>{said}</Text>}
    </Pressable>
  );
}

// One tap: the phone's share sheet with the link. Where there is no share
// sheet (most desktop browsers) it is copied instead, like the old invite.
// The link is read fresh first, so one used in the meantime is not sent again.
export function useInviteShare(vote: SquadVote, onStale?: () => void) {
  const [notice, setNotice] = useState<string | null>(null);
  const [sharing, setSharing] = useState(false);
  const link = vote.target.type === 'invite' ? vote.target.link : null;

  async function share() {
    if (sharing || !link) return;
    setSharing(true);
    setNotice(null);

    try {
      const fresh = await getVoteLink(vote.id).catch(() => link);
      if (!fresh || fresh.usedAt || inviteExpiry(fresh.createdAt).expired) {
        setNotice(fresh && !fresh.usedAt ? 'This invite has expired. Start a new invite vote.' : 'This invite was used already.');
        onStale?.();
        return;
      }

      const message = inviteMessage(vote.squadName, fresh.code);
      try {
        if (Platform.OS === 'web' && !(typeof navigator !== 'undefined' && 'share' in navigator)) {
          throw new Error('No share sheet');
        }
        await Share.share({ message });
      } catch {
        try {
          await Clipboard.setStringAsync(message);
          setNotice(`Invite copied. Paste it to ${vote.targetName}.`);
        } catch {
          setNotice('Could not share the invite. Try again.');
        }
      }
    } finally {
      setSharing(false);
    }
  }

  return { share, sharing, notice };
}

// A passed invite whose link still waits to be sent: admit one.
export function InviteTicket({ vote, members, userId, onStale }: { vote: SquadVote; members: number; userId: string; onStale: () => void }) {
  const { share, sharing, notice } = useInviteShare(vote, onStale);
  const link = vote.target.type === 'invite' ? vote.target.link : null;
  const days = link ? inviteDaysLeft(link.createdAt) : INVITE_DAYS;
  const line = `${askerOf(vote, userId)} asked · passed ${vote.yes} of ${membersWhoVote(vote.kind, members)}`;

  return (
    <View style={styles.inviteWrap}>
      <View style={styles.invite}>
        <View style={styles.main} accessible accessibilityLabel={`Invite for ${vote.targetName}. ${line}`}>
          <Text style={[styles.kick, styles.kickBlue]}>ADMIT ONE · WORKS ONCE</Text>
          <Text style={styles.inviteName} numberOfLines={1}>
            {vote.targetName}
          </Text>
          <Text style={[styles.line, styles.lineSoft]} numberOfLines={2}>
            {line}
          </Text>
        </View>
        <View style={styles.invitePerf} pointerEvents="none">
          <View style={[styles.notch, styles.notchTop]} />
          <View style={styles.dashes}>
            {Array.from({ length: DASHES }, (_, i) => (
              <View key={i} style={[styles.dash, styles.dashDark]} />
            ))}
          </View>
          <View style={[styles.notch, styles.notchBottom]} />
        </View>
        <View style={[styles.stub, styles.inviteStub]}>
          <StubButton
            label="Share"
            hint={`Shares the invite with ${vote.targetName}. The link works once`}
            tone="ink"
            icon="share-outline"
            disabled={sharing}
            onPress={share}
          />
          <Text style={styles.daysLeft}>{days === 1 ? '1 DAY LEFT' : `${days} DAYS LEFT`}</Text>
        </View>
      </View>
      {notice ? (
        <Text style={styles.notice} accessibilityLiveRegion="polite">
          {notice}
        </Text>
      ) : null}
    </View>
  );
}

type Stamp = { tone: 'pass' | 'rej' | 'win' | 'off'; top: string; bottom?: string };

function stampOf(vote: SquadVote): Stamp {
  const score = `${vote.yes}–${vote.no}`;
  const poll = vote.target.type === 'poll';
  const link = vote.target.type === 'invite' ? vote.target.link : null;
  if (vote.status === 'passed') {
    if (poll) return { tone: 'win', top: vote.payload.winner ?? 'Decided', bottom: 'won' };
    if (link && !link.usedAt && inviteExpiry(link.createdAt).expired) return { tone: 'off', top: 'Expired' };
    return { tone: 'pass', top: 'Passed', bottom: score };
  }
  if (vote.status === 'rejected') return poll ? { tone: 'rej', top: 'No clear winner' } : { tone: 'rej', top: 'Voted down', bottom: score };
  return { tone: 'off', top: vote.status === 'cancelled' ? 'Cancelled' : 'Expired' };
}

// What came of it, in words.
function outcomeOf(vote: SquadVote, by: string): string {
  const name = vote.targetName;
  const squad = vote.squadName;
  const target = vote.target;
  if (vote.status === 'cancelled') return `${by} cancelled it`;
  if (vote.status === 'expired') return target.type === 'plan' ? 'The day went by first' : 'It ran out of time';

  if (target.type === 'poll') {
    if (vote.status === 'rejected') return 'A tie decides nothing';
    const won = target.options.find((option) => option.id === target.winnerId);
    return won ? `${won.label}, with ${won.votes} of ${vote.voted} picks` : `${vote.payload.winner ?? 'One choice'} won`;
  }
  if (target.type === 'invite') {
    if (vote.status === 'rejected') return 'No invite';
    if (target.link?.usedAt) return `Joined · ${target.link.usedByName ?? 'someone new'}`;
    return 'The link ran out before it was used';
  }

  const passed = vote.status === 'passed';
  switch (vote.kind) {
    case 'follow':
      return passed ? `${squad} follows them now` : 'Not following them';
    case 'unfollow':
      return passed ? 'Not following them any more' : 'Still following them';
    case 'plan':
      return passed ? `On ${squad}'s plans now` : 'Not this time';
    case 'remove':
      return passed ? `${name} is out` : `${name} stays`;
    case 'rename':
      return passed ? 'The new name is on' : 'The name stays';
    case 'photo':
      return passed ? 'The new photo is on' : 'The photo stays';
    case 'memories':
      return passed ? `Memories are ${name} now` : 'They stay as they were';
    default:
      return passed ? 'Passed' : 'Voted down';
  }
}

// "followed Kathisterimenou", for "Last: …" above the line.
export function decidedLine(vote: SquadVote): string {
  const name = vote.targetName;
  if (vote.status === 'cancelled') return 'a vote was cancelled';
  if (vote.status === 'expired') return 'a vote ran out of time';
  if (vote.target.type === 'poll') {
    return vote.status === 'passed' ? `${vote.payload.winner ?? 'a choice'} won` : 'no clear winner';
  }
  if (vote.status === 'rejected') return `no to "${voteQuestion(vote.kind, name).replace(/\?$/, '')}"`;
  switch (vote.kind) {
    case 'follow':
      return `followed ${name}`;
    case 'unfollow':
      return `unfollowed ${name}`;
    case 'plan':
      return `planned ${name}`;
    case 'invite':
      return `invited ${name}`;
    case 'remove':
      return `${name} left`;
    case 'rename':
      return `renamed to ${name}`;
    case 'photo':
      return 'a new photo';
    case 'memories':
      return `memories ${name}`;
    default:
      return 'passed';
  }
}

// A vote that is over: a used ticket, the stub torn off and stamped.
export function UsedVoteTicket({ vote, userId }: { vote: SquadVote; userId: string }) {
  const by = askerOf(vote, userId);
  const question = voteQuestion(vote.kind, vote.targetName);
  const stamp = stampOf(vote);
  const outcome = outcomeOf(vote, by);
  const tone =
    stamp.tone === 'pass' ? colors.success : stamp.tone === 'rej' ? RED_TEXT : stamp.tone === 'win' ? colors.text : colors.textSoft;
  const kicker = [dayOf(vote.closedAt), `${by.toUpperCase()} ASKED`].filter(Boolean).join(' · ');

  return (
    <View
      style={styles.used}
      accessible
      accessibilityLabel={`${question}. ${[stamp.top, stamp.bottom].filter(Boolean).join(' ')}. ${outcome}. ${by} asked`}
    >
      <View style={styles.usedMain}>
        <Text style={[styles.kick, styles.kickSoft]} numberOfLines={1}>
          {kicker}
        </Text>
        <Text style={styles.usedTitle} numberOfLines={2}>
          {question}
        </Text>
        <Text style={styles.usedSub} numberOfLines={2}>
          {outcome}
        </Text>
      </View>
      <View style={styles.usedStub}>
        <View style={[styles.stamp, { borderColor: tone }]}>
          <Text style={[styles.stampTop, { color: tone }]} numberOfLines={2}>
            {stamp.top}
          </Text>
          {stamp.bottom ? <Text style={[styles.stampBottom, { color: tone }]}>{stamp.bottom}</Text> : null}
        </View>
      </View>
    </View>
  );
}

// How a new question will land on the line, drawn while it is being written.
export function PollPreview({ question, options, members, notch }: { question: string; options: string[]; members: number; notch: string }) {
  return (
    <View
      style={[styles.ticket, styles.ticketTall, styles.preview]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <View style={[styles.main, styles.mainTall]}>
        <Text style={styles.kick}>YOU ASKED · TODAY</Text>
        <Text style={styles.ttl} numberOfLines={3}>
          {question.trim() || 'Your question'}
        </Text>
        <Text style={styles.line}>0 of {Math.max(1, members)} answered · more than half wins</Text>
      </View>
      <TearLine notch={notch} />
      <View style={styles.options}>
        {options.map((option, index) => (
          <View key={index} style={[styles.opt, styles.optPreview]}>
            <Text style={styles.optText} numberOfLines={1}>
              {option.trim() || `Choice ${index + 1}`}
            </Text>
            <Text style={styles.optCount}>0</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  pressed: { opacity: 0.7 },
  disabled: { opacity: 0.5 },

  ticket: {
    flexDirection: 'row',
    marginTop: 2,
    marginBottom: space.xs,
    borderRadius: radius.lg,
    backgroundColor: brand[0],
    shadowColor: brand[0],
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.22,
    shadowRadius: 14,
    elevation: 5,
  },
  ticketTall: { flexDirection: 'column' },
  preview: { marginTop: 0, marginBottom: 0, elevation: 0, shadowOpacity: 0 },
  main: { flex: 1, minWidth: 0, paddingVertical: 12, paddingLeft: 14, paddingRight: space.sm, gap: 3 },
  // Stacked (a question): as tall as its text, not stretched.
  mainTall: { flexGrow: 0, flexShrink: 0, flexBasis: 'auto' },
  mainPressed: { opacity: 0.85 },
  kick: { color: ON_BLUE_KICKER, ...typo.mono, fontSize: 10.5, letterSpacing: 1.4 },
  kickBlue: { color: colors.primary },
  kickSoft: { color: colors.textSoft },
  ttl: { color: colors.onInk, ...typo.display, fontSize: 16, lineHeight: 20, letterSpacing: -0.2 },
  line: { color: ON_BLUE_LINE, ...typo.semi, fontSize: textSize.small },
  lineSoft: { color: colors.textSoft },

  faces: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 4, marginTop: 5 },
  face: { width: FACE, height: FACE, borderRadius: FACE / 2, alignItems: 'center', justifyContent: 'center' },
  faceYes: { backgroundColor: colors.success },
  faceNo: { backgroundColor: tint.danger },
  faceWait: { borderWidth: 1.5, borderStyle: 'dashed', borderColor: 'rgba(255,255,255,0.6)' },
  faceOut: { backgroundColor: 'rgba(255,255,255,0.14)' },
  faceInitial: { color: ON_BLUE_LINE, ...typo.bold, fontSize: textSize.caption },
  facesMore: { color: ON_BLUE_LINE, ...typo.semi, fontSize: textSize.small, marginLeft: 2 },
  facesRule: { width: 1, height: 16, marginHorizontal: 3, backgroundColor: 'rgba(255,255,255,0.3)' },

  // The dashes are as tall as the ticket, not the other way round.
  perf: { width: 2, marginVertical: 8 },
  dashes: { position: 'absolute', top: 0, bottom: 0, left: 0, width: 2, gap: 4, overflow: 'hidden' },
  dash: { width: 2, height: 5, borderRadius: 1, backgroundColor: 'rgba(255,255,255,0.28)' },
  dashDark: { backgroundColor: colors.border },

  tear: { height: 16, flexDirection: 'row', alignItems: 'center' },
  notch: { position: 'absolute', width: 16, height: 16, borderRadius: 8, backgroundColor: colors.bg },
  notchLeft: { left: -8, top: 0 },
  notchRight: { right: -8, top: 0 },
  notchTop: { top: -8, left: 0 },
  notchBottom: { bottom: -8, left: 0 },
  tearDashes: { flex: 1, height: 2, marginHorizontal: 14, flexDirection: 'row', gap: 4, overflow: 'hidden' },
  tearDash: { width: 5, height: 2, borderRadius: 1, backgroundColor: 'rgba(255,255,255,0.3)' },
  tearDashDark: { backgroundColor: colors.border },

  stub: { width: 104, justifyContent: 'center', gap: 6, padding: 10 },
  stubNote: { color: ON_BLUE_LINE, ...typo.semi, fontSize: textSize.small, textAlign: 'center' },
  act: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingHorizontal: 4,
    borderRadius: radius.sm,
  },
  actStrong: { backgroundColor: colors.surface },
  actSoft: { backgroundColor: 'rgba(255,255,255,0.15)' },
  actInk: { backgroundColor: colors.ink },
  actPressed: { transform: [{ scale: 0.95 }] },
  actText: { ...typo.display, fontSize: textSize.body },
  saidYes: { backgroundColor: tint.success },
  saidNo: { backgroundColor: tint.danger },

  options: { gap: 6, paddingHorizontal: 12, paddingTop: 4, paddingBottom: 12 },
  opt: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.12)',
    overflow: 'hidden',
  },
  optPreview: { minHeight: 38 },
  optMine: { backgroundColor: colors.surface },
  // How much of the squad picked it, drawn behind the label.
  bar: { position: 'absolute', top: 0, bottom: 0, left: 0, backgroundColor: 'rgba(255,255,255,0.16)' },
  barMine: { backgroundColor: paper.accentSoft },
  optText: { flex: 1, color: colors.onInk, ...typo.bold, fontSize: textSize.base },
  optTextMine: { color: brand[0] },
  optCount: { color: colors.onInk, ...typo.display, fontSize: textSize.base, fontVariant: ['tabular-nums'] },
  pickers: { flexDirection: 'row' },
  picker: { marginLeft: -4 },
  optFoot: { flexDirection: 'row', alignItems: 'center', gap: space.xs, paddingHorizontal: 2 },
  optHint: { flex: 1, color: ON_BLUE_LINE, ...typo.semi, fontSize: textSize.small },
  cancel: { minHeight: 44, justifyContent: 'center', paddingHorizontal: space.xs },
  cancelText: { color: colors.onInk, ...typo.bold, fontSize: textSize.small, textDecorationLine: 'underline' },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    minHeight: 54,
    paddingHorizontal: 12,
    paddingVertical: 7,
    marginBottom: space.xs,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: 'rgba(255,255,255,0.62)',
  },
  rowPressed: { backgroundColor: colors.surface },
  rowText: { flex: 1, minWidth: 0 },
  rowTitle: { color: colors.text, ...typo.bold, fontSize: textSize.base },
  rowSub: { color: colors.textSoft, ...typo.medium, fontSize: textSize.small },
  rowMeta: { color: colors.textSoft, ...typo.semi, fontSize: textSize.small },
  askChip: {
    overflow: 'hidden',
    color: SUN_TEXT,
    backgroundColor: tint.sun,
    ...typo.mono,
    fontSize: 10.5,
    letterSpacing: 1,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.pill,
  },

  inviteWrap: { marginTop: 2, marginBottom: space.xs, gap: space.xs },
  invite: { flexDirection: 'row', borderRadius: radius.lg, backgroundColor: colors.surface, ...shadow.card },
  inviteName: { color: colors.text, ...typo.display, fontSize: textSize.heading, letterSpacing: -0.4 },
  invitePerf: { width: 16, alignItems: 'center', overflow: 'visible' },
  inviteStub: { width: 96, paddingLeft: 2 },
  daysLeft: { color: SUN_TEXT, ...typo.mono, fontSize: 10.5, letterSpacing: 1, textAlign: 'center' },
  notice: { color: colors.textSoft, ...typo.medium, fontSize: textSize.small },

  used: { flexDirection: 'row', gap: 2, marginBottom: space.xs },
  usedMain: {
    flex: 1,
    minWidth: 0,
    gap: 2,
    paddingVertical: 11,
    paddingLeft: 14,
    paddingRight: 12,
    borderTopLeftRadius: radius.md,
    borderBottomLeftRadius: radius.md,
    backgroundColor: colors.surface,
    ...shadow.bubble,
  },
  usedTitle: { color: colors.text, ...typo.bold, fontSize: textSize.base },
  usedSub: { color: colors.textSoft, ...typo.medium, fontSize: textSize.small },
  usedStub: {
    width: 104,
    alignItems: 'center',
    justifyContent: 'center',
    padding: space.xxs,
    borderTopRightRadius: radius.md,
    borderBottomRightRadius: radius.md,
    backgroundColor: colors.surface,
    ...shadow.bubble,
  },
  stamp: {
    maxWidth: 96,
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingTop: 4,
    paddingBottom: 3,
    borderWidth: 2,
    borderRadius: 7,
    transform: [{ rotate: '-7deg' }],
  },
  stampTop: { ...typo.display, fontSize: textSize.caption, letterSpacing: 0.2, textAlign: 'center' },
  stampBottom: { ...typo.bold, fontSize: textSize.caption, fontVariant: ['tabular-nums'], textAlign: 'center' },
});
