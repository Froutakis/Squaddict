import { useEffect, useRef, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Modal, Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import type { FeedEvent } from '../../services/serviceFeed';
import type { MyEvent, RsvpStatus } from '../../services/serviceEvents';
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
import LineTicket, { shortPlace } from '../home/LineTicket';
import { DateNode, GroupNode, GroupTitle, TimelineRow, TodayNode } from '../home/Timeline';
import { dayWord, stretchOf } from '../home/PlanLine';
import { colors, radius, space, textSize, typo } from '../../theme';

// Explore as a line, the same idea as Home one step out: the city's line.
// Above now, open public plans you can join (furthest on top); below, the
// public nights of every parea around you. The rail shows whose night it is.

const PLANS_SHOWN = 15;
const TINT = '#E8EDFD';
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
}: CityLineProps) {
  const [reactions, setReactions] = useState<Record<string, PhotoReaction[]>>({});
  const [openPost, setOpenPost] = useState<FeedPhoto | null>(null);
  const [spotOpen, setSpotOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
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
  const next = open.find((p) => p.myStatus !== 'out') ?? null;
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

  function distance(lat?: number, lng?: number) {
    if (!center || lat === undefined || lng === undefined) return null;
    const km = Math.sqrt(((lat - center.lat) * 111) ** 2 + ((lng - center.lng) * 111 * Math.cos((center.lat * Math.PI) / 180)) ** 2);
    return km < 10 ? `${km.toFixed(1)} km` : `${Math.round(km)} km`;
  }

  function planRow(plan: FeedEvent) {
    const live = isHappeningNow(plan.date, plan.startTime, plan.endTime, now);
    if (plan.id === next?.id) {
      const time = plan.startTime ? ` · ${plan.startTime}` : '';
      const far = distance(plan.lat, plan.lng);
      return (
        <View style={styles.ticketWrap}>
          <LineTicket
            event={asMyEvent(plan)}
            phase={live ? 'live' : 'later'}
            kicker={live ? 'ON NOW' : `NEXT · ${plan.date === todayKey ? 'TONIGHT' : dayWord(plan.date, now)}${time}${far ? ` · ${far.toUpperCase()}` : ''}`}
            people={`${plan.goingCount} in`}
            checkedIn={false}
            onOpen={() => onOpenPlan(plan)}
            onIn={() => onRsvp(plan, 'in')}
            onPass={() => onRsvp(plan, 'out')}
            onClear={() => onRsvp(plan, null)}
            onCheckIn={() => onOpenPlan(plan)}
            onAddPhoto={() => onOpenPlan(plan)}
          />
        </View>
      );
    }
    const isIn = plan.myStatus === 'in';
    const sub = [plan.date === todayKey ? plan.startTime : null, shortPlace(plan.placeLabel ?? plan.location), distance(plan.lat, plan.lng), `${plan.goingCount} in`]
      .filter(Boolean)
      .join(' · ');
    return (
      <Pressable
        onPress={() => onOpenPlan(plan)}
        accessibilityRole="button"
        accessibilityLabel={`${plan.title}, ${plan.groupName}, ${sub}. Open the plan`}
        style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
      >
        <View style={styles.rowText}>
          <Text style={styles.rowTitle} numberOfLines={1}>
            {plan.title}
          </Text>
          <Text style={styles.rowSub} numberOfLines={1}>
            {plan.groupName} · {sub}
          </Text>
        </View>
        <Pressable
          onPress={() => onRsvp(plan, isIn ? null : 'in')}
          disabled={savingId === plan.id}
          accessibilityRole="button"
          accessibilityLabel={isIn ? `You're in for ${plan.title}. Take back your answer` : `Join ${plan.title}`}
          hitSlop={6}
          style={({ pressed }) => [styles.join, isIn && styles.joined, pressed && styles.pressed]}
        >
          <Text style={[styles.joinText, isIn && styles.joinedText]}>{isIn ? '✓ In' : 'Join'}</Text>
        </Pressable>
      </Pressable>
    );
  }

  const rows: React.ReactNode[] = [];
  stretches.forEach((stretch, s) => {
    rows.push(
      <TimelineRow key={`s-${stretch.label}`} first={s === 0} node={<GroupNode hollow />}>
        <GroupTitle
          kicker={stretch.label}
          title={stretch.plans.length === 1 ? '1 plan you can join' : `${stretch.plans.length} plans you can join`}
        />
      </TimelineRow>,
    );
    for (const plan of stretch.plans) {
      const d = parseDateKey(plan.date);
      rows.push(
        <TimelineRow
          key={plan.id}
          node={
            <View style={styles.planNode}>
              <Monogram name={plan.groupName} uri={null} size={24} style={styles.face} />
              {plan.date === todayKey ? (
                <Text style={styles.nodeTime}>{plan.startTime ?? 'TODAY'}</Text>
              ) : (
                <>
                  <Text style={styles.nodeDay}>{d ? d.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase() : ''}</Text>
                  <Text style={styles.nodeNum}>{d ? String(d.getDate()).padStart(2, '0') : ''}</Text>
                </>
              )}
            </View>
          }
        >
          {planRow(plan)}
        </TimelineRow>,
      );
    }
  });
  if (open.length === 0) {
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

  return (
    <View>
      {rows}

      <TimelineRow solid node={<TodayNode note={tonight > 0 ? `${tonight} tonight` : undefined} />}>
        <View style={styles.now}>
          <Text style={styles.nowText}>NOW · {clock(now)}</Text>
          <View style={styles.nowRule} />
        </View>
        {error ? <Text style={styles.error}>{error}</Text> : null}
      </TimelineRow>

      {groups.map((group, g) => {
        const fires = group.items.reduce((sum, n) => sum + (reactions[n.photo.id] ?? []).length, 0);
        return (
          <View key={group.label}>
            <TimelineRow solid node={<GroupNode />}>
              <GroupTitle
                kicker={`${group.label} in the city`}
                title={group.items.length === 1 ? '1 public night' : `${group.items.length} public nights`}
                meta={fires > 0 ? `${fires} ${fires === 1 ? 'fire' : 'fires'}` : undefined}
              />
              {g === 0 && spot ? (
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
            <Text style={styles.emptyText}>No public nights around here yet.</Text>
            <Text style={styles.emptyHint}>When a parea shares a night, it lands on this line.</Text>
          </View>
        </TimelineRow>
      ) : null}
      {nights.length > 0 ? (
        <TimelineRow solid>
          <Text style={styles.end}>That's the city's last two months.</Text>
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

// A FeedEvent dressed as one of your plans, for the line's ticket.
function asMyEvent(plan: FeedEvent): MyEvent {
  return {
    id: plan.id,
    groupId: plan.groupId,
    groupName: plan.groupName,
    title: plan.title,
    date: plan.date,
    startTime: plan.startTime,
    endTime: plan.endTime,
    location: plan.location,
    placeLabel: plan.placeLabel,
    lat: plan.lat,
    lng: plan.lng,
    tags: plan.tags,
    isPublic: true,
    createdBy: '',
    myStatus: plan.myStatus,
    going: [],
  };
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

function clock(d: Date) {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

const styles = StyleSheet.create({
  pressed: { opacity: 0.7 },
  flush: { marginHorizontal: 0 },
  ticketWrap: { marginTop: 2, marginBottom: space.xs },

  planNode: { alignItems: 'center', backgroundColor: colors.bg, paddingVertical: 2 },
  face: { borderRadius: 8, marginBottom: 3 },
  nodeTime: { color: colors.text, ...typo.display, fontSize: 13 },
  nodeDay: { color: colors.textSoft, ...typo.mono, fontSize: textSize.micro, letterSpacing: 1.2 },
  nodeNum: { color: colors.text, ...typo.display, fontSize: 18, lineHeight: 20 },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    minHeight: 54,
    paddingVertical: 8,
    paddingLeft: 12,
    paddingRight: 8,
    marginBottom: space.xs,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: 'rgba(255,255,255,0.7)',
  },
  rowPressed: { backgroundColor: colors.surface },
  rowText: { flex: 1, minWidth: 0 },
  rowTitle: { color: colors.text, ...typo.bold, fontSize: textSize.base },
  rowSub: { color: colors.textSoft, ...typo.medium, fontSize: textSize.caption },
  join: { minHeight: 34, minWidth: 64, paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center', borderRadius: radius.pill, backgroundColor: colors.ink },
  joined: { backgroundColor: '#E2F1EA' },
  joinText: { color: colors.onInk, ...typo.display, fontSize: textSize.small },
  joinedText: { color: colors.success },

  now: { flexDirection: 'row', alignItems: 'center', gap: space.xs, height: 26 },
  nowText: { color: colors.danger, ...typo.mono, fontSize: textSize.micro, letterSpacing: 1.2 },
  nowRule: { flex: 1, height: 1.5, backgroundColor: colors.danger, opacity: 0.5 },
  error: { marginTop: space.xs, color: colors.danger, ...typo.medium, fontSize: textSize.body },

  spot: { alignSelf: 'flex-start', marginTop: space.xs, flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 34, paddingHorizontal: 12, borderRadius: radius.pill, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  spotText: { color: colors.primary, ...typo.display, fontSize: textSize.small },
  where: { alignSelf: 'flex-start', marginHorizontal: 12, marginBottom: 2, flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 30, paddingHorizontal: 10, borderRadius: radius.pill, backgroundColor: TINT },
  whereText: { color: colors.primary, ...typo.bold, fontSize: textSize.small },

  empty: { padding: 14, gap: 2, borderRadius: radius.md, borderWidth: 1.5, borderStyle: 'dashed', borderColor: '#B9C6F3', marginBottom: space.xs },
  emptyText: { color: colors.text, ...typo.semi, fontSize: textSize.body },
  emptyHint: { color: colors.textSoft, ...typo.medium, fontSize: textSize.small },
  emptyAction: { color: colors.primary, ...typo.display, fontSize: textSize.small, paddingTop: 2 },
  end: { color: colors.textSoft, ...typo.medium, fontSize: textSize.body, paddingTop: 2 },

  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: { maxHeight: '86%', borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, backgroundColor: colors.surface },
  grabber: { width: 40, height: 4, alignSelf: 'center', marginTop: space.sm, borderRadius: radius.pill, backgroundColor: colors.borderStrong },
  sheetBody: { padding: space.lg, paddingTop: space.md, gap: space.sm },
  sheetTitle: { color: colors.text, ...typo.display, fontSize: 22, letterSpacing: -0.3 },
  sheetLead: { color: colors.textSoft, ...typo.medium, fontSize: textSize.base },
  stats: { flexDirection: 'row', gap: space.lg, marginVertical: space.xs },
  statN: { color: colors.text, ...typo.display, fontSize: 24 },
  statLabel: { color: colors.textSoft, ...typo.semi, fontSize: textSize.small },
  spotRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: 52, paddingHorizontal: 6, borderRadius: radius.md },
});
