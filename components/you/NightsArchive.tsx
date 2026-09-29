import { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import type { MyEvent } from '../../services/serviceEvents';
import type { MonthGroup } from '../../lib/stats';
import { parseLocal } from '../../lib/datetime';
import ShowMore, { visibleSlice } from '../general/ShowMore';
import { colors, radius, solidFor, space, textSize, typo } from '../../theme';

const MONTHS_SHOWN = 3;

type NightsArchiveProps = {
  months: MonthGroup<MyEvent>[];
  coverFor: (event: MyEvent) => string | null;
  onOpen: (event: MyEvent) => void;
};

// Every night you were in, month by month.
export default function NightsArchive({ months, coverFor, onOpen }: NightsArchiveProps) {
  const [expanded, setExpanded] = useState(false);
  const { shown, hidden } = visibleSlice(months, MONTHS_SHOWN, expanded);

  return (
    <View style={styles.wrap}>
      {shown.map((month) => (
        <View key={month.key} style={styles.month}>
          <Text style={styles.monthLabel}>
            {month.label.toUpperCase()} · {month.items.length}
          </Text>

          <View style={styles.grid}>
            {month.items.map((event) => {
              const cover = coverFor(event);
              const day = parseLocal(event.date).getDate();

              return (
                <Pressable
                  key={event.id}
                  onPress={() => onOpen(event)}
                  accessibilityRole="button"
                  accessibilityLabel={`${event.title}, ${month.label} ${day}`}
                  accessibilityHint={cover ? 'Opens the photos from that night' : 'Opens the plan'}
                  style={({ pressed }) => [
                    styles.tile,
                    { backgroundColor: cover ? colors.surfaceAlt : solidFor(event.groupName) },
                    pressed && styles.pressed,
                  ]}
                >
                  {cover ? (
                    <Image source={{ uri: cover }} style={StyleSheet.absoluteFill} resizeMode="cover" />
                  ) : (
                    <View style={styles.empty}>
                      <Ionicons name="camera-outline" size={20} color="rgba(255,255,255,0.85)" />
                    </View>
                  )}
                  <LinearGradient
                    colors={['rgba(12,25,38,0)', 'rgba(12,25,38,0.7)']}
                    style={styles.shade}
                    pointerEvents="none"
                  />
                  <Text style={styles.label} numberOfLines={1}>
                    {day} · {event.title}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      ))}

      <ShowMore hidden={hidden} expanded={expanded} onToggle={() => setExpanded(!expanded)} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: space.lg },
  month: { marginBottom: space.md },
  monthLabel: {
    marginBottom: space.xs,
    color: colors.textFaint,
    ...typo.mono,
    fontSize: textSize.caption,
    letterSpacing: 1.2,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  tile: {
    width: '32%',
    aspectRatio: 1,
    borderRadius: radius.sm,
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  pressed: { opacity: 0.75 },
  empty: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
  shade: { position: 'absolute', left: 0, right: 0, bottom: 0, height: '55%' },
  label: {
    paddingHorizontal: 6,
    paddingBottom: 5,
    color: '#FFFFFF',
    ...typo.semi,
    fontSize: textSize.caption,
  },
});
