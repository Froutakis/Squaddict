import { useCallback, useEffect, useRef, useState } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Image,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { getEventPhotos, type EventPhoto } from '../../services/serviceEvents';
import type { SignedMap } from '../chat/media';
import type { MemoryNight } from '../home/memories';
import { formatDateTime } from '../../lib/datetime';
import { placeLines } from '../../lib/place';
import { ticketCode } from '../../lib/ticket';
import { colors, typo, radius, solidFor, space, textSize } from '../../theme';
import CloseButton from '../general/CloseButton';
import Monogram, { initialsFor } from '../general/Monogram';
import Punch from '../general/Punch';
import Ticket from '../general/Ticket';
import AttendeeStack from './Attendee';

const FRAME_MS = 3600;
const HOLD_MS = 180;
const GONE_MS = 1200;

type Frames = Record<string, EventPhoto[] | 'missing'>;

type StoryViewerProps = {
  visible: boolean;
  nights: MemoryNight[];
  startIndex: number;
  groupSizes: Record<string, number>;
  signed: SignedMap;
  signPaths: (paths: string[]) => void;
  onImageError: (path: string) => void;
  onSeen: (eventId: string) => void;
  onAddYours: (night: MemoryNight) => void;
  onClose: () => void;
};

export default function StoryViewer({
  visible,
  nights,
  startIndex,
  groupSizes,
  signed,
  signPaths,
  onImageError,
  onSeen,
  onAddYours,
  onClose,
}: StoryViewerProps) {
  const [night, setNight] = useState(startIndex);
  const [frame, setFrame] = useState(0);
  const [restartNonce, setRestartNonce] = useState(0);
  const [frames, setFrames] = useState<Frames>({});
  const [holding, setHolding] = useState(false);
  const [still, setStill] = useState(false);

  const progress = useRef(new Animated.Value(0)).current;
  const startFrom = useRef(0);
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const didHold = useRef(false);

  const current = nights[night];
  const loaded = current ? frames[current.event.id] : undefined;
  const gone = loaded === 'missing';
  const list: EventPhoto[] = Array.isArray(loaded)
    ? loaded
    : current
      ? [current.cover]
      : [];
  const photo = list[frame] ?? list[0];
  const url = photo ? signed[photo.path]?.url : undefined;
  const frameKey = `${night}:${frame}:${restartNonce}`;

  const goNextNight = useCallback(
    function nextNight() {
      if (night + 1 < nights.length) {
        setNight(night + 1);
        setFrame(0);
        return;
      }
      onClose();
    },
    [night, nights.length, onClose],
  );

  const goNext = useCallback(
    function next() {
      const active = nights[night];
      const known = active ? frames[active.event.id] : undefined;
      const count = Array.isArray(known) ? known.length : 1;

      if (frame + 1 < count) {
        setFrame(frame + 1);
        return;
      }
      goNextNight();
    },
    [nights, night, frames, frame, goNextNight],
  );

  const goPrev = useCallback(
    function previous() {
      if (frame > 0) {
        setFrame(frame - 1);
        return;
      }
      if (night === 0) {
        setRestartNonce(function (n) {
          return n + 1;
        });
        return;
      }

      const before = nights[night - 1];
      const known = before ? frames[before.event.id] : undefined;
      setNight(night - 1);
      setFrame(Array.isArray(known) ? Math.max(0, known.length - 1) : 0);
    },
    [nights, night, frames, frame],
  );

  useEffect(() => {
    let cancelled = false;

    Promise.all([
      AccessibilityInfo.isReduceMotionEnabled(),
      AccessibilityInfo.isScreenReaderEnabled(),
    ])
      .then(function ([reduced, reader]) {
        if (!cancelled) setStill(reduced || reader);
      })
      .catch(function () {});

    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', function (reduced) {
      if (reduced) setStill(true);
    });

    return function cleanup() {
      cancelled = true;
      sub.remove();
    };
  }, []);

  useEffect(() => {
    if (!current) return;
    onSeen(current.event.id);
  }, [current, onSeen]);

  useEffect(() => {
    if (!current || frames[current.event.id]) return;

    let cancelled = false;
    const id = current.event.id;

    getEventPhotos(id)
      .then(function (rows) {
        if (cancelled) return;
        setFrames(function (prev) {
          return { ...prev, [id]: rows.length > 0 ? rows : 'missing' };
        });
        signPaths(
          rows.map(function (row) {
            return row.path;
          }),
        );
      })
      .catch(function () {
        if (cancelled) return;
        setFrames(function (prev) {
          return { ...prev, [id]: 'missing' };
        });
      });

    return function cleanup() {
      cancelled = true;
    };
  }, [current, frames, signPaths]);

  useEffect(() => {
    startFrom.current = 0;
    progress.setValue(0);
  }, [frameKey, progress]);

  useEffect(() => {
    if (still || holding || gone || !photo) return;

    const animation = Animated.timing(progress, {
      toValue: 1,
      duration: Math.max(400, FRAME_MS * (1 - startFrom.current)),
      easing: Easing.linear,
      useNativeDriver: true,
    });

    animation.start(function (result) {
      if (result.finished) goNext();
    });

    return function cleanup() {
      progress.stopAnimation(function (value) {
        startFrom.current = value;
      });
    };
  }, [frameKey, still, holding, gone, photo, progress, goNext]);

  useEffect(() => {
    if (!gone) return;
    const timer = setTimeout(goNextNight, GONE_MS);
    return function cleanup() {
      clearTimeout(timer);
    };
  }, [gone, night, goNextNight]);

  useEffect(() => {
    if (Platform.OS !== 'web' || !visible) return;

    function onKey(event: any) {
      if (event.key === 'Escape') onClose();
      if (event.key === 'ArrowRight') goNext();
      if (event.key === 'ArrowLeft') goPrev();
    }

    const target: any = globalThis;
    target.addEventListener?.('keydown', onKey);
    return function cleanup() {
      target.removeEventListener?.('keydown', onKey);
    };
  }, [visible, onClose, goNext, goPrev]);

  useEffect(() => {
    return function cleanup() {
      if (holdTimer.current) clearTimeout(holdTimer.current);
      progress.stopAnimation();
    };
  }, [progress]);

  if (!current) return null;

  const event = current.event;
  const place = placeLines(event.location, event.placeLabel);
  const size = groupSizes[event.groupId] ?? 0;
  const going = event.going ?? [];
  const wereIn = size > 0 ? `${going.length} of ${size} were in` : `${going.length} were in`;
  const tint = solidFor(event.groupName);

  function pressIn() {
    didHold.current = false;
    holdTimer.current = setTimeout(function () {
      didHold.current = true;
      setHolding(true);
    }, HOLD_MS);
  }

  function pressOut() {
    if (holdTimer.current) clearTimeout(holdTimer.current);
    if (didHold.current) setHolding(false);
  }

  return (
    <Modal
      visible={visible}
      animationType={still ? 'none' : 'fade'}
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.screen} accessibilityViewIsModal>
        {url ? (
          <Image
            source={{ uri: url }}
            style={styles.shot}
            resizeMode="cover"
            accessibilityLabel={`Photo ${frame + 1} of ${list.length} from ${event.title}`}
            onError={function () {
              if (photo) onImageError(photo.path);
            }}
          />
        ) : (
          <View style={[styles.shot, { backgroundColor: tint }]} />
        )}

        <LinearGradient
          colors={['rgba(6,14,22,0.62)', 'rgba(6,14,22,0)', 'rgba(6,14,22,0.9)']}
          locations={[0, 0.34, 0.82]}
          style={styles.scrim}
          pointerEvents="none"
        />

        {gone ? (
          <View style={styles.gone} pointerEvents="none">
            <Text style={styles.goneText}>Those photos are gone.</Text>
          </View>
        ) : null}

        <Pressable
          style={[styles.zone, styles.zoneLeft]}
          onPressIn={pressIn}
          onPressOut={pressOut}
          onPress={function () {
            if (!didHold.current) goPrev();
          }}
          accessibilityRole="button"
          accessibilityLabel="Previous photo"
        />
        <Pressable
          style={[styles.zone, styles.zoneRight]}
          onPressIn={pressIn}
          onPressOut={pressOut}
          onPress={function () {
            if (!didHold.current) goNext();
          }}
          accessibilityRole="button"
          accessibilityLabel="Next photo"
        />

        <View style={[styles.top, holding && styles.hidden]} pointerEvents="box-none">
          <View
            style={styles.bars}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
          >
            {list.map(function (item, i) {
              return (
                <View key={item.id} style={styles.bar}>
                  <Animated.View
                    style={[
                      styles.fill,
                      {
                        transform: [
                          {
                            scaleX:
                              i < frame ? 1 : i > frame ? 0 : still ? 1 : progress,
                          },
                        ],
                      },
                    ]}
                  />
                </View>
              );
            })}
          </View>

          <View style={styles.head}>
            <Monogram
              name={event.groupName}
              initials={initialsFor(event.groupName)}
              size={30}
            />
            <View style={styles.headText}>
              <Text style={styles.group} numberOfLines={1}>
                {event.groupName}
              </Text>
              <Text style={styles.when} numberOfLines={1}>
                {formatDateTime(event.date, event.startTime)}
              </Text>
            </View>
            <CloseButton tone="light" onPress={onClose} />
          </View>
        </View>

        <View style={[styles.foot, holding && styles.hidden]} pointerEvents="box-none">
          <Ticket
            tone="light"
            notches={false}
            stub={
              <View style={styles.stubRow}>
                <Punch state={event.myStatus === 'in' ? 'in' : 'out'} size={22} />
                {going.length > 0 ? <AttendeeStack people={going} size={22} max={3} /> : null}
                <Text style={styles.were} numberOfLines={1}>
                  {wereIn}
                </Text>
                <View style={styles.spacer} />
                {event.myStatus === 'in' ? (
                  <Pressable
                    onPress={function () {
                      onAddYours(current);
                    }}
                    accessibilityRole="button"
                    accessibilityLabel="Add your photo to this night"
                    style={({ pressed }) => [styles.add, pressed && styles.pressed]}
                  >
                    <Text style={styles.addText}>Add yours</Text>
                  </Pressable>
                ) : (
                  <Text style={styles.counter}>
                    {frame + 1}/{list.length}
                  </Text>
                )}
              </View>
            }
          >
            <View style={styles.stubTop}>
              <Text style={styles.place} numberOfLines={1}>
                {place.primary ?? event.title}
              </Text>
              <View style={styles.spacer} />
              <Text style={styles.code}>№ {ticketCode(event.id)}</Text>
            </View>

            <Text style={styles.title} numberOfLines={2}>
              {event.title}
            </Text>

            {event.description ? (
              <Text style={styles.caption} numberOfLines={2}>
                {event.description}
              </Text>
            ) : null}
          </Ticket>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#05090D' },
  shot: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
  scrim: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },

  gone: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, alignItems: 'center', justifyContent: 'center' },
  goneText: { color: '#FFFFFF', ...typo.semi, fontSize: textSize.lead },

  zone: { position: 'absolute', top: 110, bottom: 230 },
  zoneLeft: { left: 0, width: '40%' },
  zoneRight: { right: 0, width: '60%' },

  top: { position: 'absolute', left: 0, right: 0, top: 0, paddingTop: 54, paddingHorizontal: space.md },
  hidden: { opacity: 0 },
  bars: { flexDirection: 'row', gap: 3 },
  bar: {
    flex: 1,
    height: 2.5,
    borderRadius: 2,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  fill: {
    position: 'absolute', top: 0, right: 0, bottom: 0, left: 0,
    backgroundColor: '#FFFFFF',
    transformOrigin: 'left',
  },
  head: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginTop: 13 },
  headText: { flex: 1 },
  group: { color: '#FFFFFF', ...typo.semi, fontSize: textSize.base },
  when: {
    marginTop: 1,
    color: 'rgba(255,255,255,0.62)',
    ...typo.mono,
    fontSize: textSize.caption,
  },

  foot: { position: 'absolute', left: 0, right: 0, bottom: 0, padding: space.md, paddingBottom: space.xl },
  stubTop: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  place: { color: colors.onLight, ...typo.semi, fontSize: textSize.body, flexShrink: 1 },
  code: { color: colors.onLightSoft, ...typo.mono, fontSize: 10, letterSpacing: 1 },
  title: {
    marginTop: space.xs,
    color: colors.onLight,
    ...typo.display,
    fontSize: textSize.heading,
    letterSpacing: -0.3,
  },
  caption: {
    marginTop: 3,
    color: colors.textSoft,
    ...typo.medium,
    fontSize: textSize.body,
    lineHeight: 18,
  },

  stubRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  spacer: { flex: 1 },
  were: { color: colors.textSoft, ...typo.semi, fontSize: textSize.small },
  counter: { color: colors.textFaint, ...typo.mono, fontSize: textSize.caption },
  add: {
    height: 32,
    paddingHorizontal: 14,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.ink,
  },
  addText: { color: colors.textOnBrand, ...typo.semi, fontSize: textSize.small },
  pressed: { opacity: 0.7 },
});
