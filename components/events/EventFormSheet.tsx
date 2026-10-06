import { useEffect, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import type { Group } from '../../services/serviceGroup';
import {
  updateEvent,
  type MyEvent,
  type NewEvent,
} from '../../services/serviceEvents';
import { proposePlan, type VoteStatus } from '../../services/serviceVotes';
import { errorText } from '../../lib/postgres';
import { membersWhoVote, votesNeeded } from '../../lib/squadVote';
import type { Place } from '../../services/servicePlaces';
import { EVENT_TAGS, tagLabel, type EventTag } from '../../lib/tags';
import { colors, typo, radius, space, textSize } from '../../theme';
import { fieldStyles } from '../../fieldStyles';
import { addDays, keyOf } from '../../lib/datetime';
import AuthField from '../general/AuthField';
import Button from '../general/Button';
import Chip from '../general/Chip';
import DateField from '../general/DateField';
import GroupBar from '../general/GroupBar';
import PlaceField from '../general/PlaceField';

type EventFormSheetProps = {
  visible: boolean;
  groups: Group[];
  defaultGroupId: string | null;
  defaultDate: string;
  event?: MyEvent | null;
  // A new plan started from an old one ("Plan it again"): its title, place,
  // times and tags fill the form, on defaultDate.
  draft?: MyEvent | null;
  onClose: () => void;
  onSaved: () => void | Promise<void>;
  // After a new plan went to the vote: "See the vote" opens Votes there.
  onOpenVotes?: (groupId: string) => void;
};

function placeOf(event?: MyEvent | null): Place | null {
  if (!event?.placeLabel || event.lat === undefined || event.lng === undefined) return null;

  return { label: event.placeLabel, lat: event.lat, lng: event.lng };
}

function Label({ children }: { children: string }) {
  return <Text style={[fieldStyles.label, styles.label]}>{children}</Text>;
}

// The days the chips offer: two weeks from today.
const DAY_CHIPS = 14;

// Which field a problem belongs under.
type Problem = { at: 'title' | 'date' | 'group' | 'place' | 'form'; text: string };

export default function EventFormSheet({
  visible,
  groups,
  defaultGroupId,
  defaultDate,
  event,
  draft = null,
  onClose,
  onSaved,
  onOpenVotes,
}: EventFormSheetProps) {
  const [title, setTitle] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [description, setDescription] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [nickname, setNickname] = useState('');
  const [place, setPlace] = useState<Place | null>(null);
  const [isPublic, setIsPublic] = useState(false);
  const [tags, setTags] = useState<EventTag[]>([]);
  const [targetGroup, setTargetGroup] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [problem, setProblem] = useState<Problem | null>(null);
  // Another day than the chips: the date picker.
  const [otherDay, setOtherDay] = useState(false);
  // A new plan that went to the vote: where it went, and how it stands.
  const [sent, setSent] = useState<{ groupId: string; status: VoteStatus } | null>(null);

  useEffect(
    function () {
      if (!visible) return;

      const from = event ?? draft;
      setTitle(from?.title ?? '');
      setEventDate(event?.date ?? defaultDate);
      setDescription(from?.description ?? '');
      setStartTime(from?.startTime ?? '');
      setEndTime(from?.endTime ?? '');
      setNickname(from?.location ?? '');
      setPlace(placeOf(from));
      setIsPublic(from?.isPublic ?? false);
      setTags(from?.tags ?? []);
      setTargetGroup(defaultGroupId ?? groups[0]?.id ?? null);
      setProblem(null);
      setSent(null);
      setOtherDay(false);
    },
    [visible, defaultDate, event?.id, draft?.id],
  );

  const editing = !!event;
  const hadPlace = !!placeOf(event);
  const placeRequired = isPublic || !editing || hadPlace;

  // A new plan is the parea's call: "3 of 5 decide".
  const chosenGroup = groups.find((group) => group.id === targetGroup) ?? null;
  const deciding = membersWhoVote('plan', chosenGroup?.memberCount ?? 1);
  const needed = votesNeeded(deciding);
  const sentGroup = sent ? groups.find((group) => group.id === sent.groupId) ?? null : null;

  function toggleTag(tag: EventTag) {
    setTags(function (current) {
      return current.includes(tag) ? current.filter((t) => t !== tag) : [...current, tag];
    });
  }

  // Today and the next two weeks, as chips; the picker for any other day.
  const today = new Date();
  const days = Array.from({ length: DAY_CHIPS }, (_, i) => addDays(today, i));
  const dayKeys = days.map(keyOf);
  const showPicker = otherDay || (eventDate !== '' && !dayKeys.includes(eventDate));

  const errorAt = (at: Problem['at']) => (problem && problem.at === at ? problem.text : undefined);

  async function handleSave() {
    if (!title.trim()) { setProblem({ at: 'title', text: 'Give your plan a title.' }); return; }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(eventDate)) { setProblem({ at: 'date', text: 'Pick a day.' }); return; }
    if (!editing && !targetGroup) { setProblem({ at: 'group', text: 'Pick a parea.' }); return; }
    if (placeRequired && !place) { setProblem({ at: 'place', text: 'Pick a place from the list so it shows on the map.' }); return; }

    const input: NewEvent = {
      title: title.trim(),
      date: eventDate,
      startTime: startTime.trim() || undefined,
      endTime: endTime.trim() || undefined,
      location: nickname.trim() || undefined,
      description: description.trim() || undefined,
      lat: place?.lat,
      lng: place?.lng,
      placeLabel: place?.label,
      isPublic,
      tags,
    };

    setSaving(true);
    setProblem(null);

    // A new plan goes to the parea's vote; the database makes it when it passes.
    if (!event) {
      try {
        const status = await proposePlan(targetGroup!, input);
        setSent({ groupId: targetGroup!, status });
        await onSaved();
      } catch (problem) {
        setProblem({ at: 'form', text: errorText(problem, 'Could not put it to the vote. Try again.') });
      } finally {
        setSaving(false);
      }
      return;
    }

    try {
      await updateEvent(event.id, input);
      await onSaved();
      onClose();
    } catch {
      setProblem({ at: 'form', text: 'Could not save the changes. Try again.' });
    } finally {
      setSaving(false);
    }
  }

  // After New plan: it went to the vote (or, in a parea of one, it is on).
  function renderSent() {
    const name = sentGroup?.name ?? 'your parea';
    const passed = sent?.status === 'passed';
    return (
      <View style={styles.sent} accessibilityLiveRegion="polite">
        <View style={styles.sentIcon}>
          <Ionicons name={passed ? 'checkmark' : 'people-outline'} size={26} color={colors.success} />
        </View>
        <Text style={styles.sentTitle}>{passed ? "It's on" : `Sent to ${name}`}</Text>
        <Text style={styles.sentBody}>
          {passed
            ? `${name} said yes, so "${title.trim()}" is on your plans now.`
            : `"${title.trim()}" is up for a vote in ${name}. It's on when ${needed} of ${deciding} say yes. Your yes is in.`}
        </Text>
      </View>
    );
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={function () {
        if (!saving) onClose();
      }}
    >
      {/* On iOS the keyboard would cover the fields; the sheet rises above it. */}
      <KeyboardAvoidingView style={styles.keyboard} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable
          style={styles.backdrop}
          onPress={function () {
            if (!saving) onClose();
          }}
        >
          <Pressable style={styles.sheet} onPress={() => {}}>
            <View style={styles.head}>
              <View style={styles.grab} />
              <View style={styles.topRow}>
                <Pressable
                  onPress={onClose}
                  disabled={saving}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel="Cancel"
                >
                  <Text style={styles.cancel}>Cancel</Text>
                </Pressable>

                <Text style={styles.sheetTitle}>{editing ? 'Edit plan' : sent ? 'Plan sent' : 'New plan'}</Text>

                <Text style={[styles.cancel, styles.ghost]} accessibilityElementsHidden>Cancel</Text>
              </View>
            </View>

            {sent ? renderSent() : (
            <ScrollView
              style={styles.scroll}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={styles.form}
            >
              <AuthField
                label="What"
                value={title}
                onChangeText={(value) => {
                  setTitle(value);
                  if (problem?.at === 'title') setProblem(null);
                }}
                placeholder="Souvlaki then cinema"
                loading={saving}
                error={errorAt('title')}
              />

              {editing ? null : (
                <View>
                  <Label>Parea</Label>
                  <GroupBar
                    groups={groups}
                    activeId={targetGroup}
                    onSelect={setTargetGroup}
                    showAll={false}
                  />
                  {errorAt('group') ? <Text style={fieldStyles.error}>{errorAt('group')}</Text> : null}
                </View>
              )}

              <View>
                <Label>Day</Label>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.days} keyboardShouldPersistTaps="handled">
                  {days.map((day, i) => {
                    const key = dayKeys[i];
                    const on = key === eventDate && !showPicker;
                    const weekday = day.toLocaleDateString('en-US', { weekday: 'short' });
                    return (
                      <Pressable
                        key={key}
                        onPress={() => {
                          setEventDate(key);
                          setOtherDay(false);
                          if (problem?.at === 'date') setProblem(null);
                        }}
                        disabled={saving}
                        accessibilityRole="radio"
                        accessibilityState={{ checked: on, disabled: saving }}
                        accessibilityLabel={i === 0 ? `Today, ${day.toDateString()}` : day.toDateString()}
                        style={({ pressed }) => [styles.day, on && styles.dayOn, pressed && styles.pressed]}
                      >
                        <Text style={[styles.dayWeek, on && styles.dayWeekOn]}>{weekday}</Text>
                        <Text style={[styles.dayNum, on && styles.dayNumOn]}>{day.getDate()}</Text>
                      </Pressable>
                    );
                  })}
                  <Pressable
                    onPress={() => setOtherDay(true)}
                    disabled={saving}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: showPicker, disabled: saving }}
                    accessibilityLabel="Another day"
                    style={({ pressed }) => [styles.day, showPicker && styles.dayOn, pressed && styles.pressed]}
                  >
                    <Ionicons name="calendar-outline" size={18} color={showPicker ? colors.onInk : colors.text} />
                    <Text style={[styles.dayWeek, showPicker && styles.dayWeekOn]}>Other</Text>
                  </Pressable>
                </ScrollView>
                {showPicker ? (
                  <DateField value={eventDate} onChange={setEventDate} style={styles.picker} error={errorAt('date')} />
                ) : errorAt('date') ? (
                  <Text style={[fieldStyles.error, styles.dayError]}>{errorAt('date')}</Text>
                ) : null}
              </View>

              <View style={styles.row}>
                <AuthField
                  label="From"
                  value={startTime}
                  onChangeText={setStartTime}
                  placeholder="20:30"
                  mono
                  loading={saving}
                  style={styles.half}
                />
                <AuthField
                  label="Until"
                  value={endTime}
                  onChangeText={setEndTime}
                  placeholder="Optional"
                  mono
                  loading={saving}
                  style={styles.half}
                />
              </View>

              <View style={styles.section}>
                <PlaceField
                  label="Where"
                  place={place}
                  onChange={(next) => {
                    setPlace(next);
                    if (problem?.at === 'place') setProblem(null);
                  }}
                  loading={saving}
                  error={errorAt('place')}
                />
                <AuthField
                  icon="pricetag-outline"
                  value={nickname}
                  onChangeText={setNickname}
                  placeholder="Give the spot a nickname"
                  loading={saving}
                />
              </View>

              <View>
                <Label>What kind of night</Label>
                <View style={styles.tagRow}>
                  {EVENT_TAGS.map(function (tag) {
                    return (
                      <Chip
                        key={tag}
                        label={tagLabel(tag)}
                        active={tags.includes(tag)}
                        onPress={() => toggleTag(tag)}
                      />
                    );
                  })}
                </View>
              </View>

              <View>
                <Label>Note</Label>
                <TextInput
                  value={description}
                  onChangeText={setDescription}
                  placeholder="Booking a table this time. Bring cash for the split."
                  placeholderTextColor={colors.textFaint}
                  editable={!saving}
                  selectionColor={colors.primary}
                  accessibilityLabel="Note"
                  multiline
                  style={styles.note}
                />
              </View>

              <View style={styles.publicRow}>
                <Ionicons name="globe-outline" size={22} color={colors.textSoft} />
                <View style={styles.publicText}>
                  <Text style={styles.publicTitle}>Open to Squaddict</Text>
                  <Text style={styles.publicBody}>
                    Anyone nearby can find this plan and ask to come, and its photos show up for other pareas after. Off means your parea only.
                  </Text>
                </View>
                <Switch
                  value={isPublic}
                  onValueChange={setIsPublic}
                  disabled={saving}
                  trackColor={{ false: colors.border, true: colors.primary }}
                  thumbColor={colors.surface}
                />
              </View>
            </ScrollView>
            )}

            <View style={styles.actionBar}>
              {sent ? (
                <>
                  <Button title="Done" onPress={onClose} />
                  {sent.status === 'open' && onOpenVotes ? (
                    <Pressable
                      onPress={() => {
                        const groupId = sent.groupId;
                        onClose();
                        onOpenVotes(groupId);
                      }}
                      accessibilityRole="button"
                      accessibilityLabel="See the vote"
                      style={({ pressed }) => [styles.seeVote, pressed && styles.pressed]}
                    >
                      <Text style={styles.seeVoteText}>See the vote</Text>
                    </Pressable>
                  ) : null}
                </>
              ) : (
                <>
                  {problem?.at === 'form' ? <Text style={styles.formError}>{problem.text}</Text> : null}
                  {!editing && chosenGroup ? (
                    <View style={styles.voteNote}>
                      <Ionicons name="people-outline" size={18} color={colors.accentInk} />
                      <Text style={styles.voteNoteText}>
                        {deciding === 1
                          ? `It's just you in ${chosenGroup.name}, so it goes straight on.`
                          : `Goes to ${chosenGroup.name} as a vote. It becomes a plan when ${needed} of ${deciding} say yes.`}
                      </Text>
                    </View>
                  ) : null}
                  <Button
                    title={editing ? 'Save changes' : 'Put it to the parea'}
                    onPress={handleSave}
                    loading={saving}
                  />
                </>
              )}
            </View>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  keyboard: { flex: 1 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: {
    maxHeight: '90%',
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
  },

  head: { paddingHorizontal: 20, paddingTop: space.sm },
  grab: { alignSelf: 'center', width: 40, height: 5, borderRadius: 3, marginBottom: space.sm, backgroundColor: colors.border },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cancel: { color: colors.textSoft, ...typo.medium, fontSize: 15 },
  ghost: { color: 'transparent' },
  sheetTitle: { color: colors.text, ...typo.bold, fontSize: 16 },

  scroll: { flexShrink: 1 },
  form: { gap: 14, paddingHorizontal: 20, paddingTop: space.sm, paddingBottom: space.lg },
  section: { gap: space.sm },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: space.sm },
  half: { flex: 1 },
  label: { marginBottom: 6 },

  // Day chips: the weekday small, the date big in mono; the chosen one blue.
  days: { gap: 6 },
  day: {
    width: 56,
    height: 52,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bg,
  },
  dayOn: { backgroundColor: colors.primary },
  dayWeek: { color: colors.textFaint, ...typo.medium, fontSize: 11.5 },
  dayWeekOn: { color: 'rgba(255,255,255,0.75)' },
  dayNum: { color: colors.text, ...typo.mono, fontWeight: '600', fontSize: 16 },
  dayNumOn: { color: colors.onInk },
  dayError: { marginTop: 6 },
  picker: { marginTop: space.sm },

  note: {
    minHeight: 84,
    padding: space.md,
    borderRadius: radius.md,
    backgroundColor: colors.bg,
    color: colors.text,
    ...typo.medium,
    fontSize: 14,
    lineHeight: 20,
    textAlignVertical: 'top',
  },

  publicRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.md,
    borderRadius: radius.lg,
    backgroundColor: colors.bg,
  },
  publicText: { flex: 1, gap: 3 },
  publicTitle: { color: colors.textStrong, ...typo.semi, fontSize: 15 },
  publicBody: { color: colors.textSoft, ...typo.medium, fontSize: 12.5, lineHeight: 17 },

  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs },

  pressed: { opacity: 0.7 },

  actionBar: {
    paddingHorizontal: 20,
    paddingTop: space.xs,
    paddingBottom: space.xl,
    gap: 14,
  },
  formError: { color: colors.danger, ...typo.medium, fontSize: 13 },
  // The plan is the parea's call, said before you send it.
  voteNote: {
    flexDirection: 'row',
    gap: 9,
    paddingVertical: 11,
    paddingHorizontal: 13,
    borderRadius: 14,
    backgroundColor: colors.accentSoft,
  },
  voteNoteText: { flex: 1, color: colors.accentInk, ...typo.medium, fontSize: 13, lineHeight: 18 },
  seeVote: { alignSelf: 'center', minHeight: 44, justifyContent: 'center', paddingHorizontal: space.md },
  seeVoteText: { color: colors.primary, ...typo.semi, fontSize: textSize.base },

  sent: { alignItems: 'center', gap: space.sm, paddingHorizontal: space.lg, paddingVertical: space.xl },
  sentIcon: {
    width: 56,
    height: 56,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bg,
  },
  sentTitle: { color: colors.text, ...typo.display, fontSize: 21, letterSpacing: -0.3, textAlign: 'center' },
  sentBody: { color: colors.textSoft, ...typo.medium, fontSize: 14.5, lineHeight: 21, textAlign: 'center' },
});
