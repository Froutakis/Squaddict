import { StyleSheet, Text, View } from 'react-native';
import { colors, font, space, textSize } from '../../theme';
import { todayLabel } from '../../lib/datetime';
import GradientAvatar, { initialsFor } from '../general/GradientAvatar';

type HomeHeaderProps = {
  displayName: string;
};

function firstName(displayName: string) {
  const trimmed = displayName.trim();
  if (trimmed === '') {
    return '';
  }
  return trimmed.split(/\s+/)[0];
}

export default function HomeHeader({ displayName }: HomeHeaderProps) {
  const name = firstName(displayName);

  let greeting = 'Hey';
  if (name !== '') {
    greeting = `Hey ${name}`;
  }

  return (
    <View style={styles.header}>
      <View style={styles.text}>
        <Text style={styles.date}>{todayLabel()}</Text>
        <Text style={styles.greeting} numberOfLines={1}>
          {greeting}
        </Text>
      </View>

      {displayName.trim() !== '' ? (
        <GradientAvatar
          label={displayName}
          initials={initialsFor(displayName)}
          size={40}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.sm,
    paddingHorizontal: space.lg,
    paddingTop: space.xs,
  },
  text: { flex: 1 },
  date: {
    color: colors.textFaint,
    fontFamily: font.mono,
    fontSize: textSize.caption,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  greeting: {
    marginTop: 3,
    color: colors.text,
    fontFamily: font.display,
    fontSize: textSize.hero,
    letterSpacing: -0.5,
  },
});
