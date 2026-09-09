import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, font, radius, space, textSize } from '../../theme';
import { todayLabel } from '../../lib/datetime';
import GradientAvatar, { initialsFor } from '../general/GradientAvatar';

type HomeHeaderProps = {
  displayName: string;
  onSignOut: () => void;
};

function firstName(displayName: string) {
  const trimmed = displayName.trim();
  if (trimmed === '') {
    return '';
  }
  return trimmed.split(/\s+/)[0];
}

export default function HomeHeader({ displayName, onSignOut }: HomeHeaderProps) {
  const [open, setOpen] = useState(false);
  const name = firstName(displayName);

  let greeting = 'Hey';
  if (name !== '') {
    greeting = `Hey ${name}`;
  }

  return (
    <View>
      <View style={styles.header}>
        <View style={styles.text}>
          <Text style={styles.date}>{todayLabel()}</Text>
          <Text style={styles.greeting} numberOfLines={1}>
            {greeting}
          </Text>
        </View>

        {displayName.trim() !== '' ? (
          <Pressable
            onPress={() => setOpen((was) => !was)}
            accessibilityRole="button"
            accessibilityLabel="Account"
            accessibilityState={{ expanded: open }}
            style={({ pressed }) => (pressed ? styles.pressed : null)}
          >
            <GradientAvatar
              label={displayName}
              initials={initialsFor(displayName)}
              size={40}
            />
          </Pressable>
        ) : null}
      </View>

      {open ? (
        <View style={styles.menu}>
          <Pressable
            onPress={onSignOut}
            accessibilityRole="button"
            accessibilityLabel="Sign out"
            style={({ pressed }) => [styles.signOut, pressed && styles.pressed]}
          >
            <Text style={styles.signOutText}>Sign out</Text>
          </Pressable>
        </View>
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
  pressed: { opacity: 0.7 },
  menu: { alignItems: 'flex-end', paddingHorizontal: space.lg, paddingTop: space.xs },
  signOut: {
    height: 34,
    paddingHorizontal: 14,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  signOutText: { color: colors.danger, fontFamily: font.semi, fontSize: textSize.base },
  greeting: {
    marginTop: 3,
    color: colors.text,
    fontFamily: font.display,
    fontSize: textSize.hero,
    letterSpacing: -0.5,
  },
});
