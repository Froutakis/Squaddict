import { useEffect, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Linking, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import type { MyEvent, RsvpStatus } from '../../services/serviceEvents';
import { colors, typo, radius, space, textSize } from '../../theme';
import { countdownLabel, formatDateTime } from '../../lib/datetime';
import { mapsUrl } from '../../lib/maps';
import { placeLines } from '../../lib/place';
import { ticketCode } from '../../lib/ticket';
import Ticket from '../general/Ticket';
import Punch from '../general/Punch';
import AttendeeStack from './Attendee';
import RsvpButtons from './RsvpButtons';

const WHITE = '#FFFFFF';
const SOFT = 'rgba(255,255,255,0.78)';
const FAINT = 'rgba(255,255,255,0.5)';
const HOLE = '#102163';
// The brand blue, see-through at the top so the photo shows, solid where the text is.
const BRAND_TINT = ['rgba(29,58,192,0.18)', 'rgba(25,50,170,0.62)', 'rgba(21,44,143,0.94)'] as const;

type UpNextProps = {
  event: MyEvent;
  onPress?: () => void;
  onRsvp: (status: RsvpStatus | null) => void;
  saving?: boolean;
  live?: boolean;
  liveText?: string;
  checkedIn?: boolean;
  hereCount?: number;
  onCheckIn?: () => void;
  onAddPhoto?: () => void;
  cover?: string | null;
};

export default function UpNext({
  event,
  onPress,
  onRsvp,
  saving = false,
  live = false,
  liveText,
  checkedIn = false,
  hereCount = 0,
  onCheckIn,
  onAddPhoto,
  cover = null,
}: UpNextProps) {
  const [coverFailed, setCoverFailed] = useState(false);
  useEffect(() => setCoverFailed(false), [cover]);
  const place = placeLines(event.location, event.placeLabel);
  const answered = event.myStatus === 'in' || event.myStatus === 'out';
  const isIn = event.myStatus === 'in';
  const hasPoint = event.lat !== undefined && event.lng !== undefined;

  async function openMaps() {
    if (!hasPoint) return;

    const url = mapsUrl(Platform.OS, event.lat!, event.lng!, place.primary);
    try {
      await Linking.openURL(url);
    } catch {
      await Linking.openURL(mapsUrl('web', event.lat!, event.lng!, place.primary));
    }
  }

  const stub = answered ? (
    <View style={styles.stub}>
      <Punch state={event.myStatus === 'in' ? 'in' : 'out'} size={26} onDark holeColor={HOLE} />

      <View style={styles.stubText}>
        <Text style={styles.stubTitle}>
          {checkedIn ? "You're here" : event.myStatus === 'in' ? "You're in" : 'You passed'}
        </Text>
        {checkedIn ? (
          <Text style={styles.change}>
            {hereCount > 1 ? `${hereCount} of ${event.going.length} here` : 'Punched at the door'}
          </Text>
        ) : (
          <Pressable
            onPress={() => onRsvp(null)}
            disabled={saving}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Change your answer"
          >
            <Text style={styles.change}>Change</Text>
          </Pressable>
        )}
      </View>

      <View style={styles.spacer} />

      {checkedIn ? (
        onAddPhoto ? (
          <Pressable
            onPress={onAddPhoto}
            accessibilityRole="button"
            accessibilityLabel="Add a photo from this night"
            style={({ pressed }) => [styles.camera, pressed && styles.pressed]}
          >
            <Ionicons name="camera" size={19} color={colors.onLight} />
          </Pressable>
        ) : (
          <View style={styles.stubRight}>
            <AttendeeStack people={event.going} size={24} max={3} onDark />
            <Text style={styles.count}>{event.going.length} IN</Text>
          </View>
        )
      ) : live && isIn && onCheckIn ? (
        <>
          {hasPoint ? (
            <Pressable
              onPress={openMaps}
              accessibilityRole="button"
              accessibilityLabel="Open in maps"
              style={({ pressed }) => [styles.round, pressed && styles.pressed]}
            >
              <Ionicons name="navigate-outline" size={17} color={WHITE} />
            </Pressable>
          ) : null}

          <Pressable
            onPress={onCheckIn}
            accessibilityRole="button"
            accessibilityLabel="I am here"
            style={({ pressed }) => [styles.here, pressed && styles.pressed]}
          >
            <Text style={styles.hereText}>I'm here</Text>
          </Pressable>
        </>
      ) : (
        <View style={styles.stubRight}>
          <AttendeeStack people={event.going} size={24} max={3} onDark />
          <Text style={styles.count}>{event.going.length} IN</Text>
        </View>
      )}
    </View>
  ) : (
    <RsvpButtons status={event.myStatus} saving={saving} onChange={onRsvp} onDark compact stretch />
  );

  return (
    <Ticket
      tone="brand"
      torn={checkedIn}
      onPress={onPress}
      accessibilityLabel={event.title}
      stub={stub}
      cover={coverFailed ? null : cover}
      coverTint={BRAND_TINT}
      onCoverError={() => setCoverFailed(true)}
    >
      <View style={styles.topRow}>
        <View style={styles.groupPill}>
          <Text style={styles.groupText} numberOfLines={1}>
            {event.groupName}
          </Text>
        </View>
        <View style={styles.spacer} />
        <View style={styles.codeRow}>
          {live ? <View style={styles.liveDot} /> : null}
          <Text style={live ? styles.codeLive : styles.code}>
            {live && liveText ? liveText : countdownLabel(event.date)} · № {ticketCode(event.id)}
          </Text>
        </View>
      </View>

      <Text style={styles.title} numberOfLines={2}>
        {event.title}
      </Text>

      <View style={styles.metaRow}>
        <Ionicons name="time-outline" size={15} color={SOFT} />
        <Text style={[styles.metaLine, styles.metaFill]} numberOfLines={1}>
          {formatDateTime(event.date, event.startTime)}
        </Text>
      </View>

      {place.primary ? (
        <View style={styles.metaRow}>
          <Ionicons name="location-outline" size={15} color={SOFT} />
          <View style={styles.metaStack}>
            <Text style={styles.metaLine} numberOfLines={1}>
              {place.primary}
            </Text>
            {place.secondary ? (
              <Text style={styles.metaSub} numberOfLines={1}>
                {place.secondary}
              </Text>
            ) : null}
          </View>
        </View>
      ) : null}
    </Ticket>
  );
}

const styles = StyleSheet.create({
  spacer: { flex: 1 },

  topRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  groupPill: {
    maxWidth: '58%',
    paddingHorizontal: space.sm,
    paddingVertical: 3,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  groupText: { color: WHITE, ...typo.semi, fontSize: textSize.caption },
  codeRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  code: { color: FAINT, ...typo.mono, fontSize: 10, letterSpacing: 1 },
  codeLive: { color: WHITE, ...typo.mono, fontSize: 10, letterSpacing: 1 },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.success },

  title: {
    marginTop: space.sm,
    color: WHITE,
    ...typo.display,
    fontSize: textSize.display,
    lineHeight: 34,
    letterSpacing: -0.6,
  },

  metaRow: { flexDirection: 'row', alignItems: 'center', gap: space.xs, marginTop: space.xs },
  metaStack: { flex: 1, gap: 1 },
  metaFill: { flex: 1 },
  metaLine: { color: SOFT, ...typo.mono, fontSize: textSize.body },
  metaSub: { color: FAINT, ...typo.medium, fontSize: textSize.caption },

  stub: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  stubText: { gap: 1 },
  stubTitle: { color: WHITE, ...typo.semi, fontSize: textSize.body },
  change: { color: FAINT, ...typo.medium, fontSize: textSize.caption },
  stubRight: { alignItems: 'flex-end', gap: 3 },
  round: {
    width: 38,
    height: 38,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.28)',
  },
  here: {
    height: 38,
    paddingHorizontal: 18,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: WHITE,
  },
  hereText: { color: colors.onLight, ...typo.semi, fontSize: textSize.base },
  pressed: { opacity: 0.7 },
  camera: {
    width: 38,
    height: 38,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: WHITE,
  },
  count: { color: FAINT, ...typo.mono, fontSize: 9.5, letterSpacing: 1 },
});
