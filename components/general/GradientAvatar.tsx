import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, Text, type StyleProp, type ViewStyle } from 'react-native';
import { typo, gradientFor, radius } from '../../theme';

export function initialsFor(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

type GradientAvatarProps = {
  label: string;
  size?: number;
  initials?: string;
  ring?: number;
  ringColor?: string;
  gradient?: readonly [string, string];
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
};

export default function GradientAvatar({
  label,
  size = 40,
  initials,
  ring = 0,
  ringColor = '#FFFFFF',
  gradient,
  style,
  children,
}: GradientAvatarProps) {
  const c = gradient ?? gradientFor(label);
  const text = initials ?? label.slice(0, 1).toUpperCase();

  return (
    <LinearGradient
      colors={[c[0], c[1]]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[
        styles.base,
        { width: size, height: size, borderRadius: radius.pill },
        ring > 0 && { borderWidth: ring, borderColor: ringColor },
        style,
      ]}
    >
      {children ?? (
        <Text style={[styles.text, { fontSize: Math.max(10, Math.round(size * 0.34)) }]}>
          {text}
        </Text>
      )}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  base: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  text: { color: '#FFFFFF', ...typo.semi, letterSpacing: 0.4 },
});
