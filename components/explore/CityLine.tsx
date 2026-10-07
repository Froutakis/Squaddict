import { useEffect, useRef, useState, type RefObject } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Image, Modal, Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import type { FeedEvent } from '../../services/serviceFeed';
import type { RsvpStatus } from '../../services/serviceEvents';
import {
  clearPhotoReaction,
  getPhotoReactions,
  setPhotoReaction,
  type FeedPhoto,
} from '../../services/servicePhotoFeed';
import { applyReaction, type PhotoReaction } from '../../lib/photoFeed';
import { addDays, isHappeningNow, keyOf, parseDateKey, startOfWeek } from '../../lib/datetime';
import type { SignedMap } from '../chat/media';
import type { Group } from '../../services/serviceGroup';
import Monogram from '../general/Monogram';
import PhotoPost from '../home/PhotoPost';
import PostViewer from '../home/PostViewer';
import { shortPlace } from '../home/LineTicket';
import PlanTicket, { TicketActions, type TicketPill } from '../home/PlanTicket';
import AnswerSeg, { toStatus, type Answer } from '../general/AnswerSeg';
import { DateNode, GroupNode, GroupTitle, TimeNode, TimelineRow, TodayNode } from '../home/Timeline';
import { stretchOf } from '../home/PlanLine';
import { colors, onPhoto, radius, scrim, space, spot as spotInk, sun, sunInk, textSize, typo } from '../../theme';

// Explore as a line, the same idea as Home one step out: the city's line.
// Above now, open public plans you can join (furthest on top); below, the
// public nights you went to, with what every parea there kept. The rail
// shows whose night it is.

const PLANS_SHOWN = 15;
const SPOT_MIN_PAREAS = 2;

type CityLineProps = {
  plans: FeedEvent[];
  nights: FeedPhoto[];
  nightsLoading: boolean;
  now: Date;
  // Where distances are measured from; null when location is off.
  center: { lat: number; lng: number } | null;
  me: { id: string; name: string; avatarUrl: string | null };
  // The parea your reactions go out as; null when you're in none.
  acting: Group | null;
  savingId: string | null;
  signed: SignedMap;
  signPaths: (paths: string[]) => void;
  onImageError: (path: string) => void;
  onOpenPlan: (plan: FeedEvent) => void;
  onRsvp: (plan: FeedEvent, status: RsvpStatus | null) => void;
  onOpenGroup: (groupId: string) => void;
  onShowMap: () => void;
  // When filters hide every plan, a way to clear them.
  onClearFilters?: () => void;
  // Suggest a public plan to the parea you act as (it lands in its chat).
  // Left out for plans that can't be suggested there.
  suggestTo?: string | null;
  canSuggest?: (plan: FeedEvent) => boolean;
  onSuggest?: (plan: FeedEvent) => void;
  suggestingId?: string | null;
  // The NOW row, so the page can open on it; onNowLayout says when it moved.
  nowRef?: RefObject<View | null>;
  // Where today starts (Tonight, or NOW when nothing is on tonight).
  todayRef?: RefObject<View | null>;
  onTodayLayout?: () => void;
  onNowLayout?: () => void;
  // 'nights' leaves the plans out: only the city's nights under NOW.
  show?: 'all' | 'nights';
  // The parea yours crossed most lately, between the plans.
  crossing?: { name: string; avatarUrl: string | null; times: number; onPress: () => void } | null;
};

