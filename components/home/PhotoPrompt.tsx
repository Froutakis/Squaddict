import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, typo, radius, space, textSize } from '../../theme';

type PhotoPromptProps = {
  title: string;
  groupName: string;
  live: boolean;
  hereCount: number;
  onAdd: () => void;
};

export default function PhotoPrompt({ title, groupName, live, hereCount, onAdd }: PhotoPromptProps) {
  const here = hereCount > 0 ? ` · ${hereCount} checked in` : '';

  return (
    <Pressable
      onPress={onAdd}
      accessibilityRole="button"
      accessibilityLabel={`Add a photo from ${title}`}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <View style={styles.icon}>
        <Ionicons name="camera" size={20} color={colors.textOnBrand} />
      </View>

      <View style={styles.text}>
        <Text style={styles.title} numberOfLines={1}>
          {live ? `How's ${title} going?` : `How was ${title}?`}
        </Text>
        <Text style={styles.body} numberOfLines={1}>
          Drop a photo for {groupName}
          {here}
        </Text>
      </View>

      <View style={styles.add}>
        <Text style={styles.addText}>Add</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    padding: space.sm,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  pressed: { opacity: 0.7 },
  icon: {
    width: 42,
    height: 42,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
  },
  text: { flex: 1, minWidth: 0, gap: 2 },
  title: { color: colors.text, ...typo.semi, fontSize: textSize.base },
  body: { color: colors.textSoft, ...typo.medium, fontSize: textSize.small },
  add: {
    height: 34,
    paddingHorizontal: 16,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.ink,
  },
  addText: { color: colors.textOnBrand, ...typo.semi, fontSize: textSize.small },
});
