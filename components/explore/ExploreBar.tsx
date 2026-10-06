import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { FAB_INSET } from '../general/MenuFab';
import { colors, shadow, space, textSize, typo } from '../../theme';

export type ExploreTab = 'plans' | 'people' | 'nights';

const BUTTON = 46;
const SMALL = 40;
// The small buttons are drawn 40 wide but still take a 44pt tap.
const SMALL_SLOP = (44 - SMALL) / 2;

type Counts = Partial<Record<ExploreTab, number>>;

// The search field, the filters (with how many are on) and line / map.
export function ExploreTools({
  query,
  onQuery,
  filtersOn,
  onFilters,
  mode,
  onMode,
}: {
  query: string;
  onQuery: (text: string) => void;
  filtersOn: number;
  onFilters: () => void;
  mode: 'list' | 'map';
  onMode: () => void;
}) {
  return (
    <View style={styles.tools}>
      <View style={styles.search}>
        <Ionicons name="search" size={17} color={colors.textFaint} />
        <TextInput
          value={query}
          onChangeText={onQuery}
          placeholder="Plans, pareas, places"
          placeholderTextColor={colors.textFaint}
          returnKeyType="search"
          autoCapitalize="none"
          autoCorrect={false}
          accessibilityLabel="Search plans and pareas"
          style={styles.searchInput}
        />
        {query.length > 0 ? (
          <Pressable onPress={() => onQuery('')} hitSlop={8} accessibilityRole="button" accessibilityLabel="Clear search">
            <Ionicons name="close-circle" size={18} color={colors.textFaint} />
          </Pressable>
        ) : null}
      </View>
      <FiltersButton count={filtersOn} onPress={onFilters} />
      <ModeButton mode={mode} onPress={onMode} />
    </View>
  );
}

// What is filtered, said in words, one tap from changing it.
export function ExploreApplied({ text, onChange }: { text: string; onChange: () => void }) {
  return (
    <Pressable
      onPress={onChange}
      accessibilityRole="button"
      accessibilityLabel={`${text}. Change the filters`}
      style={({ pressed }) => [styles.applied, pressed && styles.pressed]}
    >
      <Text style={styles.appliedText} numberOfLines={1}>
        {text}
      </Text>
      <Text style={styles.change}>Change</Text>
    </Pressable>
  );
}

// Plans · People · Nights, each with its count; a short ink bar under the one you are on.
export function ExploreTabs({
  tab,
  counts,
  onTab,
  tabs = ['plans', 'people', 'nights'],
  compact = false,
}: {
  tab: ExploreTab;
  counts: Counts;
  onTab: (tab: ExploreTab) => void;
  tabs?: ExploreTab[];
  compact?: boolean;
}) {
  return (
    <View style={[styles.tabs, compact && styles.tabsCompact]} accessibilityRole="tablist">
      {tabs.map((one) => {
        const on = one === tab;
        const count = counts[one];
        const label = one === 'plans' ? 'Plans' : one === 'people' ? 'People' : 'Nights';
        return (
          <Pressable
            key={one}
            onPress={() => onTab(one)}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            accessibilityLabel={count !== undefined ? `${label}, ${count}` : label}
            hitSlop={{ top: 8, bottom: 4, left: 6, right: 6 }}
            style={[styles.tab, compact && styles.tabCompact]}
          >
            <Text style={[styles.tabText, compact && styles.tabTextCompact, on && styles.tabTextOn]}>{label}</Text>
            {count !== undefined ? <Text style={styles.tabCount}>{count}</Text> : null}
            {on ? <View style={styles.tabBar} /> : null}
          </Pressable>
        );
      })}
    </View>
  );
}

