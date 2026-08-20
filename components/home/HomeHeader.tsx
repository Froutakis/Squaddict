import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors, font, radius, shadow, space } from "../../theme";
import GradientAvatar, { initialsFor } from "../general/GradientAvatar";
import { todayLabel } from "../../lib/datetime";

type HomeHeaderProps = {
    displayName: string;
    onProfile: () => void;
}



export default function HomeHeader({ displayName, onProfile } : HomeHeaderProps){
    const name = displayName || 'there';
    const init = initialsFor(displayName);

    return (
    <View style={styles.header}>
        <View style={styles.left}>
            <Text style={styles.date}>{todayLabel()}</Text>
            <Text style={styles.greeting}>Hello, {name}</Text>
        </View>
        <View style={styles.right}>
          <Pressable accessibilityRole='button' accessibilityLabel='Profile' onPress={onProfile}>
            <GradientAvatar label="E" initials={init} />
          </Pressable>
        </View>
    </View>
    )
}



const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.lg,
    paddingTop: space.sm,
    paddingBottom: space.md,
  },
  left: { flex: 1, paddingRight: space.md },
  date: { color: colors.textSoft, fontFamily: font.medium, fontSize: 13 },
  greeting: { color: colors.text, fontFamily: font.display, fontSize: 26, marginTop: 2 },
  right: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  bell: {
    width: 46,
    height: 46,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.card,
  },
  bellDot: {
    position: 'absolute',
    top: 11,
    right: 12,
    width: 9,
    height: 9,
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
    borderWidth: 1.5,
    borderColor: colors.surface,
  },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: '#FFFFFF', fontFamily: font.semi, fontSize: 16 },
});
