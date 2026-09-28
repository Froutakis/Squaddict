import { useCallback, useEffect, useMemo, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { User as AuthUser } from '@supabase/supabase-js';
import { logout } from '../services/serviceAuth';
import { clearAvatar, getUserById, setAvatar } from '../services/serviceUser';
import { pickImage, takePhoto } from '../services/serviceMedia';
import { getGroupsForUser, type Group } from '../services/serviceGroup';
import { getUnreadCounts } from '../services/serviceChat';
import {
  countMyPhotos,
  getEventCovers,
  getMyEvents,
  type EventCover,
  type MyEvent,
} from '../services/serviceEvents';
import { messageFor, PhotoSourceSheet, type PhotoSource } from '../components/events/EventPhotos';
import Monogram, { initialsFor } from '../components/general/Monogram';
import SectionHead from '../components/general/SectionHead';
import GroupFormSheet from '../components/group/GroupFormSheet';
import EventSheet from '../components/events/EventSheet';
import StoryViewer from '../components/events/StoryViewer';
import type { MemoryNight } from '../components/home/memories';
import { useSignedImages } from '../components/home/useSignedImages';
import YearTicket from '../components/you/YearTicket';
import PareaCards from '../components/you/PareaCards';
import NightsArchive from '../components/you/NightsArchive';
import SettingsSheet from '../components/you/SettingsSheet';
import { keyOf, parseLocal, todayLabel } from '../lib/datetime';
import { byMonth, pastNights, topBy, weekStreak } from '../lib/stats';
import { ticketCode } from '../lib/ticket';
import { colors, layout, radius, space, textSize, typo } from '../theme';

const AVATAR_SIZE = 76;

type YouScreenProps = {
  user: AuthUser;
  onOpenParea?: (groupId: string) => void;
  onPlan?: () => void;
};

function sinceLabel(iso?: string) {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return `On Squaddict since ${date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`;
}

// You: your year out, your pareas, and every night you were part of.
export default function YouScreen({ user, onOpenParea, onPlan }: YouScreenProps) {
  const [displayName, setDisplayName] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [joinedAt, setJoinedAt] = useState<string | undefined>(undefined);
  const [groups, setGroups] = useState<Group[]>([]);
  const [events, setEvents] = useState<MyEvent[]>([]);
  const [unread, setUnread] = useState<Record<string, number>>({});
  const [photoCount, setPhotoCount] = useState(0);
  const [covers, setCovers] = useState<Record<string, EventCover>>({});

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [avatarBusy, setAvatarBusy] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const [askingAvatar, setAskingAvatar] = useState(false);
  const [settings, setSettings] = useState(false);
  const [groupForm, setGroupForm] = useState<'create' | 'join' | null>(null);
  const [openEvent, setOpenEvent] = useState<MyEvent | null>(null);
  const [story, setStory] = useState<MemoryNight[] | null>(null);

  const { signed, signPaths, dropSigned } = useSignedImages();
  const today = keyOf(new Date());
  const year = parseLocal(today).getFullYear();

  const load = useCallback(
    async function load() {
      try {
        const [profile, myGroups, myEvents, counts, photos] = await Promise.all([
          getUserById(user.id),
          getGroupsForUser(user.id),
          getMyEvents(user.id),
          getUnreadCounts().catch(() => ({}) as Record<string, number>),
          countMyPhotos(user.id).catch(() => 0),
        ]);

        setDisplayName(profile?.name ?? '');
        setAvatarUrl(profile?.avatarUrl ?? null);
        setJoinedAt(profile?.joinedAt);
        setGroups(myGroups);
        setEvents(myEvents);
        setUnread(counts);
        setPhotoCount(photos);
        setError(null);
      } catch {
        setError('Could not load your nights.');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [user.id],
  );

  useEffect(() => {
    load();
  }, [load]);

  const nights = useMemo(() => pastNights(events, today), [events, today]);
  const nightIds = nights.map((night) => night.id).join(',');

  useEffect(() => {
    if (nightIds === '') {
      setCovers({});
      return;
    }

    let cancelled = false;
    getEventCovers(nightIds.split(','))
      .then((found) => {
        if (cancelled) return;
        setCovers(found);
        signPaths(Object.values(found).map((cover) => cover.path));
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [nightIds, signPaths]);

  const thisYear = nights.filter((night) => night.date.startsWith(String(year)));
  const topGroup = topBy(thisYear, (night) => night.groupName);
  const topPlace = topBy(thisYear, (night) => night.location ?? night.placeLabel);
  const streak = weekStreak(nights.map((night) => night.date), today);
  const months = useMemo(() => byMonth(nights, today), [nights, today]);
  const nightsByGroup = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const night of nights) counts[night.groupId] = (counts[night.groupId] ?? 0) + 1;
    return counts;
  }, [nights]);
  const groupSizes = useMemo(
    () => Object.fromEntries(groups.map((group) => [group.id, group.memberCount])),
    [groups],
  );

  function coverFor(event: MyEvent): string | null {
    const photo = covers[event.id];
    return (photo ? signed[photo.path]?.url : undefined) ?? event.coverUrl ?? null;
  }

  function openNight(event: MyEvent) {
    const cover = covers[event.id];
    if (cover) setStory([{ event, cover, latestAt: cover.latestAt }]);
    else setOpenEvent(event);
  }

  async function changeAvatar(source: PhotoSource) {
    setAskingAvatar(false);
    setAvatarError(null);

    const options = { square: true };
    const picked = source === 'camera' ? await takePhoto(options) : await pickImage(options);
    if (!picked) return;

    setAvatarBusy(true);
    try {
      setAvatarUrl(await setAvatar(user.id, picked, avatarUrl));
    } catch (problem) {
      setAvatarError(messageFor(problem));
    } finally {
      setAvatarBusy(false);
    }
  }

  async function removeAvatar() {
    setAskingAvatar(false);
    setAvatarError(null);
    setAvatarBusy(true);

    try {
      await clearAvatar(user.id, avatarUrl);
      setAvatarUrl(null);
    } catch (problem) {
      setAvatarError(messageFor(problem));
    } finally {
      setAvatarBusy(false);
    }
  }

  function renderBody() {
    if (loading) {
      return <ActivityIndicator size="large" color={colors.primary} style={styles.loader} />;
    }

    if (error) {
      return (
        <View style={styles.state}>
          <Text style={styles.stateTitle}>{error}</Text>
          <Pressable
            onPress={() => {
              setLoading(true);
              load();
            }}
            accessibilityRole="button"
            accessibilityLabel="Try again"
            style={({ pressed }) => [styles.retry, pressed && styles.pressed]}
          >
            <Text style={styles.retryText}>Try again</Text>
          </Pressable>
        </View>
      );
    }

    return (
      <>
        <View style={styles.body}>
          <YearTicket
            year={year}
            nights={thisYear.length}
            topGroup={topGroup}
            topPlace={topPlace}
            pareas={groups.length}
            photos={photoCount}
            streak={streak}
            ticketCode={ticketCode(user.id)}
            onPlan={() => onPlan?.()}
          />
        </View>

        <View>
          <SectionHead title="Your pareas" meta={groups.length > 0 ? String(groups.length) : undefined} />
          <PareaCards
            groups={groups}
            unread={unread}
            nightsByGroup={nightsByGroup}
            onOpen={(groupId) => onOpenParea?.(groupId)}
            onNew={() => setGroupForm('create')}
          />
        </View>

        <View>
          <SectionHead title="Your nights" meta={nights.length > 0 ? `${nights.length} in all` : undefined} />
          {months.length > 0 ? (
            <NightsArchive months={months} coverFor={coverFor} onOpen={openNight} />
          ) : (
            <View style={styles.body}>
              <View style={styles.emptyCard}>
                <Ionicons name="images-outline" size={24} color={colors.textSoft} />
                <Text style={styles.emptyTitle}>Your nights will live here</Text>
                <Text style={styles.emptyBody}>
                  Every plan you say you're in lands here once it's over, with the photos from that night.
                </Text>
              </View>
            </View>
          )}
        </View>
      </>
    );
  }

  const since = sinceLabel(joinedAt);

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              load();
            }}
            tintColor={colors.primary}
          />
        }
      >
        <View style={styles.header}>
          <View style={styles.topRow}>
            <Text style={styles.date}>{todayLabel()}</Text>
            <Pressable
              onPress={() => setSettings(true)}
              accessibilityRole="button"
              accessibilityLabel="Settings"
              hitSlop={6}
              style={({ pressed }) => [styles.gear, pressed && styles.pressed]}
            >
              <Ionicons name="settings-outline" size={19} color={colors.text} />
            </Pressable>
          </View>

          <View style={styles.identity}>
            <Pressable
              onPress={() => setAskingAvatar(true)}
              disabled={avatarBusy}
              accessibilityRole="button"
              accessibilityLabel={avatarUrl ? 'Change your photo' : 'Add a photo of you'}
              style={({ pressed }) => pressed && styles.pressed}
            >
              <Monogram
                name={displayName || '?'}
                uri={avatarUrl}
                initials={initialsFor(displayName)}
                size={AVATAR_SIZE}
              />
              <View style={styles.cameraBadge}>
                {avatarBusy ? (
                  <ActivityIndicator size="small" color={colors.textOnBrand} />
                ) : (
                  <Ionicons name="camera" size={13} color={colors.textOnBrand} />
                )}
              </View>
            </Pressable>

            <View style={styles.identityText}>
              <Text style={styles.name} numberOfLines={1}>
                {displayName || ' '}
              </Text>
              {since ? <Text style={styles.since}>{since}</Text> : null}
            </View>
          </View>
          {avatarError ? <Text style={styles.error}>{avatarError}</Text> : null}
        </View>

        {renderBody()}
      </ScrollView>

      <PhotoSourceSheet
        visible={askingAvatar}
        title={avatarUrl ? 'Change your photo' : 'Add a photo of you'}
        onClose={() => setAskingAvatar(false)}
        onPick={changeAvatar}
        onRemove={avatarUrl ? removeAvatar : undefined}
      />

      <SettingsSheet
        visible={settings}
        userId={user.id}
        displayName={displayName}
        onClose={() => setSettings(false)}
        onNameChanged={setDisplayName}
        onEditPhoto={() => afterSheet(() => setAskingAvatar(true))}
        onJoinWithCode={() => afterSheet(() => setGroupForm('join'))}
        onSignOut={() => logout().catch(() => {})}
      />

      <GroupFormSheet
        visible={groupForm !== null}
        initialMode={groupForm ?? 'create'}
        onClose={() => setGroupForm(null)}
        onDone={() => {
          setGroupForm(null);
          load();
        }}
      />

      <StoryViewer
        key={story ? story[0].event.id : 'closed'}
        visible={story !== null}
        nights={story ?? []}
        startIndex={0}
        groupSizes={groupSizes}
        signed={signed}
        signPaths={signPaths}
        onImageError={dropSigned}
        onSeen={noop}
        onAddYours={(night) => {
          setStory(null);
          setOpenEvent(night.event);
        }}
        onClose={() => setStory(null)}
      />

      <EventSheet
        event={openEvent}
        currentUserId={user.id}
        onClose={() => setOpenEvent(null)}
        onChanged={load}
        onPhotosChanged={load}
      />
    </SafeAreaView>
  );
}

