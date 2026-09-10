import { Ionicons } from '@expo/vector-icons';
import { Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { GroupMonogram } from '../components/chat/GroupPicker';
import type { Group } from '../services/serviceGroup';
import { layout, paper, paperFont, radius, space } from '../theme';

type GroupScreenProps = {
  group: Group;
  onBack: () => void;
};

export default function GroupScreen({ group, onBack }: GroupScreenProps) {
  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.column}>
        <View style={styles.header}>
          <Pressable
            onPress={onBack}
            accessibilityRole="button"
            accessibilityLabel="Back to the conversation"
            style={roundButtonStyle}
          >
            <Ionicons name="chevron-back" size={20} color={paper.ink} />
          </Pressable>

          <GroupMonogram name={group.name} size={32} />

          <Text style={styles.title} numberOfLines={1}>
            {group.name}
          </Text>
        </View>

        <View style={styles.body}>
          <Text style={styles.placeholder}>The squad profile is coming here.</Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

function roundButtonStyle({ pressed }: { pressed: boolean }) {
  return pressed ? [styles.round, styles.pressed] : styles.round;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: paper.bg },
  column: { flex: 1, width: '100%', maxWidth: layout.column, alignSelf: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingHorizontal: space.md,
    paddingTop: space.sm,
    paddingBottom: space.sm,
    borderBottomWidth: 1,
    borderBottomColor: paper.line,
  },
  round: {
    width: 32,
    height: 32,
    marginLeft: -4,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { backgroundColor: paper.surfaceAlt },
  title: { flex: 1, color: paper.ink, fontFamily: paperFont.semi, fontSize: 16 },
  body: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: space.lg },
  placeholder: { color: paper.inkFaint, fontFamily: paperFont.regular, fontSize: 14 },
});