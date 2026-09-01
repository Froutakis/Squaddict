import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { Group } from '../../services/serviceGroup';
import type { GroupPreview } from '../../services/serviceGroup';
import { initialsFor } from '../general/GradientAvatar';
import { layout, paper, paperFont, radius, solidFor, space } from '../../theme';

export function SquadMonogram({ name, size = 44 }: { name: string; size?: number }) {
  const color = solidFor(name);

  return (
    <View
      style={[
        styles.monogram,
        {
          width: size,
          height: size,
          borderRadius: Math.round(size * 0.3),
          backgroundColor: color + '1F',
        },
      ]}
    >
      <Text style={[styles.monogramText, { color, fontSize: Math.round(size * 0.34) }]}>
        {initialsFor(name)}
      </Text>
    </View>
  );
}

function stampFor(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';

  const now = new Date();
  const sameDay =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();
  if (sameDay) {
    return date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  }

  const yesterday = new Date();
  yesterday.setDate(now.getDate() - 1);
  const isYesterday =
    date.getFullYear() === yesterday.getFullYear() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getDate() === yesterday.getDate();
  if (isYesterday) return 'Yesterday';

  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

function PersonGlyph({ size = 34 }: { size?: number }) {
  const head = Math.round(size * 0.3);
  const shoulders = Math.round(size * 0.58);

  return (
    <View style={[styles.glyph, { width: size, height: size, borderRadius: size / 2 }]}>
      <View
        style={{
          width: head,
          height: head,
          borderRadius: head / 2,
          backgroundColor: paper.ink,
          marginTop: Math.round(size * 0.2),
        }}
      />
      <View
        style={{
          width: shoulders,
          height: shoulders,
          borderRadius: shoulders / 2,
          backgroundColor: paper.ink,
          marginTop: Math.round(size * 0.06),
        }}
      />
    </View>
  );
}

type SquadPickerProps = {
  groups: Group[];
  previews: Record<string, GroupPreview>;
  onSelect: (id: string) => void;
  displayName?: string;
  onBack?: () => void;
};

export default function SquadPicker({
  groups,
  previews,
  onSelect,
  onBack,
  displayName = '',
}: SquadPickerProps) {
  const who = displayName || 'you';

  const [query, setQuery] = useState('');

  const needle = query.trim().toLowerCase();
  const shown = needle
    ? groups.filter(function (group) {
        return group.name.toLowerCase().includes(needle);
      })
    : groups;

  function rowStyle({ pressed }: { pressed: boolean }): StyleProp<ViewStyle> {
    if (pressed) return [styles.row, styles.rowPressed];
    return styles.row;
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.head}>
        {onBack ? (
          <Pressable
            onPress={onBack}
            accessibilityRole="button"
            accessibilityLabel="Back"
            style={styles.back}
          >
            <Ionicons name="chevron-back" size={20} color={paper.ink} />
          </Pressable>
        ) : null}

        <PersonGlyph />
        <Text style={styles.title}>{who}</Text>
      </View>

      <View style={styles.search}>
        <Ionicons name="search" size={16} color={paper.inkFaint} />
        <TextInput
          style={styles.searchInput}
          value={query}
          onChangeText={setQuery}
          placeholder="Search your squads"
          placeholderTextColor={paper.inkFaint}
          autoCorrect={false}
          accessibilityLabel="Search squads"
        />
        {needle ? (
          <Pressable
            onPress={function () {
              setQuery('');
            }}
            accessibilityRole="button"
            accessibilityLabel="Clear search"
          >
            <Ionicons name="close-circle" size={16} color={paper.inkFaint} />
          </Pressable>
        ) : null}
      </View>

      <Text style={styles.section}>Squads</Text>

      {shown.length === 0 ? (
        <View style={styles.blank}>
          <Text style={styles.blankTitle}>
            {groups.length === 0 ? 'No squads yet' : 'Nothing matches'}
          </Text>
          <Text style={styles.blankText}>
            {groups.length === 0
              ? 'Join a squad from Home and it will show up here.'
              : `No squad called "${query.trim()}".`}
          </Text>
        </View>
      ) : (
        <View style={styles.card}>
          {shown.map(function (group, index) {
            const preview = previews[group.id];

            let line = 'No messages yet';
            if (preview) {
              line = preview.senderName
                ? `${preview.senderName}: ${preview.content}`
                : preview.content;
            }

            return (
              <Pressable
                key={group.id}
                onPress={function () {
                  onSelect(group.id);
                }}
                accessibilityRole="button"
                accessibilityLabel={`Open ${group.name}`}
                style={rowStyle}
              >
                {index > 0 ? <View style={styles.divider} /> : null}

                <SquadMonogram name={group.name} />

                <View style={styles.rowText}>
                  <Text style={styles.name} numberOfLines={1}>
                    {group.name}
                  </Text>
                  <Text style={styles.preview} numberOfLines={1}>
                    {line}
                  </Text>
                </View>

                <View style={styles.rowEnd}>
                  {preview ? <Text style={styles.stamp}>{stampFor(preview.createdAt)}</Text> : null}
                  <Ionicons name="chevron-forward" size={16} color={paper.inkFaint} />
                </View>
              </Pressable>
            );
          })}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: paper.bg },
  content: {
    width: '100%',
    maxWidth: layout.column,
    alignSelf: 'center',
    paddingHorizontal: space.md,
    paddingBottom: 110,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
    paddingTop: space.lg,
    paddingBottom: space.md,
  },
  back: {
    position: 'absolute',
    left: -6,
    top: space.lg,
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    color: paper.ink,
    fontFamily: paperFont.serifSemi,
    fontSize: 30,
    letterSpacing: -0.4,
    textAlign: 'center',
  },
  glyph: {
    alignItems: 'center',
    overflow: 'hidden',
    backgroundColor: paper.surfaceAlt,
  },

  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingHorizontal: 14,
    height: 42,
    backgroundColor: paper.surface,
    borderWidth: 1,
    borderColor: paper.line,
    borderRadius: radius.pill,
  },
  searchInput: {
    flex: 1,
    color: paper.ink,
    fontFamily: paperFont.regular,
    fontSize: 14,
    outlineStyle: 'none',
  } as any,

  section: {
    marginTop: space.lg,
    marginBottom: space.sm,
    marginLeft: 2,
    color: paper.inkSoft,
    fontFamily: paperFont.semi,
    fontSize: 11,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },

  card: {
    backgroundColor: paper.surface,
    borderWidth: 1,
    borderColor: paper.line,
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingHorizontal: space.md,
    paddingVertical: 13,
  },
  rowPressed: { backgroundColor: paper.surfaceAlt },
  divider: {
    position: 'absolute',
    top: 0,
    left: space.md + 44 + space.sm,
    right: 0,
    height: 1,
    backgroundColor: paper.lineSoft,
  },
  rowText: { flex: 1 },
  name: { color: paper.ink, fontFamily: paperFont.semi, fontSize: 15 },
  preview: { marginTop: 2, color: paper.inkSoft, fontFamily: paperFont.regular, fontSize: 13 },
  rowEnd: { alignItems: 'flex-end', gap: 4 },
  stamp: { color: paper.inkFaint, fontFamily: paperFont.regular, fontSize: 11 },

  monogram: { alignItems: 'center', justifyContent: 'center' },
  monogramText: { fontFamily: paperFont.semi, letterSpacing: 0.2 },

  blank: {
    alignItems: 'center',
    gap: 6,
    paddingVertical: space.xl,
    paddingHorizontal: space.lg,
    backgroundColor: paper.surface,
    borderWidth: 1,
    borderColor: paper.line,
    borderRadius: radius.lg,
  },
  blankTitle: { color: paper.ink, fontFamily: paperFont.semi, fontSize: 15 },
  blankText: {
    color: paper.inkSoft,
    fontFamily: paperFont.regular,
    fontSize: 13,
    textAlign: 'center',
  },
});
