import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { brand, colors, font, radius, shadow, space } from '../../theme';
import { todayLabel } from '../../lib/datetime';

type HomeHeaderProps = {
  displayName: string;
  onCreate: () => void;
};

function firstName(displayName: string) {
  const trimmed = displayName.trim();
  if (trimmed === '') {
    return '';
  }
  return trimmed.split(/\s+/)[0];
}

export default function HomeHeader({ displayName, onCreate }: HomeHeaderProps) {
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

      <Pressable
        onPress={onCreate}
        accessibilityRole="button"
        accessibilityLabel="Propose an outing"
        style={({ pressed }) => [styles.createWrap, pressed && styles.pressed]}
      >
        <LinearGradient
          colors={brand}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.create}
        >
          <Ionicons name="add" size={22} color={colors.textOnBrand} />
        </LinearGradient>
      </Pressable>
    </View>
  );
}

const BUTTON = 42;

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: space.sm,
    paddingHorizontal: space.lg,
    paddingTop: space.xs,
  },
  text: { flex: 1 },
  date: {
    color: colors.textSoft,
    fontFamily: font.semi,
    fontSize: 11.5,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  greeting: {
    marginTop: 3,
    color: colors.text,
    fontFamily: font.display,
    fontSize: 26,
    letterSpacing: -0.5,
  },
  createWrap: {
    ...shadow.button,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
  },
  create: {
    width: BUTTON,
    height: BUTTON,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.7 },
});
