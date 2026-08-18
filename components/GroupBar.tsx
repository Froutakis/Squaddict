import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Group } from '../models/main';
import { colors, font, gradientFor, radius, space } from '../theme';

type GroupBarProps = {
    groups: Group[];
    activeId: string | null;
    onSelect: (id: string | null) => void;
    unread?: Record<string, number>;
};

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[1].charAt(0)).toUpperCase();
}

export default function GroupBar({ groups, activeId, onSelect, unread = {} }: GroupBarProps) {
    return (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row} >
            <Pressable style={styles.item}
                onPress={() => onSelect(null)}
                accessibilityRole='button'
                accessibilityLabel='All Squads'>
                <View style={[styles.ring, styles.ring, activeId === null && styles.ringActive]}>
                    <View style={styles.allTile}>
                        <Ionicons name="people-outline" size={22} color={colors.bg} />
                    </View>
                </View>
                <Text style={[styles.label, activeId === null && styles.labelActive]} numberOfLines={1}>All</Text>
            </Pressable>

            {groups.map((group) => {
                const active = activeId === group.id;
                const count = unread[group.id] ?? 0;
                return (
                    <Pressable
                        key={group.id}
                        style={styles.item}
                        onPress={() => onSelect(group.id)}
                        accessibilityRole="button"
                        accessibilityLabel={group.name}
                    >
                        <View style={[styles.ring, active && styles.ringActive]}>
                            <LinearGradient
                                colors={gradientFor(group.name)}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 1 }}
                                style={styles.avatar}
                            >
                                <Text style={styles.avatarText}>{initials(group.name)}</Text>
                            </LinearGradient>
                            {count > 0 ? (
                                <View style={styles.badge}>
                                    <Text style={styles.badgeText}>{count > 9 ? '9+' : count}</Text>
                                </View>
                            ) : null}
                        </View>
                        <Text style={[styles.label, active && styles.labelActive]} numberOfLines={1}>{group.name}</Text>
                    </Pressable>
                );
            })}
        </ScrollView>
    )
}


const AVATAR = 58;
const styles = StyleSheet.create({
  row: { paddingHorizontal: space.lg, paddingVertical: space.xs, gap: space.md },
  item: { width: 68, alignItems: 'center' },
  ring: { padding: 3, borderRadius: radius.pill, borderWidth: 2, borderColor: 'transparent' },
  ringActive: { borderColor: colors.primary },
  allTile: {
    width: AVATAR,
    height: AVATAR,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatar: {
    width: AVATAR,
    height: AVATAR,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: '#FFFFFF', fontFamily: font.semi, fontSize: 20 },
  badge: {
    position: 'absolute',
    top: -2,
    right: -2,
    minWidth: 22,
    height: 22,
    paddingHorizontal: 5,
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.bg,
  },
  badgeText: { color: '#FFFFFF', fontFamily: font.bold, fontSize: 11 },
  label: { marginTop: 7, color: colors.textSoft, fontFamily: font.medium, fontSize: 12, maxWidth: 68, textAlign: 'center' },
  labelActive: { color: colors.text, fontFamily: font.semi },
});