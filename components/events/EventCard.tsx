import type { Person } from '../../lib/people';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { RsvpStatus } from '../../services/serviceEvents';
import { colors, radius, solidFor, space, textSize, tracking, typo } from '../../theme';
import { countdownLabel, dateParts, daysUntil, weekdayShort } from '../../lib/datetime';
import { placeLines } from '../../lib/place';
import Ticket from '../general/Ticket';
import Punch, { type PunchState } from '../general/Punch';
import AttendeeStack from './Attendee';
import RsvpButtons from './RsvpButtons';

export type CardEvent = {
  id: string;
  title: string;
  date: string;
  startTime?: string;
  location?: string;
  placeLabel?: string;
  groupName: string;
  myStatus?: RsvpStatus;
  going: Person[];
  goingCount: number;
  distanceKm?: number;
  coverUrl?: string | null;
  friendsGoing?: Person[];
};

export type EventCardAction = 'none' | 'rsvp' | 'request';

type EventCardProps = {
  event: CardEvent;
  action?: EventCardAction;
  saving?: boolean;
  requested?: boolean;
  onPress?: () => void;
  onRsvp?: (status: RsvpStatus | null) => void;
  onRequest?: () => void;
};

export function friendsLine(people: Person[]): string {
  const first = (person: Person) => person.name.split(' ')[0] || person.name;
  if (people.length === 1) return `${first(people[0])} is going`;
  if (people.length === 2) return `${first(people[0])} & ${first(people[1])} are going`;
  return `${first(people[0])}, ${first(people[1])} +${people.length - 2} going`;
}

function statusOf(myStatus?: RsvpStatus): { state: PunchState; label: string } {
  if (myStatus === 'in') return { state: 'in', label: "You're in" };
  if (myStatus === 'out') return { state: 'out', label: "You're out" };
  return { state: 'open', label: 'Not answered' };
}

