import { useEffect, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { BoardRow, Crossing, Wave } from '../../services/serviceCrossed';
import { parseDateKey } from '../../lib/datetime';
import Monogram from '../general/Monogram';
import { colors, radius, space, textSize, typo } from '../../theme';

// What meeting other pareas adds to a parea's line: a strip on the night you
// crossed one ("Rooftop Gang was there too"), a wave in that night's stub, and
// your place in the city under the month.

const TINT = '#E8EDFD';
const TINT_PRESSED = '#DCE4FC';
const DONE = '#E2F1EA';

// Two pareas joined by the ticket's tear line.
function Pair({ a, b, size = 22 }: { a: { name: string; avatarUrl: string | null }; b: { name: string; avatarUrl: string | null }; size?: number }) {
  return (
    <View style={styles.pair} accessible={false}>
      <Monogram name={a.name} uri={a.avatarUrl} size={size} style={{ borderRadius: size * 0.32 }} />
      <View style={[styles.link, { width: size * 0.6 }]} />
      <Monogram name={b.name} uri={b.avatarUrl} size={size} style={{ borderRadius: size * 0.32 }} />
    </View>
  );
}

function ordinal(n: number) {
  return ['First', 'Second', 'Third', 'Fourth', 'Fifth'][n - 1] ?? `${n}th`;
}

export function CrossedStrip({
  mine,
  crossing,
  onPress,
}: {
  mine: { name: string; avatarUrl: string | null };
  crossing: Crossing;
  onPress: () => void;
}) {
  const again = crossing.times > 1 ? ` ${ordinal(crossing.times)} time lately.` : '';
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${crossing.otherName} was there too.${again} See where you crossed`}
      style={({ pressed }) => [styles.strip, pressed && styles.stripPressed]}
    >
      <Pair a={mine} b={{ name: crossing.otherName, avatarUrl: crossing.otherAvatarUrl }} />
      <Text style={styles.stripText} numberOfLines={2}>
        <Text style={styles.stripStrong}>{crossing.otherName} was there too.</Text>
        {again}
      </Text>
      <Ionicons name="chevron-forward" size={15} color={colors.primary} />
    </Pressable>
  );
}

export function WaveRow({
  wave,
  parea,
  place,
  busy,
  onWaveBack,
}: {
  wave: Wave;
  parea: string;
  place: string | null;
  busy: boolean;
  onWaveBack: () => void;
}) {
  return (
    <View style={styles.wave}>
      <Ionicons name="hand-left" size={20} color={colors.primary} />
      <Text style={styles.waveText} numberOfLines={3}>
        <Text style={styles.waveStrong}>{wave.fromName} waved at {parea}.</Text>
        {place ? ` You were both near ${place}.` : ' You were out the same night.'}
      </Text>
      <Pressable
        onPress={onWaveBack}
        hitSlop={4}
        disabled={wave.wavedBack || busy}
        accessibilityRole="button"
        accessibilityState={{ disabled: wave.wavedBack || busy }}
        style={({ pressed }) => [styles.waveButton, wave.wavedBack && styles.waveDone, pressed && styles.pressed]}
      >
        <Text style={[styles.waveButtonText, wave.wavedBack && styles.waveDoneText]}>
          {wave.wavedBack ? 'Waved' : 'Wave back'}
        </Text>
      </Pressable>
    </View>
  );
}

// Under a month's diamond: where the parea stood in the city that month.
export function RankRow({ mine, rows, month, onPress }: { mine: BoardRow; rows: BoardRow[]; month: string; onPress: () => void }) {
  const fifth = rows.find((row) => row.place >= 5 && !row.isMine) ?? rows[Math.min(4, rows.length - 1)];
  const gap = fifth && mine.place > 5 ? Math.max(1, fifth.nights - mine.nights + 1) : 0;
  const line =
    mine.place <= 5
      ? `In the city's top five, with ${mine.nights} public ${mine.nights === 1 ? 'night' : 'nights'}.`
      : `${gap} more ${gap === 1 ? 'night' : 'nights'} would have made the top five.`;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Number ${mine.place} in the city in ${month}. ${line} See the board`}
      style={({ pressed }) => [styles.rank, pressed && styles.rankPressed]}
    >
      <Text style={styles.rankPlace}>#{mine.place}</Text>
      <View style={styles.rankText}>
        <Text style={styles.rankTitle}>In the city in {month}</Text>
        <Text style={styles.rankLine}>{line}</Text>
      </View>
      <Ionicons name="chevron-forward" size={15} color={colors.textFaint} />
    </Pressable>
  );
}

function Sheet({ visible, onClose, children }: { visible: boolean; onClose: () => void; children: React.ReactNode }) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close">
        <Pressable style={styles.sheet} onPress={() => {}}>
          <View style={styles.grabber} />
          <ScrollView contentContainerStyle={styles.sheetBody}>{children}</ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

export function CrossedSheet({
  mine,
  crossings,
  onClose,
  onWave,
  onOpenGroup,
}: {
  mine: { name: string; avatarUrl: string | null };
  // Every crossing with one parea; empty when closed.
  crossings: Crossing[];
  onClose: () => void;
  onWave: (otherGroupId: string) => Promise<boolean>;
  onOpenGroup: (otherGroupId: string) => void;
}) {
  const [state, setState] = useState<'idle' | 'busy' | 'sent' | 'already' | 'error'>('idle');
  const other = crossings[0];
  // A new parea starts fresh, whatever happened in the last sheet.
  const otherId = other?.otherGroupId;
  useEffect(() => {
    setState('idle');
  }, [otherId]);
  // Two of your nights the same evening are still one night you crossed.
  const nights = [...new Map(crossings.map((c) => [`${c.night}-${c.otherEventId}`, c])).values()];

  async function wave() {
    if (!other) return;
    setState('busy');
    try {
      setState((await onWave(other.otherGroupId)) ? 'sent' : 'already');
    } catch {
      setState('error');
    }
  }

  return (
    <Sheet
      visible={crossings.length > 0}
      onClose={() => {
        setState('idle');
        onClose();
      }}
    >
      {other ? (
        <>
          <Pair a={mine} b={{ name: other.otherName, avatarUrl: other.otherAvatarUrl }} size={44} />
          <Text style={styles.sheetTitle}>You and {other.otherName}</Text>
          <Text style={styles.sheetLead}>
            {nights.length === 1 ? 'One public night' : `${nights.length} public nights`} lately, a few streets apart.
          </Text>
          <View style={styles.list}>
            {nights.map((c) => (
              <View key={`${c.myEventId}-${c.otherEventId}`} style={styles.listRow}>
                <Ionicons name="location" size={18} color={colors.primary} />
                <View style={styles.listText}>
                  <Text style={styles.listTitle}>{c.place ?? c.otherTitle}</Text>
                  <Text style={styles.listSub}>
                    {longDate(c.night)}, their night: {c.otherTitle}
                  </Text>
                </View>
              </View>
            ))}
          </View>
          <View style={styles.actions}>
            <Pressable
              onPress={wave}
              disabled={state === 'busy' || state === 'sent' || state === 'already'}
              accessibilityRole="button"
              style={({ pressed }) => [styles.action, styles.actionSoft, (state === 'sent' || state === 'already') && styles.actionDone, pressed && styles.pressed]}
            >
              <Ionicons name="hand-left" size={17} color={state === 'sent' || state === 'already' ? colors.success : colors.primary} />
              <Text style={[styles.actionSoftText, (state === 'sent' || state === 'already') && styles.waveDoneText]}>
                {state === 'sent' ? 'Waved' : state === 'already' ? 'Waved this week' : 'Wave'}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => onOpenGroup(other.otherGroupId)}
              accessibilityRole="button"
              style={({ pressed }) => [styles.action, styles.actionInk, pressed && styles.pressed]}
            >
              <Text style={styles.actionInkText}>See their nights</Text>
            </Pressable>
          </View>
          {state === 'error' ? <Text style={styles.error}>Couldn't send the wave. Try again.</Text> : null}
          <Text style={styles.fine}>Only nights both pareas made public count. Nobody sees where you are now.</Text>
        </>
      ) : null}
    </Sheet>
  );
}

export function BoardSheet({ month, rows, onClose }: { month: string | null; rows: BoardRow[]; onClose: () => void }) {
  return (
    <Sheet visible={month !== null} onClose={onClose}>
      <Text style={styles.sheetTitle}>Out the most in {month}</Text>
      <Text style={styles.sheetLead}>Pareas in the city, by public nights out.</Text>
      <View style={styles.board}>
        {rows.map((row) => (
          <View key={row.groupId} style={[styles.boardRow, row.isMine && styles.boardMine]}>
            <Text style={[styles.boardPlace, row.isMine && styles.boardMineText]}>{row.place}</Text>
            <Monogram name={row.name} uri={row.avatarUrl} size={30} style={{ borderRadius: 10 }} />
            <Text style={[styles.boardName, row.isMine && styles.boardMineText]} numberOfLines={1}>
              {row.name}
            </Text>
            <Text style={styles.boardNights}>
              {row.nights} {row.nights === 1 ? 'night' : 'nights'}
            </Text>
          </View>
        ))}
      </View>
      <Text style={styles.fine}>Only public nights count.</Text>
    </Sheet>
  );
}

// "Friday 2 October"
function longDate(date: string) {
  const d = parseDateKey(date);
  return d ? d.toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long' }).replace(',', '') : date;
}

const styles = StyleSheet.create({
  pressed: { opacity: 0.7 },
  pair: { flexDirection: 'row', alignItems: 'center' },
  link: { height: 0, borderTopWidth: 2, borderStyle: 'dashed', borderColor: colors.primary, marginHorizontal: -1 },

  strip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    minHeight: 44,
    marginHorizontal: 12,
    marginBottom: 2,
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderRadius: radius.sm,
    backgroundColor: TINT,
  },
  stripPressed: { backgroundColor: TINT_PRESSED },
  stripText: { flex: 1, color: '#3653D6', ...typo.semi, fontSize: textSize.small, lineHeight: 16 },
  stripStrong: { color: colors.primary, ...typo.display },

  wave: { flexDirection: 'row', alignItems: 'center', gap: space.xs, padding: 9, paddingLeft: 11, borderRadius: radius.sm, backgroundColor: colors.bg },
  waveText: { flex: 1, color: colors.textSoft, ...typo.semi, fontSize: textSize.small, lineHeight: 16 },
  waveStrong: { color: colors.text, ...typo.display },
  waveButton: { minHeight: 36, paddingHorizontal: 12, justifyContent: 'center', borderRadius: radius.pill, backgroundColor: colors.ink },
  waveButtonText: { color: colors.onInk, ...typo.display, fontSize: textSize.small },
  waveDone: { backgroundColor: DONE },
  waveDoneText: { color: colors.success },

  rank: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    marginTop: space.xs,
    minHeight: 48,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  rankPressed: { borderColor: '#B9C6F3' },
  rankPlace: { color: colors.primary, ...typo.display, fontSize: 22, minWidth: 36 },
  rankText: { flex: 1, minWidth: 0 },
  rankTitle: { color: colors.text, ...typo.display, fontSize: textSize.body },
  rankLine: { color: colors.textSoft, ...typo.semi, fontSize: textSize.small },

  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: { maxHeight: '86%', borderTopLeftRadius: radius.sheet, borderTopRightRadius: radius.sheet, backgroundColor: colors.surface },
  grabber: { width: 40, height: 4, alignSelf: 'center', marginTop: space.sm, borderRadius: radius.pill, backgroundColor: colors.borderStrong },
  sheetBody: { padding: space.lg, paddingTop: space.md, gap: space.sm },
  sheetTitle: { marginTop: space.xs, color: colors.text, ...typo.display, fontSize: 22, letterSpacing: -0.3 },
  sheetLead: { color: colors.textSoft, ...typo.medium, fontSize: textSize.base },
  list: { gap: space.sm, marginTop: space.xs },
  listRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  listText: { flex: 1, minWidth: 0 },
  listTitle: { color: colors.text, ...typo.display, fontSize: textSize.base },
  listSub: { color: colors.textSoft, ...typo.medium, fontSize: textSize.small },
  actions: { flexDirection: 'row', gap: space.xs, marginTop: space.sm },
  action: { flex: 1, minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: radius.md },
  actionSoft: { backgroundColor: TINT },
  actionSoftText: { color: colors.primary, ...typo.display, fontSize: textSize.base },
  actionDone: { backgroundColor: DONE },
  actionInk: { backgroundColor: colors.ink },
  actionInkText: { color: colors.onInk, ...typo.display, fontSize: textSize.base },
  error: { color: colors.danger, ...typo.medium, fontSize: textSize.body },
  fine: { color: colors.textFaint, ...typo.medium, fontSize: textSize.small, marginTop: space.xs },

  board: { gap: 4, marginTop: space.xs },
  boardRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: 48, paddingHorizontal: 10, borderRadius: radius.md },
  boardMine: { backgroundColor: TINT },
  boardPlace: { width: 22, color: colors.textSoft, ...typo.display, fontSize: textSize.lead },
  boardName: { flex: 1, color: colors.text, ...typo.bold, fontSize: textSize.base },
  boardMineText: { color: colors.primary },
  boardNights: { color: colors.textSoft, ...typo.semi, fontSize: textSize.small },
});
