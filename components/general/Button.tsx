import { Pressable, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { colors, radius } from '../../theme';

export default function Button({
  title,
  onPress,
  loading = false,
}: {
  title: string;
  onPress: () => void;
  loading?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={loading}
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ busy: loading, disabled: loading }}
      style={({ pressed }) => [styles.button, pressed && styles.pressed]}
    >
      {loading ? (
        <ActivityIndicator color="#FFFFFF" />
      ) : (
        <Text style={styles.text}>{title}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // A blue pill: the one main thing to do.
  button: {
    height: 50,
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.85, transform: [{ scale: 0.98 }] },
  text: { color: '#FFFFFF', fontSize: 15.5, fontWeight: '600' },
});
