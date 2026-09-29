import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Ticket from '../general/Ticket';
import type { Group } from '../../services/serviceGroup';
import { sinceYear } from '../../lib/acting';
import { plural, pluralWord } from '../../lib/text';
import { colors, radius, space, sun, textSize, typo } from '../../theme';

const WHITE = '#FFFFFF';
const SOFT = 'rgba(255,255,255,0.78)';
const FAINT = 'rgba(255,255,255,0.6)';

type SquadTicketProps = {
  group: Group;
  nights: number;
  memberCount: number;
  following: number | null;
  followers: number | null;
  acting: boolean;
  switching: boolean;
  onActAs: () => void;
};

// A squad's ticket, like "Your year so far": the nights it kept, and whether
// it is the one you act as. The acting squad gets the brand blue.
export default function SquadTicket({
  group,
  nights,
  memberCount,
  following,
  followers,
  acting,
  switching,
  onActAs,
}: SquadTicketProps) {
  const year = sinceYear(group.createdAt);

  const stub = (
    <View style={styles.stub}>
      <Stat value={memberCount} label={pluralWord(memberCount, 'member', 'members')} />
      <Stat value={following} label="follows" />
      <Stat value={followers} label={followers === 1 ? 'follower' : 'followers'} />
    </View>
  );

  return (
    <Ticket
      tone={acting ? 'brand' : 'ink'}
      stub={stub}
      accessibilityLabel={`${group.name}, ${plural(nights, 'night', 'nights')} together`}
    >
      <View style={styles.top}>
        <Text style={styles.kicker}>{year ? `TOGETHER SINCE ${year}` : 'THE SQUAD'}</Text>
        <Text style={styles.code} numberOfLines={1}>
          @{group.handle}
        </Text>
      </View>

      <Text style={styles.big}>
        {nights > 0 ? `${plural(nights, 'night', 'nights')} together` : 'The first night is still ahead'}
      </Text>

      {acting ? (
        <View style={styles.actingPill} accessibilityLabel="You are acting as this squad">
          <View style={styles.dot} />
          <Text style={styles.actingText}>Acting as this squad</Text>
        </View>
      ) : (
        <Pressable
          onPress={onActAs}
          disabled={switching}
          accessibilityRole="button"
          accessibilityLabel="Act as this squad"
          accessibilityHint="Follows and asks from Explore will be made in this squad's name"
          style={({ pressed }) => [styles.actButton, (pressed || switching) && styles.pressed]}
        >
          {switching ? (
            <ActivityIndicator size="small" color={colors.onLight} />
          ) : (
            <Ionicons name="flash" size={14} color={colors.onLight} />
          )}
          <Text style={styles.actText}>Act as this squad</Text>
        </Pressable>
      )}
    </Ticket>
  );
}

function Stat({ value, label }: { value: number | null; label: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value === null ? '–' : value}</Text>
      <Text style={styles.statLabel} numberOfLines={1}>
        {label.toUpperCase()}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm },
  kicker: { color: FAINT, ...typo.mono, fontSize: textSize.caption, letterSpacing: 1.2 },
  code: { flexShrink: 1, color: FAINT, ...typo.mono, fontSize: 10, letterSpacing: 1 },
  big: {
    marginTop: space.xs,
    color: WHITE,
    ...typo.display,
    fontSize: textSize.display,
    lineHeight: 34,
    letterSpacing: -0.6,
  },
  actButton: {
    alignSelf: 'flex-start',
    marginTop: space.sm,
    height: 34,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 14,
    borderRadius: radius.pill,
    backgroundColor: WHITE,
  },
  actText: { color: colors.onLight, ...typo.semi, fontSize: textSize.small },
  actingPill: {
    alignSelf: 'flex-start',
    marginTop: space.sm,
    height: 34,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 14,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: sun },
  actingText: { color: SOFT, ...typo.semi, fontSize: textSize.small },
  pressed: { opacity: 0.7 },

  stub: { flexDirection: 'row' },
  stat: { flex: 1, alignItems: 'center', gap: 2 },
  statValue: { color: WHITE, ...typo.title, fontSize: textSize.heading },
  statLabel: { color: FAINT, ...typo.mono, fontSize: 9.5, letterSpacing: 0.8 },
});
