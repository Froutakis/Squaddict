import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { colors, radius, shadow, space } from '../../theme';

const DASH_COUNT = 26;

type TicketProps = {
  children: ReactNode;
  stub?: ReactNode;
  tone?: 'light' | 'ink';
  notches?: boolean;
  cutColor?: string;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
};

export default function Ticket({
  children,
  stub,
  tone = 'light',
  notches = true,
  cutColor = colors.bg,
  onPress,
  style,
  accessibilityLabel,
}: TicketProps) {
  const ink = tone === 'ink';

  const content = (
    <>
      <View style={styles.main}>{children}</View>

      {stub ? (
        <>
          <View style={styles.perf}>
            <Dashes color={ink ? 'rgba(255,255,255,0.32)' : colors.borderStrong} />
            {notches ? (
              <>
                <View style={[styles.notch, styles.notchLeft, { backgroundColor: cutColor }]} />
                <View style={[styles.notch, styles.notchRight, { backgroundColor: cutColor }]} />
              </>
            ) : null}
          </View>
          <View style={styles.stub}>{stub}</View>
        </>
      ) : null}
    </>
  );

  if (!onPress) {
    return <View style={[styles.card, ink ? styles.ink : styles.light, style]}>{content}</View>;
  }

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [
        styles.card,
        ink ? styles.ink : styles.light,
        pressed && styles.pressed,
        style,
      ]}
    >
      {content}
    </Pressable>
  );
}

function Dashes({ color }: { color: string }) {
  return (
    <View style={styles.dashRow}>
      {Array.from({ length: DASH_COUNT }, (_, i) => (
        <View key={i} style={[styles.dash, { backgroundColor: color }]} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.lg, overflow: 'visible' },
  light: { backgroundColor: colors.surface, ...shadow.card },
  ink: { backgroundColor: colors.text, ...shadow.hero },
  pressed: { opacity: 0.85 },

  main: { paddingHorizontal: space.md, paddingTop: space.md, paddingBottom: space.sm },
  stub: { paddingHorizontal: space.md, paddingTop: space.sm, paddingBottom: space.md },

  perf: { height: 1.5, marginHorizontal: 14, justifyContent: 'center' },
  dashRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  dash: { width: 5, height: 1.5, borderRadius: 1 },
  notch: { position: 'absolute', top: -9, width: 18, height: 18, borderRadius: 9 },
  notchLeft: { left: -24 },
  notchRight: { right: -24 },
});