export default function CityLine({
  plans,
  nights,
  nightsLoading,
  now,
  center,
  me,
  acting,
  savingId,
  signed,
  signPaths,
  onImageError,
  onOpenPlan,
  onRsvp,
  onOpenGroup,
  onShowMap,
  onClearFilters,
  suggestTo = null,
  canSuggest,
  onSuggest,
  suggestingId = null,
  nowRef,
  todayRef,
  onTodayLayout,
  onNowLayout,
  show = 'all',
  crossing = null,
}: CityLineProps) {
  const [reactions, setReactions] = useState<Record<string, PhotoReaction[]>>({});
  const [openPost, setOpenPost] = useState<FeedPhoto | null>(null);
  const [spotOpen, setSpotOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // One plan chosen on the line at a time; Maybe is kept here only (see AnswerSeg).
  const [chosen, setChosen] = useState<string | null>(null);
  const [maybes, setMaybes] = useState<Set<string>>(new Set());
  const reactionsRef = useRef(reactions);
  reactionsRef.current = reactions;
  const todayKey = keyOf(now);

  // Photos of the nights on the line, signed; their reactions, loaded.
  const paths = nights.flatMap((n) => [n.photo.path, ...n.more.map((p) => p.path)]).join('|');
  useEffect(() => {
    if (paths !== '') signPaths(paths.split('|'));
  }, [paths, signPaths]);
  const photoIds = nights.map((n) => n.photo.id).join(',');
  useEffect(() => {
    if (photoIds === '') return;
    let cancelled = false;
    getPhotoReactions(photoIds.split(','))
      .then((all) => {
        if (!cancelled) setReactions(all);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [photoIds]);

  async function react(photoId: string, emoji: string) {
    if (!acting) {
      setError('Join or start a parea to react to nights.');
      return;
    }
    const before = reactionsRef.current[photoId] ?? [];
    const after = applyReaction(before, photoId, { userId: me.id, name: me.name, avatarUrl: me.avatarUrl, groupId: acting.id, groupName: acting.name }, emoji);
    const removing = after.length < before.length;
    setError(null);
    setReactions((all) => ({ ...all, [photoId]: after }));
    try {
      if (removing) await clearPhotoReaction(photoId);
      else await setPhotoReaction(photoId, acting.id, emoji);
    } catch {
      setReactions((all) => ({ ...all, [photoId]: before }));
      setError('Could not save your reaction. Try again.');
    }
  }

  // Above now: open plans, soonest first in time, latest on top of the line.
  const open = plans
    .filter((p) => p.date >= todayKey)
    .sort((a, b) => a.date.localeCompare(b.date) || (a.startTime ?? '').localeCompare(b.startTime ?? ''))
    .slice(0, PLANS_SHOWN);
  const tonight = open.filter((p) => p.date === todayKey).length;
  const stretches: { label: string; plans: FeedEvent[] }[] = [];
  for (const plan of [...open].reverse()) {
    const label = plan.date === todayKey ? 'Tonight' : plan.date === keyOf(addDays(now, 1)) ? 'Tomorrow' : stretchOf(plan.date, now);
    const last = stretches[stretches.length - 1];
    if (last && last.label === label) last.plans.push(plan);
    else stretches.push({ label, plans: [plan] });
  }

  // Below now: the city's nights, by week, then by month.
  const groups: { label: string; items: FeedPhoto[] }[] = [];
  for (const item of nights) {
    const label = weekLabel(item.event.date, now);
    const last = groups[groups.length - 1];
    if (last && last.label === label) last.items.push(item);
    else groups.push({ label, items: [item] });
  }
  const spot = spotOfWeek(nights, now);

  function nodeKind(plan: FeedEvent): 'later' | 'live' | 'selected' {
    if (isHappeningNow(plan.date, plan.startTime, plan.endTime, now)) return 'live';
    return chosen === plan.id ? 'selected' : 'later';
  }

  function distance(lat?: number, lng?: number) {
    if (!center || lat === undefined || lng === undefined) return null;
    const km = Math.sqrt(((lat - center.lat) * 111) ** 2 + ((lng - center.lng) * 111 * Math.cos((center.lat * Math.PI) / 180)) ** 2);
    return km < 10 ? `${km.toFixed(1)} km` : `${Math.round(km)} km`;
  }

  // First tap chooses a plan (or grows the one on now); the second opens it.
  function tap(plan: FeedEvent) {
    if (chosen === plan.id) onOpenPlan(plan);
    else setChosen(plan.id);
  }

  function answerOf(plan: FeedEvent): Answer | null {
    if (plan.myStatus) return plan.myStatus;
    return maybes.has(plan.id) ? 'maybe' : null;
  }

  function answer(plan: FeedEvent, choice: Answer) {
    setMaybes((was) => {
      const next = new Set(was);
      if (choice === 'maybe') next.add(plan.id);
      else next.delete(plan.id);
      return next;
    });
    const status = toStatus(choice);
    if (status !== (plan.myStatus ?? null)) onRsvp(plan, status);
  }

  function planRow(plan: FeedEvent) {
    const live = isHappeningNow(plan.date, plan.startTime, plan.endTime, now);
    const place = shortPlace(plan.placeLabel ?? plan.location);
    const far = distance(plan.lat, plan.lng);
    const isIn = plan.myStatus === 'in';
    const canSuggestIt = !!(suggestTo && onSuggest && canSuggest?.(plan));
    const suggesting = suggestingId === plan.id;
    const suggest = () => onSuggest?.(plan);
    const saving = savingId === plan.id;

    if (live) {
      const grown = chosen === plan.id;
      const short = [place, far].filter(Boolean).join(', ') || plan.groupName;
      const long = [plan.groupName, place, far].filter(Boolean).join(', ');
      return (
        <PlanTicket
          state="live"
          grown={grown}
          title={plan.title}
          sub={short}
          long={long}
          onPress={() => tap(plan)}
          accessibilityLabel={`${plan.title}, on now, ${grown ? long : short}`}
          accessibilityHint={grown ? 'Opens the plan' : 'Shows who is going'}
          extra={
            <>
              <Text style={styles.going}>{plan.goingCount === 1 ? '1 going' : `${plan.goingCount} going`}</Text>
              <View style={styles.liveAnswer}>
                <AnswerSeg tone="sheet" value={answerOf(plan)} onChange={(choice) => answer(plan, choice)} disabled={saving} label={`Your answer to ${plan.title}`} />
              </View>
              {canSuggestIt ? (
                <TicketActions
                  actions={[
                    {
                      label: suggesting ? 'Suggesting…' : `Suggest to ${suggestTo}`,
                      icon: 'paper-plane-outline',
                      strong: true,
                      disabled: suggesting,
                      onPress: suggest,
                    },
                  ]}
                />
              ) : null}
            </>
          }
        />
      );
    }

    const when = plan.date === todayKey ? plan.startTime : [dayName(plan.date, now), plan.startTime].filter(Boolean).join(' ');
    const sub = [plan.groupName, when, place, far, `${plan.goingCount} going`].filter(Boolean).join(', ');
    let pill: TicketPill | null = null;
    if (isIn) pill = { label: "You're in", tone: 'done', icon: 'checkmark' };
    else if (canSuggestIt) {
      pill = {
        label: suggesting ? 'Suggesting…' : 'Suggest',
        tone: 'accent',
        icon: 'paper-plane-outline',
        onPress: suggest,
        disabled: suggesting,
        accessibilityLabel: `Suggest ${plan.title} to ${suggestTo}`,
      };
    } else if (plan.myStatus === 'out') pill = { label: 'Passed', tone: 'quiet' };
    else if (plan.myStatus === 'maybe') pill = { label: 'Maybe', tone: 'accent' };
    const isChosen = chosen === plan.id;

    return (
      <PlanTicket
        state={isChosen ? 'chosen' : 'plain'}
        title={plan.title}
        sub={sub}
        pill={pill}
        answer={{ value: answerOf(plan), onChange: (choice) => answer(plan, choice), disabled: saving }}
        onPress={() => tap(plan)}
        accessibilityLabel={`${plan.title}, ${sub}${isIn ? ", you're in" : ''}`}
        accessibilityHint={isChosen ? 'Opens the plan' : 'Shows your answer'}
      />
    );
  }

  // Something to stop for between the plans, so the line is not only plans:
  // a parea you crossed, an older week's photos around here, the spot of the
  // week. The reel skips the newest week: that one starts right under NOW.
  const reelGroup = groups[1] ?? null;
  const reelNights = reelGroup?.items ?? [];
  const reelPhotos = reelNights.flatMap((n) => [n.photo, ...n.more]).slice(0, 3);
  const reelCount = reelNights.reduce((sum, n) => sum + n.photoCount, 0);
  const reelPareas = new Set(reelNights.map((n) => n.group.id)).size;
  const betweens: React.ReactNode[] = [];
  if (crossing) {
    betweens.push(
      <Pressable
        key="crossed"
        onPress={crossing.onPress}
        accessibilityRole="button"
        accessibilityLabel={`${crossing.name} was out where you were ${timesWord(crossing.times)}. See them`}
        style={({ pressed }) => [styles.crossed, pressed && styles.pressed]}
      >
        <Monogram name={crossing.name} uri={crossing.avatarUrl} size={32} />
        <Text style={styles.crossedText}>
          <Text style={styles.strong}>{crossing.name}</Text> was out where you were {timesWord(crossing.times)}.
        </Text>
        <Text style={styles.crossedAction}>See</Text>
      </Pressable>,
    );
  }
  if (reelPhotos.length > 0 && reelGroup) {
    betweens.push(
      <Pressable
        key="reel"
        onPress={() => setOpenPost(reelNights[0])}
        accessibilityRole="button"
        accessibilityLabel={`${reelGroup.label} around here: ${reelPareas} ${reelPareas === 1 ? 'parea' : 'pareas'}, ${reelCount} photos. Open`}
        style={({ pressed }) => [styles.reel, pressed && styles.pressed]}
      >
        <View style={styles.reelPhotos}>
          {reelPhotos.map((photo, i) => {
            const url = signed[photo.path]?.url;
            return (
              <View key={photo.id} style={[styles.reelPhoto, i === 0 && styles.reelPhotoBig]}>
                {url ? (
                  <Image source={{ uri: url }} style={StyleSheet.absoluteFill} resizeMode="cover" onError={() => onImageError(photo.path)} />
                ) : null}
              </View>
            );
          })}
        </View>
        <LinearGradient colors={[scrim.reelClear, scrim.reel]} style={styles.reelShade} pointerEvents="none">
          <Text style={styles.reelKicker}>{reelGroup.label.toUpperCase()}, AROUND HERE</Text>
          <Text style={styles.reelTitle}>
            {reelPareas} {reelPareas === 1 ? 'parea' : 'pareas'} · {reelCount} {reelCount === 1 ? 'photo' : 'photos'}
          </Text>
        </LinearGradient>
      </Pressable>,
    );
  }
  if (spot) {
    const nightsWord = spot.items.length === 1 ? 'night' : 'nights';
    betweens.push(
      <Pressable
        key="spot"
        onPress={() => setSpotOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={`${spot.place} was the spot this week. See who was there`}
        style={({ pressed }) => [styles.spotCard, pressed && styles.pressed]}
      >
        <View style={styles.spotIcon}>
          <Ionicons name="location-outline" size={18} color={spotInk.ink} />
        </View>
        <Text style={styles.spotCardText}>
          <Text style={styles.strong}>{spot.place}</Text>
          {` was the spot this week. ${spot.items.length} ${nightsWord}, ${spot.pareas.length} ${spot.pareas.length === 1 ? 'parea' : 'pareas'}.`}
        </Text>
      </Pressable>,
    );
  }
  // After the 1st, 3rd and 5th plan row; any left over sit just above NOW.
  const betweenAfter = [1, 3, 5];
  let planRows = 0;
  let nextBetween = 0;
  function betweenRow(): React.ReactNode {
    const item = betweens[nextBetween];
    nextBetween += 1;
    return (
      <TimelineRow key={`between-${nextBetween}`} node={<View />}>
        <View style={styles.between}>{item}</View>
      </TimelineRow>
    );
  }

  const rows: React.ReactNode[] = [];
  const todayMark = <View key="today-mark" ref={todayRef} collapsable={false} onLayout={() => onTodayLayout?.()} />;
  const hasTonight = show === 'all' && stretches.some((stretch) => stretch.label === 'Tonight');
  if (show === 'all') stretches.forEach((stretch, s) => {
    if (stretch.label === 'Tonight') rows.push(todayMark);
    rows.push(
      <TimelineRow key={`s-${stretch.label}`} first={s === 0} node={<GroupNode />}>
        <GroupTitle
          kicker={stretch.label}
          title={stretch.plans.length === 1 ? '1 plan you can join' : `${stretch.plans.length} plans you can join`}
        />
      </TimelineRow>,
    );
    for (const plan of stretch.plans) {
      rows.push(
        <TimelineRow
          key={plan.id}
          node={
            plan.date === todayKey ? (
              <TimeNode time={plan.startTime} kind={nodeKind(plan)} />
            ) : (
              <DateNode date={plan.date} kind={nodeKind(plan) === 'selected' ? 'selected' : 'future'} />
            )
          }
        >
          {planRow(plan)}
        </TimelineRow>,
      );
      planRows += 1;
      if (nextBetween < betweens.length && planRows === betweenAfter[nextBetween]) rows.push(betweenRow());
    }
  });
  if (show === 'all' && open.length === 0) {
    rows.push(
      <TimelineRow key="no-plans" first>
        <View style={styles.empty}>
          <Text style={styles.emptyText}>No open public plans around you right now.</Text>
          {onClearFilters ? (
            <Pressable onPress={onClearFilters} accessibilityRole="button" hitSlop={8} style={({ pressed }) => pressed && styles.pressed}>
              <Text style={styles.emptyAction}>Clear filters</Text>
            </Pressable>
          ) : (
            <Text style={styles.emptyHint}>Widen the radius, or make your next plan public.</Text>
          )}
        </View>
      </TimelineRow>,
    );
  }
  // Whatever was not placed between plans (all of it, with no plans) sits
  // just above NOW, so the line still has something to stop for.
  if (show === 'all') {
    while (nextBetween < betweens.length) rows.push(betweenRow());
  }

  if (!hasTonight) rows.push(todayMark);

  return (
    <View>
      {rows}

      <View ref={nowRef} collapsable={false} onLayout={() => onNowLayout?.()}>
        <TimelineRow solid node={<TodayNode note={tonight > 0 ? `${tonight} tonight` : undefined} />}>
          <View style={styles.now}>
            <Text style={styles.nowText}>{clock(now)}</Text>
            <View style={styles.nowRule} />
          </View>
          {error ? <Text style={styles.error}>{error}</Text> : null}
        </TimelineRow>
      </View>

      {groups.map((group, g) => {
        const fires = group.items.reduce((sum, n) => sum + (reactions[n.photo.id] ?? []).length, 0);
        return (
          <View key={group.label}>
            <TimelineRow solid node={<GroupNode />}>
              <GroupTitle
                kicker={`${group.label} · you were there`}
                title={group.items.length === 1 ? '1 night out' : `${group.items.length} nights out`}
                meta={fires > 0 ? `${fires} ${fires === 1 ? 'fire' : 'fires'}` : undefined}
              />
              {g === 0 && spot && show === 'nights' ? (
                <Pressable
                  onPress={() => setSpotOpen(true)}
                  hitSlop={6}
                  accessibilityRole="button"
                  accessibilityLabel={`${spot.place} was the spot this week. See who was there`}
                  style={({ pressed }) => [styles.spot, pressed && styles.pressed]}
                >
                  <Ionicons name="flame" size={15} color={colors.primary} />
                  <Text style={styles.spotText}>{spot.place} was the spot</Text>
                  <Ionicons name="chevron-forward" size={14} color={colors.primary} />
                </Pressable>
              ) : null}
            </TimelineRow>
            {group.items.map((item) => {
              const far = distance(item.event.lat, item.event.lng);
              const place = shortPlace(item.event.placeLabel ?? item.event.location);
              return (
                <TimelineRow
                  key={item.photo.id}
                  solid
                  node={<DateNode date={item.event.date} kind="parea" parea={{ name: item.group.name, avatarUrl: item.group.avatarUrl }} />}
                >
                  <PhotoPost
                    item={item}
                    url={signed[item.photo.path]?.url}
                    moreUrls={item.more.map((p) => signed[p.path]?.url)}
                    reactions={reactions[item.photo.id] ?? []}
                    userId={me.id}
                    showWhy={false}
                    onReact={(emoji) => react(item.photo.id, emoji)}
                    onOpenNight={() => setOpenPost(item)}
                    onOpenGroup={() => onOpenGroup(item.group.id)}
                    onShowReactors={() => setOpenPost(item)}
                    onImageError={() => onImageError(item.photo.path)}
                    between={
                      place ? (
                        <Pressable
                          onPress={onShowMap}
                          hitSlop={8}
                          accessibilityRole="button"
                          accessibilityLabel={`${place}${far ? `, ${far} away` : ''}. Show the map`}
                          style={({ pressed }) => [styles.where, pressed && styles.pressed]}
                        >
                          <Ionicons name="location" size={13} color={colors.primary} />
                          <Text style={styles.whereText}>
                            {place}
                            {far ? ` · ${far}` : ''}
                          </Text>
                        </Pressable>
                      ) : null
                    }
                    style={styles.flush}
                  />
                </TimelineRow>
              );
            })}
          </View>
        );
      })}

      {!nightsLoading && nights.length === 0 ? (
        <TimelineRow solid>
          <View style={styles.empty}>
            <Text style={styles.emptyText}>No nights out yet.</Text>
            <Text style={styles.emptyHint}>Say you're in on a public plan. After the night, what every parea there kept lands on this line.</Text>
          </View>
        </TimelineRow>
      ) : null}
      {nights.length > 0 ? (
        <TimelineRow solid>
          <Text style={styles.end}>That's your last two months out.</Text>
        </TimelineRow>
      ) : null}

      <PostViewer
        item={openPost}
        reactions={openPost ? reactions[openPost.photo.id] ?? [] : []}
        userId={me.id}
        signed={signed}
        signPaths={signPaths}
        onImageError={onImageError}
        onReact={(emoji) => openPost && react(openPost.photo.id, emoji)}
        onShare={() => openPost && shareNight(openPost)}
        onOpenGroup={
          openPost
            ? () => {
                const id = openPost.group.id;
                setOpenPost(null);
                onOpenGroup(id);
              }
            : undefined
        }
        onClose={() => setOpenPost(null)}
      />

      <Modal visible={spotOpen && spot !== null} transparent animationType="slide" onRequestClose={() => setSpotOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setSpotOpen(false)} accessibilityLabel="Close">
          <Pressable style={styles.sheet} onPress={() => {}}>
            <View style={styles.grabber} />
            {spot ? (
              <ScrollView contentContainerStyle={styles.sheetBody}>
                <Text style={styles.sheetTitle}>{spot.place} was the spot</Text>
                <Text style={styles.sheetLead}>This week in the city.</Text>
                <View style={styles.stats}>
                  <Stat n={spot.pareas.length} label="pareas" />
                  <Stat n={spot.photos} label="photos" />
                  <Stat n={spot.items.reduce((sum, n) => sum + (reactions[n.photo.id] ?? []).length, 0)} label="fires" />
                </View>
                {spot.pareas.map((p) => (
                  <Pressable
                    key={p.id}
                    onPress={() => {
                      setSpotOpen(false);
                      onOpenGroup(p.id);
                    }}
                    accessibilityRole="button"
                    style={({ pressed }) => [styles.spotRow, pressed && styles.rowPressed]}
                  >
                    <Monogram name={p.name} uri={p.avatarUrl} size={32} style={{ borderRadius: 10 }} />
                    <View style={styles.rowText}>
                      <Text style={styles.rowTitle}>{p.name}</Text>
                      <Text style={styles.rowSub}>{p.title}</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={15} color={colors.textFaint} />
                  </Pressable>
                ))}
              </ScrollView>
            ) : null}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

// The night in words, for the share sheet.
function shareNight(item: FeedPhoto) {
  const place = shortPlace(item.event.placeLabel ?? item.event.location);
  Share.share({ message: `${item.event.title}\n${[item.group.name, place].filter(Boolean).join(' · ')}\nA public night on Squaddict.` }).catch(() => {});
}

function Stat({ n, label }: { n: number; label: string }) {
  return (
    <View>
      <Text style={styles.statN}>{n}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

// The place with the most pareas this week (at least two), with its nights.
function spotOfWeek(nights: FeedPhoto[], now: Date) {
  const week = keyOf(startOfWeek(now));
  const byPlace = new Map<string, FeedPhoto[]>();
  for (const n of nights) {
    if (n.event.date < week) continue;
    const place = shortPlace(n.event.placeLabel ?? n.event.location);
    if (!place) continue;
    byPlace.set(place, [...(byPlace.get(place) ?? []), n]);
  }
  let best: { place: string; items: FeedPhoto[]; pareas: { id: string; name: string; avatarUrl: string | null; title: string }[]; photos: number } | null = null;
  for (const [place, items] of byPlace) {
    const pareas = [...new Map(items.map((n) => [n.group.id, { id: n.group.id, name: n.group.name, avatarUrl: n.group.avatarUrl, title: n.event.title }])).values()];
    if (pareas.length < SPOT_MIN_PAREAS) continue;
    const photos = items.reduce((sum, n) => sum + n.photoCount, 0);
    if (!best || pareas.length > best.pareas.length || (pareas.length === best.pareas.length && photos > best.photos)) {
      best = { place, items, pareas, photos };
    }
  }
  return best;
}

// "This week", "Last week", then the month.
function weekLabel(date: string, now: Date) {
  const d = parseDateKey(date);
  if (!d) return 'Earlier';
  const week = startOfWeek(now).getTime();
  if (d.getTime() >= week) return 'This week';
  if (d.getTime() >= week - 7 * 24 * 60 * 60 * 1000) return 'Last week';
  return d.toLocaleDateString('en-US', { month: 'long' });
}

// "Sat 10", or "Tomorrow".
function dayName(date: string, now: Date): string {
  if (date === keyOf(addDays(now, 1))) return 'Tomorrow';
  const d = parseDateKey(date);
  return d ? `${d.toLocaleDateString('en-US', { weekday: 'short' })} ${d.getDate()}` : '';
}

// "three times lately"; once is just "lately".
function timesWord(times: number): string {
  if (times <= 1) return 'lately';
  const words = ['', 'once', 'twice', 'three times', 'four times', 'five times'];
  return `${words[times] ?? `${times} times`} lately`;
}

function clock(d: Date) {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

const styles = StyleSheet.create({
  between: { paddingBottom: space.xs },
  strong: { color: colors.text, ...typo.bold },
  crossed: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingVertical: space.sm + 2,
    paddingHorizontal: space.sm + 3,
    borderRadius: 18,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.borderStrong,
  },
  crossedText: { flex: 1, color: colors.textSoft, ...typo.medium, fontSize: textSize.body, lineHeight: 18 },
  crossedAction: { color: colors.primary, ...typo.display, fontSize: textSize.body },
  reel: { height: 136, borderRadius: 18, overflow: 'hidden', backgroundColor: colors.ink },
  reelPhotos: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, flexDirection: 'row', gap: 2 },
  reelPhoto: { flex: 1, backgroundColor: colors.inkStrong, overflow: 'hidden' },
  reelPhotoBig: { flex: 1.6 },
  reelShade: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingTop: 26, paddingHorizontal: 13, paddingBottom: 11 },
  reelKicker: { color: onPhoto.faint, ...typo.mono, fontSize: 10, letterSpacing: 1.4 },
  reelTitle: { marginTop: 2, color: colors.onInk, ...typo.display, fontSize: 15 },
  spotCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm + 2,
    paddingVertical: space.sm + 2,
    paddingHorizontal: space.sm + 3,
    borderRadius: 18,
    backgroundColor: spotInk.tint,
  },
  spotIcon: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface },
  spotCardText: { flex: 1, color: spotInk.ink, ...typo.medium, fontSize: textSize.body, lineHeight: 18 },
  pressed: { opacity: 0.7 },
  flush: { marginHorizontal: 0 },


  rowPressed: { backgroundColor: colors.surface },
  rowText: { flex: 1, minWidth: 0 },
  rowTitle: { color: colors.text, ...typo.bold, fontSize: textSize.base },
  rowSub: { color: colors.textSoft, ...typo.medium, fontSize: textSize.caption },

  now: { flexDirection: 'row', alignItems: 'center', gap: space.xs, height: 30, paddingTop: 2 },
  nowText: { color: sunInk, ...typo.mono, fontWeight: '600', fontSize: textSize.small },
  nowRule: { flex: 1, height: 1.5, backgroundColor: sun },
  going: { marginTop: space.xs, color: colors.textSoft, ...typo.medium, fontSize: 12.5 },
  liveAnswer: { marginTop: 12 },
  error: { marginTop: space.xs, color: colors.danger, ...typo.medium, fontSize: textSize.body },

  spot: { alignSelf: 'flex-start', marginTop: space.xs, flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 34, paddingHorizontal: 12, borderRadius: radius.pill, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  spotText: { color: colors.primary, ...typo.display, fontSize: textSize.small },
  where: { alignSelf: 'flex-start', marginHorizontal: 12, marginBottom: 2, flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 30, paddingHorizontal: 10, borderRadius: radius.pill, backgroundColor: colors.accentSoft },
  whereText: { color: colors.primary, ...typo.bold, fontSize: textSize.small },

  empty: { padding: 14, gap: 2, borderRadius: radius.md, borderWidth: 1.5, borderStyle: 'dashed', borderColor: '#B9C6F3', marginBottom: space.xs },
  emptyText: { color: colors.text, ...typo.semi, fontSize: textSize.body },
  emptyHint: { color: colors.textSoft, ...typo.medium, fontSize: textSize.small },
  emptyAction: { color: colors.primary, ...typo.display, fontSize: textSize.small, paddingTop: 2 },
  end: { color: colors.textSoft, ...typo.medium, fontSize: textSize.body, paddingTop: 2 },

  backdrop: { flex: 1, backgroundColor: scrim.sheet, justifyContent: 'flex-end' },
  sheet: { maxHeight: '86%', borderTopLeftRadius: radius.sheet, borderTopRightRadius: radius.sheet, backgroundColor: colors.surface },
  grabber: { width: 40, height: 4, alignSelf: 'center', marginTop: space.sm, borderRadius: radius.pill, backgroundColor: colors.borderStrong },
  sheetBody: { padding: space.lg, paddingTop: space.md, gap: space.sm },
  sheetTitle: { color: colors.text, ...typo.display, fontSize: 22, letterSpacing: -0.3 },
  sheetLead: { color: colors.textSoft, ...typo.medium, fontSize: textSize.base },
  stats: { flexDirection: 'row', gap: space.lg, marginVertical: space.xs },
  statN: { color: colors.text, ...typo.display, fontSize: 24 },
  statLabel: { color: colors.textSoft, ...typo.semi, fontSize: textSize.small },
  spotRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: 52, paddingHorizontal: 6, borderRadius: radius.md },
});