// The folded header (after scrolling, and over the map): where and when, and
// the buttons, starting right of the floating menu button.
export function ExploreTitleRow({
  kicker,
  title,
  onSearch,
  filtersOn,
  onFilters,
  mode,
  onMode,
}: {
  kicker: string;
  title: string;
  onSearch?: () => void;
  filtersOn?: number;
  onFilters?: () => void;
  mode: 'list' | 'map';
  onMode: () => void;
}) {
  return (
    <View style={styles.titleRow}>
      <View style={styles.titleText}>
        <Text style={styles.kicker} numberOfLines={1}>
          {kicker}
        </Text>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
      </View>
      {onSearch ? (
        <Pressable
          onPress={onSearch}
          accessibilityRole="button"
          accessibilityLabel="Search"
          hitSlop={SMALL_SLOP}
          style={({ pressed }) => [styles.small, pressed && styles.pressed]}
        >
          <Ionicons name="search" size={18} color={colors.text} />
        </Pressable>
      ) : null}
      {onFilters ? <FiltersButton count={filtersOn ?? 0} onPress={onFilters} small /> : null}
      <ModeButton mode={mode} onPress={onMode} small />
    </View>
  );
}

function FiltersButton({ count, onPress, small = false }: { count: number; onPress: () => void; small?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={count > 0 ? `Filters, ${count} on` : 'Filters'}
      hitSlop={small ? SMALL_SLOP : undefined}
      style={({ pressed }) => [small ? styles.small : styles.button, pressed && styles.pressed]}
    >
      <Ionicons name="options-outline" size={20} color={colors.text} />
      {count > 0 ? (
        <View style={styles.count}>
          <Text style={styles.countText}>{count}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

function ModeButton({ mode, onPress, small = false }: { mode: 'list' | 'map'; onPress: () => void; small?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={mode === 'list' ? 'Show on a map' : 'Show as a line'}
      hitSlop={small ? SMALL_SLOP : undefined}
      style={({ pressed }) => [small ? styles.small : styles.button, styles.ink, pressed && styles.pressed]}
    >
      <Ionicons name={mode === 'list' ? 'map-outline' : 'list'} size={19} color={colors.onInk} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressed: { opacity: 0.7 },
  tools: { flexDirection: 'row', gap: space.xs + 2, paddingHorizontal: space.md },
  search: {
    flex: 1,
    height: BUTTON,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingHorizontal: 14,
    borderRadius: 16,
    backgroundColor: colors.surface,
    ...shadow.card,
  },
  searchInput: { flex: 1, height: BUTTON, color: colors.text, ...typo.medium, fontSize: 15 },
  button: {
    width: BUTTON,
    height: BUTTON,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    ...shadow.card,
  },
  small: {
    width: SMALL,
    height: SMALL,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  ink: { backgroundColor: colors.ink },
  count: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    borderWidth: 2,
    borderColor: colors.bg,
  },
  countText: { color: colors.onInk, ...typo.display, fontSize: 10 },

  applied: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingHorizontal: space.lg - 2, minHeight: 32 },
  appliedText: { flex: 1, color: colors.textSoft, ...typo.medium, fontSize: textSize.body },
  change: { color: colors.primary, ...typo.bold, fontSize: textSize.body },

  tabs: {
    flexDirection: 'row',
    gap: 22,
    paddingHorizontal: space.lg - 2,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  tabsCompact: { paddingHorizontal: 2, gap: 18, borderBottomWidth: 0 },
  tab: { flexDirection: 'row', alignItems: 'baseline', gap: 5, paddingTop: space.sm, paddingBottom: 11 },
  tabCompact: { paddingTop: space.xs, paddingBottom: 8 },
  tabText: { color: colors.textFaint, ...typo.bold, fontSize: 15 },
  tabTextCompact: { fontSize: 14 },
  tabTextOn: { color: colors.text },
  tabCount: { color: colors.textFaint, ...typo.mono, fontSize: 11 },
  tabBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: -1,
    height: 3,
    borderTopLeftRadius: 3,
    borderTopRightRadius: 3,
    backgroundColor: colors.ink,
  },

  titleRow: { flexDirection: 'row', alignItems: 'center', gap: space.xs + 2, paddingLeft: FAB_INSET - space.md },
  titleText: { flex: 1, minWidth: 0 },
  kicker: { color: colors.primary, ...typo.mono, fontSize: 10, letterSpacing: 1.4 },
  title: { color: colors.text, ...typo.display, fontSize: 19, letterSpacing: -0.4 },
});