function noop() {}

// iOS can't present a sheet while another one is still sliding away.
const SHEET_CLOSE_MS = 350;

function afterSheet(open: () => void) {
  setTimeout(open, SHEET_CLOSE_MS);
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: {
    width: '100%',
    maxWidth: layout.column,
    alignSelf: 'center',
    paddingVertical: space.md,
    paddingBottom: 130,
    gap: space.md,
  },
  pressed: { opacity: 0.7 },
  body: { paddingHorizontal: space.lg },
  loader: { marginTop: space.xl },

  header: { paddingHorizontal: space.lg, paddingTop: space.xs, gap: space.sm },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  date: {
    color: colors.textFaint,
    ...typo.mono,
    fontSize: textSize.caption,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  gear: {
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  identity: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  cameraBadge: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 26,
    height: 26,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.ink,
    borderWidth: 2,
    borderColor: colors.bg,
  },
  identityText: { flex: 1, minWidth: 0, gap: 2 },
  name: { color: colors.text, ...typo.display, fontSize: textSize.display, letterSpacing: -0.6 },
  since: { color: colors.textSoft, ...typo.medium, fontSize: textSize.body },
  error: { color: colors.danger, ...typo.medium, fontSize: textSize.body },

  state: { alignItems: 'center', gap: space.sm, paddingHorizontal: space.lg, paddingVertical: space.xl },
  stateTitle: { color: colors.text, ...typo.semi, fontSize: textSize.base, textAlign: 'center' },
  retry: {
    height: 40,
    paddingHorizontal: space.lg,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
  },
  retryText: { color: colors.textOnBrand, ...typo.semi, fontSize: textSize.base },

  emptyCard: {
    alignItems: 'center',
    gap: space.xs,
    padding: space.lg,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.border,
  },
  emptyTitle: { color: colors.text, ...typo.semi, fontSize: textSize.base },
  emptyBody: {
    color: colors.textSoft,
    ...typo.medium,
    fontSize: textSize.body,
    lineHeight: 19,
    textAlign: 'center',
  },
});
