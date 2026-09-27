import { useEffect, useState } from 'react';
import { Image, Modal, Pressable, StyleSheet, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { radius, space, textSize, typo } from '../../theme';

type ImageViewerProps = {
  uri: string | null;
  label: string;
  onClose: () => void;
};

export default function ImageViewer({ uri, label, onClose }: ImageViewerProps) {
  const [broken, setBroken] = useState(false);

  useEffect(() => {
    setBroken(false);
  }, [uri]);

  return (
    <Modal visible={uri !== null} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable
        style={styles.backdrop}
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel="Close image"
      >
        {uri && !broken ? (
          <Image
            source={{ uri }}
            style={styles.image}
            resizeMode="contain"
            accessibilityLabel={label}
            onError={function () {
              setBroken(true);
            }}
          />
        ) : (
          <Text style={styles.missing}>Couldn't load this image.</Text>
        )}

        <Pressable
          onPress={onClose}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Close"
          style={({ pressed }) => [styles.close, pressed && styles.pressed]}
        >
          <Ionicons name="close" size={22} color="#FFFFFF" />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: { width: '100%', height: '100%' },
  missing: { color: '#FFFFFF', ...typo.medium, fontSize: textSize.base },
  close: {
    position: 'absolute',
    top: space.xl,
    right: space.md,
    width: 38,
    height: 38,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.6 },
});
