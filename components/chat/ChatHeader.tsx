import { Ionicons } from '@expo/vector-icons';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { GroupMonogram } from './GroupPicker';
import { presenceLabel } from './typing';
import { paper, typo, radius, space } from '../../theme';

type ChatHeaderProps = {
  name: string;
  withName?: string;
  avatarUrl?: string | null;
  memberCount: number;
  online: number;
  onBack: () => void;
  onSearch: () => void;
  onOpenGroup: () => void;
};


export default function ChatHeader({
  name,
  withName,
  avatarUrl,
  memberCount,
  online,
  onBack,
  onSearch,
  onOpenGroup,
}: ChatHeaderProps) {
  return (
    <View style={styles.bar}>
      <Pressable
        onPress={onBack}
        accessibilityRole="button"
        accessibilityLabel="Back to squads"
        style={roundButtonStyle}
      >
        <Ionicons name="chevron-back" size={20} color={paper.ink} />
      </Pressable>

      {withName ? (
        <View style={styles.pair}>
          <GroupMonogram name={withName} size={30} />
          <View style={styles.second}>
            <GroupMonogram name={name} size={30} />
          </View>
        </View>
      ) : (
        <GroupMonogram name={name} size={32} uri={avatarUrl} />
      )}

      <View style={styles.text}>
        <Text style={styles.title} numberOfLines={1}>
          {name}
        </Text>
        <Text style={styles.subtitle} numberOfLines={1}>
          {withName ? `with ${withName}` : presenceLabel(memberCount, online)}
        </Text>
      </View>

      <Pressable
        onPress={onSearch}
        accessibilityRole="button"
        accessibilityLabel="Search messages"
        style={roundButtonStyle}
      >
        <Ionicons name="search" size={19} color={paper.ink} />
      </Pressable>
      <Pressable 
        onPress={onOpenGroup}
        accessibilityRole="button"
        accessibilityLabel="Open group"
        style={roundButtonStyle}
      >
        <Ionicons name="information-circle-outline" size={19} color={paper.ink} />
      </Pressable>
    </View>
  );
}

function roundButtonStyle({ pressed }: { pressed: boolean }): StyleProp<ViewStyle> {
  if (pressed) {
    return [styles.round, styles.pressed];
  }
  return styles.round;
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingHorizontal: space.md,
    paddingTop: space.sm,
    paddingBottom: space.sm,
    borderBottomWidth: 1,
    borderBottomColor: paper.line,
    backgroundColor: paper.bg,
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
  pair: { width: 52, height: 30, flexDirection: 'row' },
  second: { marginLeft: -8 },
  text: { flex: 1 },
  title: { color: paper.ink, ...typo.semi, fontSize: 16 },
  subtitle: {
    marginTop: 2,
    color: paper.inkFaint,
    ...typo.mono,
    fontSize: 9.5,
    letterSpacing: 0.9,
    textTransform: 'uppercase',
  },
});
