import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Ticket from '../general/Ticket';
import { plural, pluralWord } from '../../lib/text';
import { colors, radius, space, textSize, typo } from '../../theme';

const WHITE = '#FFFFFF';
const SOFT = 'rgba(255,255,255,0.78)';
const FAINT = 'rgba(255,255,255,0.6)';

type YearTicketProps = {
  year: number;
  nights: number;
  topGroup: string | null;
  topPlace: string | null;
  pareas: number;
  photos: number;
  streak: number;
  ticketCode: string;
  onPlan: () => void;
};

// Your year in one ticket: how often you went out, with whom and where.
export default function YearTicket({
  year,
  nights,
  topGroup,
  topPlace,
  pareas,
  photos,
  streak,
  ticketCode,
  onPlan,
}: YearTicketProps) {
  const line = [topGroup ? `Most with ${topGroup}` : null, topPlace ? `usually at ${topPlace}` : null]
    .filter(Boolean)
    .join(' · ');

  const stub = (
    <View style={styles.stub}>
      <Stat value={pareas} label={pluralWord(pareas, 'parea', 'pareas')} />
      <Stat value={photos} label={pluralWord(photos, 'photo', 'photos')} />
      <Stat value={streak} label={streak === 1 ? 'week streak' : 'weeks streak'} />
    </View>
  );

  return (
    <Ticket tone="brand" stub={stub} accessibilityLabel={`${plural(nights, 'night', 'nights')} out in ${year}`}>
      <View style={styles.top}>
        <Text style={styles.kicker}>YOUR {year} SO FAR</Text>
        <Text style={styles.code}>№ {ticketCode}</Text>
      </View>

      {nights > 0 ? (
        <>
          <Text style={styles.big}>{plural(nights, 'night', 'nights')} out</Text>
          {line ? (
            <Text style={styles.line} numberOfLines={2}>
              {line}
            </Text>
          ) : null}
        </>
      ) : (
        <>
          <Text style={styles.big}>Your first night is one plan away</Text>
          <Pressable
            onPress={onPlan}
            accessibilityRole="button"
            accessibilityLabel="Propose a plan"
            style={({ pressed }) => [styles.plan, pressed && styles.pressed]}
          >
            <Ionicons name="add" size={16} color={colors.onLight} />
            <Text style={styles.planText}>Plan something</Text>
          </Pressable>
        </>
      )}
    </Ticket>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel} numberOfLines={1}>
        {label.toUpperCase()}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  kicker: { color: FAINT, ...typo.mono, fontSize: textSize.caption, letterSpacing: 1.2 },
  code: { color: FAINT, ...typo.mono, fontSize: 10, letterSpacing: 1 },
  big: {
    marginTop: space.xs,
    color: WHITE,
    ...typo.display,
    fontSize: textSize.display,
    lineHeight: 34,
    letterSpacing: -0.6,
  },
  line: { marginTop: 4, color: SOFT, ...typo.medium, fontSize: textSize.body },
  plan: {
    alignSelf: 'flex-start',
    marginTop: space.sm,
    height: 34,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 14,
    borderRadius: radius.pill,
    backgroundColor: WHITE,
  },
  planText: { color: colors.onLight, ...typo.semi, fontSize: textSize.small },
  pressed: { opacity: 0.7 },

  stub: { flexDirection: 'row' },
  stat: { flex: 1, alignItems: 'center', gap: 2 },
  statValue: { color: WHITE, ...typo.title, fontSize: textSize.heading },
  statLabel: { color: FAINT, ...typo.mono, fontSize: 9.5, letterSpacing: 0.8 },
});
