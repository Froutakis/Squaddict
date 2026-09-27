import { useState } from 'react';
import { Image, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { radius, solidFor, typo } from '../../theme';

export function initialsFor(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

type MonogramProps = {
  name: string;
  uri?: string | null;
  size?: number;
  initials?: string;
  square?: boolean;
  ring?: number;
  ringColor?: string;
  color?: string;
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
};

export default function Monogram({
  name,
  uri,
  size = 40,
  initials,
  square = false,
  ring = 0,
  ringColor = '#FFFFFF',
  color,
  style,
  children,
}: MonogramProps) {
  const [failedUri, setFailedUri] = useState<string | null>(null);
  const photo = uri && uri !== failedUri ? uri : null;

  return (
    <View
      style={[
        styles.base,
        {
          width: size,
          height: size,
          borderRadius: square ? Math.round(size * 0.3) : radius.pill,
          backgroundColor: color ?? solidFor(name),
        },
        ring > 0 ? { borderWidth: ring, borderColor: ringColor } : null,
        style,
      ]}
    >
      {children ??
        (photo ? (
          <Image
            source={{ uri: photo }}
            style={styles.photo}
            accessibilityIgnoresInvertColors
            onError={() => setFailedUri(photo)}
          />
        ) : (
          <Text style={[styles.text, { fontSize: Math.round(size * 0.36) }]}>
            {initials ?? initialsFor(name)}
          </Text>
        ))}
    </View>
  );
}

const styles = StyleSheet.create({
  base: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  text: { color: '#FFFFFF', ...typo.semi },
  photo: { width: '100%', height: '100%' },
});
