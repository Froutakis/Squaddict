import { StyleSheet, Text, View } from 'react-native';
import { colors, font, radius, textSize } from '../../theme';
import GradientAvatar, { initialsFor } from '../general/GradientAvatar';

type AttendeeStackProps = {
  people: { id: string; name: string }[];
  max?: number;
  size?: number;
  onDark?: boolean;
};

export default function AttendeeStack({ people, max = 3, size = 30, onDark = false }: AttendeeStackProps) {
  if (people.length === 0) return null;

  const shown = people.slice(0, max);
  const extra = people.length - shown.length;

  return (
    <View style={styles.row}>
      {shown.map((person, i) => (
        <GradientAvatar
          key={person.id}
          label={person.name || '?'}
          initials={initialsFor(person.name)}
          size={size}
          ring={2}
          style={i > 0 ? styles.overlap : undefined}
        />
      ))}

      {extra > 0 ? (
        <View
          style={[
            styles.more,
            styles.overlap,
            { width: size, height: size },
            onDark ? styles.moreDark : styles.moreLight,
          ]}
        >
          <Text style={[styles.moreText, onDark ? styles.moreTextDark : styles.moreTextLight]}>
            +{extra}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  overlap: { marginLeft: -10 },
  more: {
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
  },
  moreLight: { backgroundColor: colors.surfaceAlt, borderColor: colors.surface },
  moreDark: { backgroundColor: 'rgba(255,255,255,0.2)', borderColor: '#FFFFFF' },
  moreText: { fontFamily: font.semi, fontSize: textSize.micro },
  moreTextLight: { color: colors.textSoft },
  moreTextDark: { color: '#FFFFFF' },
});