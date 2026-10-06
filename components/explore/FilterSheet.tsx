import type { ReactNode } from 'react';
import { Modal, Pressable, SafeAreaView, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import type { FeedWhen } from '../../services/serviceFeed';
import { EVENT_TAGS, tagLabel, type EventTag } from '../../lib/tags';
import { colors, radius, space, textSize, typo } from '../../theme';

type FilterSheetProps = {
  visible: boolean;
  radii: number[];
  radiusKm: number;
  onRadius: (km: number) => void;
  // When location is off, the distance can't apply: it says so instead.
  locationOn: boolean;
  onTurnOnLocation?: () => void;
  when: FeedWhen | null;
  onWhen: (when: FeedWhen | null) => void;
  tags: EventTag[];
  onToggleTag: (tag: EventTag) => void;
  liveOnly: boolean;
  onLiveOnly: (on: boolean) => void;
  // Left out when follows are off.
  followingOnly?: boolean;
  onFollowingOnly?: (on: boolean) => void;
  followingNote?: string;
  // How many plans the filters as set leave, for the button.
  count: number;
  loading: boolean;
  onReset: () => void;
  onClose: () => void;
};

const WHEN: { key: FeedWhen | null; label: string }[] = [
  { key: null, label: 'Any day' },
  { key: 'today', label: 'Today' },
  { key: 'tomorrow', label: 'Tomorrow' },
  { key: 'weekend', label: 'This weekend' },
];

// Every filter of Explore in one sheet. They apply as you set them; the
// button says how many plans that leaves.
export default function FilterSheet({
  visible,
  radii,
  radiusKm,
  onRadius,
  locationOn,
  onTurnOnLocation,
  when,
  onWhen,
  tags,
  onToggleTag,
  liveOnly,
  onLiveOnly,
  followingOnly,
  onFollowingOnly,
  followingNote,
  count,
  loading,
  onReset,
  onClose,
}: FilterSheetProps) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityRole="button" accessibilityLabel="Close filters" />
      <SafeAreaView style={styles.sheet}>
        <View style={styles.inner}>
          <View style={styles.grabber} />
          <View style={styles.head}>
            <Text style={styles.title} accessibilityRole="header">
              Filters
            </Text>
            <Pressable onPress={onReset} hitSlop={8} accessibilityRole="button" accessibilityLabel="Reset the filters">
              <Text style={styles.reset}>Reset</Text>
            </Pressable>
          </View>

          <ScrollView style={styles.scroll} contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
            <Group label="How far">
              {locationOn ? (
                <View style={styles.options}>
                  {radii.map((km) => (
                    <Option key={km} label={`${km} km`} on={km === radiusKm} onPress={() => onRadius(km)} />
                  ))}
                </View>
              ) : (
                <View style={styles.locationOff}>
                  <Text style={styles.note}>Location is off, so this shows plans everywhere.</Text>
                  {onTurnOnLocation ? (
                    <Pressable onPress={onTurnOnLocation} hitSlop={8} accessibilityRole="button" accessibilityLabel="Turn on location">
                      <Text style={styles.reset}>Turn on</Text>
                    </Pressable>
                  ) : null}
                </View>
              )}
            </Group>

            {liveOnly ? null : (
              <Group label="When">
                <View style={styles.options}>
                  {WHEN.map((option) => (
                    <Option
                      key={option.label}
                      label={option.label}
                      on={when === option.key}
                      onPress={() => onWhen(option.key)}
                    />
                  ))}
                </View>
              </Group>
            )}

            <Group label="What kind">
              <View style={styles.options}>
                {EVENT_TAGS.map((tag) => (
                  <Option key={tag} label={tagLabel(tag)} on={tags.includes(tag)} onPress={() => onToggleTag(tag)} />
                ))}
              </View>
            </Group>

            <View>
              <Toggle title="Live now" note="Only plans that are on" on={liveOnly} onChange={onLiveOnly} />
              {onFollowingOnly ? (
                <Toggle
                  title="Pareas you follow"
                  note={followingNote}
                  on={followingOnly === true}
                  onChange={onFollowingOnly}
                  last
                />
              ) : null}
            </View>
          </ScrollView>

          <Pressable
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel={loading ? 'Show the plans' : `Show ${count} ${count === 1 ? 'plan' : 'plans'}`}
            style={({ pressed }) => [styles.show, pressed && styles.pressed]}
          >
            <Text style={styles.showText}>
              {loading ? 'Show plans' : count === 0 ? 'No plans match' : `Show ${count} ${count === 1 ? 'plan' : 'plans'}`}
            </Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

function Group({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View style={styles.group}>
      <Text style={styles.groupLabel}>{label.toUpperCase()}</Text>
      {children}
    </View>
  );
}

function Option({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: on }}
      style={({ pressed }) => [styles.option, on && styles.optionOn, pressed && styles.pressed]}
    >
      <Text style={[styles.optionText, on && styles.optionTextOn]}>{label}</Text>
    </Pressable>
  );
}

