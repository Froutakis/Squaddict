import { Component, type ReactNode } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius, space, textSize, typo } from '../../theme';

type ErrorBoundaryProps = { children: ReactNode };
type ErrorBoundaryState = { failed: boolean };

// Catches a crash anywhere below it and shows a way back instead of a blank screen.
export default class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { failed: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    console.error('[squaddict] the app crashed:', error);
  }

  render() {
    if (!this.state.failed) return this.props.children;

    return (
      <View style={styles.screen}>
        <View style={styles.icon}>
          <Ionicons name="bandage-outline" size={28} color={colors.primary} />
        </View>
        <Text style={styles.title}>Something broke</Text>
        <Text style={styles.body}>That wasn't supposed to happen. Your plans and chats are safe.</Text>
        <Pressable
          onPress={() => this.setState({ failed: false })}
          accessibilityRole="button"
          accessibilityLabel="Try again"
          style={({ pressed }) => [styles.button, pressed && styles.pressed]}
        >
          <Text style={styles.buttonText}>Try again</Text>
        </Pressable>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
    padding: space.xl,
    backgroundColor: colors.bg,
  },
  icon: {
    width: 64,
    height: 64,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  title: { color: colors.text, ...typo.display, fontSize: textSize.heading, letterSpacing: -0.3 },
  body: { color: colors.textSoft, ...typo.medium, fontSize: textSize.body, textAlign: 'center', lineHeight: 20 },
  button: {
    marginTop: space.sm,
    height: 44,
    paddingHorizontal: space.xl,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
  },
  buttonText: { color: colors.textOnBrand, ...typo.semi, fontSize: textSize.base },
  pressed: { opacity: 0.75 },
});
