import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, font, radius, space } from '../../theme';

type ListEmptyProps = {
  title: string;
  body: string;
  actionLabel: string;
  onAction: () => void;
};

export default function ListEmpty({ title, body, actionLabel, onAction }: ListEmptyProps) {
  return (
    <View style={styles.box}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.body}>{body}</Text>

      <Pressable
        onPress={onAction}
        accessibilityRole="button"
        accessibilityLabel={actionLabel}
        style={({ pressed }) => [styles.button, pressed && styles.pressed]}
      >
        <Text style={styles.buttonText}>{actionLabel}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    alignItems: 'center',
    paddingHorizontal: space.lg,
    paddingVertical: space.lg,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.borderStrong,
    backgroundColor: colors.surfaceAlt,
  },
  title: { color: colors.textStrong, fontFamily: font.bold, fontSize: 15.5, textAlign: 'center' },
  body: {
    marginTop: 4,
    color: colors.textSoft,
    fontFamily: font.medium,
    fontSize: 13.5,
    textAlign: 'center',
  },
  button: {
    marginTop: space.md,
    height: 42,
    paddingHorizontal: 18,
    borderRadius: radius.sm,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: { color: colors.textOnBrand, fontFamily: font.bold, fontSize: 13.5 },
  pressed: { opacity: 0.7 },
});