export default function EventCard({
  event,
  action = 'none',
  saving = false,
  requested = false,
  onPress,
  onRsvp,
  onRequest,
}: EventCardProps) {
  const { day } = dateParts(event.date);
  const groupColor = solidFor(event.groupName);
  const status = statusOf(event.myStatus);
  const place = placeLines(event.location, event.placeLabel);

  const hasFaces = event.going.length > 0;
  const [coverFailed, setCoverFailed] = useState(false);
  const cover = coverFailed ? null : event.coverUrl ?? null;
  const friends = event.friendsGoing ?? [];

  function friendsRow(onPhoto: boolean) {
    if (friends.length === 0) return null;

    return (
      <View style={styles.friends}>
        <AttendeeStack
          people={friends}
          size={18}
          max={3}
          onDark={onPhoto}
          ringColor={onPhoto ? 'rgba(12,25,38,0.6)' : undefined}
        />
        <Text style={[styles.friendsText, onPhoto && styles.friendsTextOnPhoto]} numberOfLines={1}>
          {friendsLine(friends)}
        </Text>
      </View>
    );
  }

  const meta = [
    event.startTime,
    place.primary,
    !hasFaces && event.goingCount > 0 ? `${event.goingCount} in` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  const corner =
    event.distanceKm !== undefined
      ? `${event.distanceKm.toFixed(1)} KM`
      : daysUntil(event.date) >= 0
        ? countdownLabel(event.date)
        : null;

  return (
    <Ticket
      onPress={onPress}
      accessibilityLabel={event.title}
      stub={renderStub()}
      cover={cover}
      onCoverError={() => setCoverFailed(true)}
    >
      {cover ? renderCoverMain() : (
      <View style={styles.main}>
        <View style={styles.date}>
          <Text style={styles.weekday}>{weekdayShort(event.date)}</Text>
          <Text style={styles.day}>{String(day).padStart(2, '0')}</Text>
        </View>

        <View style={styles.body}>
          <View style={styles.groupRow}>
            <View style={[styles.groupDot, { backgroundColor: groupColor }]} />
            <Text style={[styles.groupName, { color: groupColor }]} numberOfLines={1}>
              {event.groupName}
            </Text>
            <View style={styles.spacer} />
            {corner ? <Text style={styles.corner}>{corner}</Text> : null}
          </View>

          <Text style={styles.title} numberOfLines={1}>
            {event.title}
          </Text>

          {meta ? (
            <Text style={styles.meta} numberOfLines={1}>
              {meta}
            </Text>
          ) : null}

          {friendsRow(false)}
        </View>
      </View>
      )}
    </Ticket>
  );

  function renderCoverMain() {
    return (
      <View style={styles.coverMain}>
        <View style={styles.groupRow}>
          <View style={styles.coverPill}>
            <View style={[styles.groupDot, { backgroundColor: groupColor }]} />
            <Text style={styles.coverGroup} numberOfLines={1}>
              {event.groupName}
            </Text>
          </View>
          <View style={styles.spacer} />
          {corner ? <Text style={styles.coverCorner}>{corner}</Text> : null}
        </View>

        <View style={styles.spacer} />

        <Text style={styles.coverTitle} numberOfLines={2}>
          {event.title}
        </Text>
        <Text style={styles.coverMeta} numberOfLines={1}>
          {[`${weekdayShort(event.date)} ${String(day).padStart(2, '0')}`, meta].filter(Boolean).join(' · ')}
        </Text>
        {friendsRow(true)}
      </View>
    );
  }

  function renderStub() {
    if (action === 'rsvp' && onRsvp) {
      return (
        <RsvpButtons
          status={event.myStatus}
          saving={saving}
          onChange={onRsvp}
          compact
          stretch
        />
      );
    }

    return (
      <View style={styles.stub}>
        <Punch state={status.state} size={22} />
        <Text style={styles.status}>{action === 'request' ? 'Members only' : status.label}</Text>
        <View style={styles.spacer} />

        {action === 'request' ? (
          <Pressable
            onPress={onRequest}
            disabled={saving || requested || !onRequest}
            accessibilityRole="button"
            accessibilityLabel="Ask to come"
            accessibilityState={{ disabled: saving || requested || !onRequest }}
            style={({ pressed }) => [
              styles.request,
              (requested || !onRequest) && styles.requestDone,
              pressed && styles.pressed,
            ]}
          >
            <Text style={[styles.requestText, (requested || !onRequest) && styles.requestTextDone]}>
              {requested ? 'Asked' : 'Ask to come'}
            </Text>
          </Pressable>
        ) : hasFaces ? (
          <AttendeeStack people={event.going} size={22} max={3} />
        ) : event.goingCount > 0 ? (
          <Text style={styles.status}>{event.goingCount} in</Text>
        ) : null}
      </View>
    );
  }
}

const styles = StyleSheet.create({
  main: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  coverMain: { minHeight: 132, gap: 2 },
  coverPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    flexShrink: 1,
    paddingHorizontal: space.sm,
    paddingVertical: 3,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(12,25,38,0.45)',
  },
  coverGroup: { flexShrink: 1, color: '#FFFFFF', ...typo.semi, fontSize: textSize.caption },
  coverCorner: {
    color: 'rgba(255,255,255,0.85)',
    ...typo.mono,
    fontSize: 9.5,
    letterSpacing: 1,
  },
  coverTitle: {
    color: '#FFFFFF',
    ...typo.title,
    fontSize: textSize.heading,
    letterSpacing: -0.3,
  },
  coverMeta: { color: 'rgba(255,255,255,0.82)', ...typo.mono, fontSize: textSize.small },
  spacer: { flex: 1 },

  date: {
    width: 50,
    height: 48,
    borderRadius: 12,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  weekday: { color: colors.accent, ...typo.semi, fontSize: 10, letterSpacing: 0.5 },
  day: { color: colors.text, ...typo.title, fontSize: 20, letterSpacing: tracking.title },

  body: { flex: 1, minWidth: 0, gap: 2 },
  groupRow: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  groupDot: { width: 6, height: 6, borderRadius: radius.pill },
  groupName: { flexShrink: 1, ...typo.semi, fontSize: textSize.caption },
  corner: {
    color: colors.textFaint,
    ...typo.mono,
    fontSize: 9.5,
    letterSpacing: 1,
  },

  title: {
    color: colors.text,
    ...typo.title,
    fontSize: textSize.lead,
    letterSpacing: -0.2,
  },
  meta: { color: colors.textSoft, ...typo.mono, fontSize: textSize.small },

  friends: { flexDirection: 'row', alignItems: 'center', gap: space.xs, marginTop: 4 },
  friendsText: { flexShrink: 1, color: colors.primary, ...typo.semi, fontSize: textSize.small },
  friendsTextOnPhoto: { color: '#FFFFFF' },

  stub: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  status: { color: colors.textSoft, ...typo.semi, fontSize: textSize.small },

  request: {
    height: 32,
    paddingHorizontal: 14,
    borderRadius: radius.sm,
    borderWidth: 1.5,
    borderColor: colors.ink,
    backgroundColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  requestDone: { backgroundColor: 'transparent', borderColor: colors.border },
  requestText: { color: colors.textOnBrand, ...typo.semi, fontSize: textSize.body },
  requestTextDone: { color: colors.textFaint },
  pressed: { opacity: 0.7 },
});