function Toggle({
  title,
  note,
  on,
  onChange,
  last = false,
}: {
  title: string;
  note?: string;
  on: boolean;
  onChange: (on: boolean) => void;
  last?: boolean;
}) {
  return (
    <View style={[styles.toggle, last && styles.toggleLast]}>
      <View style={styles.toggleText}>
        <Text style={styles.toggleTitle}>{title}</Text>
        {note ? <Text style={styles.toggleNote}>{note}</Text> : null}
      </View>
      <Switch
        value={on}
        onValueChange={onChange}
        accessibilityLabel={title}
        trackColor={{ false: colors.borderStrong, true: colors.primary }}
        thumbColor={colors.surface}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(5,9,15,0.42)' },
  sheet: { maxHeight: '86%', backgroundColor: colors.surface, borderTopLeftRadius: radius.sheet, borderTopRightRadius: radius.sheet },
  // Padding inside: an iPhone's SafeAreaView sets its own.
  inner: { flexShrink: 1, paddingHorizontal: space.lg - 4, paddingTop: space.sm, paddingBottom: space.md },
  grabber: { alignSelf: 'center', width: 40, height: 5, borderRadius: 3, backgroundColor: colors.borderStrong },
  head: { flexDirection: 'row', alignItems: 'baseline', marginTop: space.md },
  title: { flex: 1, color: colors.text, ...typo.display, fontSize: 22, letterSpacing: -0.5 },
  reset: { color: colors.primary, ...typo.bold, fontSize: textSize.base },
  scroll: { flexShrink: 1 },
  body: { gap: space.lg, paddingTop: space.md, paddingBottom: space.md },
  group: { gap: space.sm },
  groupLabel: { color: colors.textFaint, ...typo.mono, fontSize: textSize.micro, letterSpacing: 1.4 },
  options: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs + 2 },
  option: {
    minHeight: 40,
    justifyContent: 'center',
    paddingHorizontal: 15,
    borderRadius: 13,
    backgroundColor: colors.surfaceAlt,
  },
  optionOn: { backgroundColor: colors.ink },
  optionText: { color: colors.text, ...typo.bold, fontSize: textSize.base },
  optionTextOn: { color: colors.onInk },
  note: { flex: 1, color: colors.textSoft, ...typo.medium, fontSize: textSize.body },
  locationOff: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  toggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  toggleLast: { borderBottomWidth: 0 },
  toggleText: { flex: 1 },
  toggleTitle: { color: colors.text, ...typo.bold, fontSize: textSize.base },
  toggleNote: { marginTop: 1, color: colors.textSoft, ...typo.regular, fontSize: textSize.small },
  show: {
    height: 52,
    marginTop: space.sm,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
  },
  showText: { color: colors.onInk, ...typo.display, fontSize: 16 },
  pressed: { opacity: 0.75 },
});
