import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { font, gradientFor, radius } from '../../theme';

/** Αρχικά για avatar: "Nikos Papas" → "NP", "Beach" → "B". Ίδιο όνομα, ίδια αρχικά παντού. */
export function initialsFor(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

type GradientAvatarProps = {
  /** Το όνομα ορίζει το gradient (μέσω gradientFor) — ίδιο όνομα, ίδιο χρώμα πάντα. */
  label: string;
  size?: number;
  /** Παράκαμψη των αρχικών, π.χ. 'PC' για "Paralia Crew". */
  initials?: string;
  /** Λευκό περίγραμμα — για στοίβες avatars και pins πάνω σε χάρτη. */
  ring?: number;
  /** Σταθερό gradient αντί για το υπολογισμένο (π.χ. brand για τον ίδιο τον χρήστη). */
  gradient?: readonly [string, string];
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
};

export default function GradientAvatar({
  label,
  size = 40,
  initials,
  ring = 0,
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
        ring > 0 && { borderWidth: ring, borderColor: '#FFFFFF' },
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

export function FlatAvatar({
  size = 54,
  color,
  dashed = false,
  borderColor,
  children,
}: {
  size?: number;
  color: string;
  dashed?: boolean;
  borderColor?: string;
  children?: React.ReactNode;
}) {
  return (
    <View
      style={[
        styles.base,
        { width: size, height: size, borderRadius: radius.pill, backgroundColor: color },
        dashed && { borderWidth: 1.5, borderStyle: 'dashed', borderColor: borderColor ?? '#D2C8DD' },
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  text: { color: '#FFFFFF', fontFamily: font.semi, letterSpacing: 0.4 },
});
