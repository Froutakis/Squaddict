import { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import type { Group } from '../../services/serviceGroup';
import { createEvent, updateEvent, type MyEvent, type NewEvent } from '../../services/serviceEvents';
import type { Place } from '../../services/servicePlaces';
import { EVENT_TAGS, tagLabel, type EventTag } from '../../lib/tags';
import { colors, font, radius, space } from '../../theme';
import AuthField from '../general/AuthField';
import Button from '../general/Button';
import DateField from '../general/DateField';
import GroupBar from '../general/GroupBar';
import PlaceField from '../general/PlaceField';

type EventFormSheetProps = {
  visible: boolean;
  groups: Group[];
  defaultGroupId: string | null;
  defaultDate: string;
  event?: MyEvent | null;
  onClose: () => void;
  onSaved: () => void | Promise<void>;
};

function placeOf(event?: MyEvent | null): Place | null {
  if (!event?.placeLabel || event.lat === undefined || event.lng === undefined) return null;

  return { label: event.placeLabel, lat: event.lat, lng: event.lng };
}

export default function EventFormSheet({
  visible,
  groups,
  defaultGroupId,
  defaultDate,
  event,
  onClose,
  onSaved,
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
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(
    function () {
      if (!visible) return;

      setTitle(event?.title ?? '');
      setEventDate(event?.date ?? defaultDate);
      setDescription(event?.description ?? '');
      setStartTime(event?.startTime ?? '');
      setEndTime(event?.endTime ?? '');
      setNickname(event?.location ?? '');
      setPlace(placeOf(event));
      setIsPublic(event?.isPublic ?? false);
      setTags(event?.tags ?? []);
      setTargetGroup(defaultGroupId ?? groups[0]?.id ?? null);
      setFormError(null);
    },
    [visible, defaultDate, event?.id],
  );

  const editing = !!event;
  const hadPlace = !!placeOf(event);
  const placeRequired = isPublic || !editing || hadPlace;

  function toggleTag(tag: EventTag) {
    setTags(function (current) {
      return current.includes(tag) ? current.filter((t) => t !== tag) : [...current, tag];
    });
  }

  async function handleSave() {
    if (!title.trim()) { setFormError('Give your event a title.'); return; }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(eventDate)) { setFormError('Use the format YYYY-MM-DD.'); return; }
    if (!editing && !targetGroup) { setFormError('Pick a squad.'); return; }
    if (placeRequired && !place) { setFormError('Pick the spot on the map so people can find it.'); return; }

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
    setFormError(null);

    try {
      if (event) await updateEvent(event.id, input);
      else await createEvent(targetGroup!, input);

      await onSaved();
      onClose();
    } catch {
      setFormError(editing ? 'Could not save the changes. Try again.' : 'Could not create the event. Try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          <Text style={styles.sheetTitle}>{editing ? 'Edit event' : 'Create new event'}</Text>

          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.form}>
            <AuthField
              label="Name"
              icon="airplane"
              value={title}
              onChangeText={setTitle}
              placeholder="Kalamia 2 ora karta"
              loading={saving}
            />

            <View style={styles.row}>
              <DateField label="Date" value={eventDate} onChange={setEventDate} style={styles.dateColumn} />
              <AuthField
                label="Time"
                value={startTime}
                onChangeText={setStartTime}
                placeholder="--:--"
                loading={saving}
                style={styles.timeColumn}
              />
            </View>

            <PlaceField label="Spot" place={place} onChange={setPlace} loading={saving} />

            <AuthField
              label="Call it"
              icon="pricetag-outline"
              value={nickname}
              onChangeText={setNickname}
              placeholder="Stefanos place"
              loading={saving}
            />

            <View style={styles.publicRow}>
              <View style={styles.publicText}>
                <Text style={styles.publicTitle}>Open to everyone</Text>
                <Text style={styles.publicBody}>
                  Shows up in the feed. Anyone nearby can say they are coming.
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

            {isPublic ? (
              <View style={styles.tags}>
                <Text style={styles.label}>What kind of thing is it?</Text>
                <View style={styles.tagRow}>
                  {EVENT_TAGS.map(function (tag) {
                    const active = tags.includes(tag);
                    return (
                      <Pressable
                        key={tag}
                        accessibilityRole="button"
                        accessibilityState={{ selected: active }}
                        accessibilityLabel={tagLabel(tag)}
                        onPress={() => toggleTag(tag)}
                        style={({ pressed }) => [
                          styles.tag,
                          active ? styles.tagActive : styles.tagIdle,
                          pressed && styles.pressed,
                        ]}
                      >
                        <Text style={[styles.tagLabel, active && styles.tagLabelActive]}>
                          {tagLabel(tag)}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            ) : null}

            <GroupBar
              groups={groups}
              activeId={targetGroup}
              onSelect={setTargetGroup}
              showAll={false}
              compact
            />

            {formError ? <Text style={styles.formError}>{formError}</Text> : null}

            <Button title={editing ? 'Save' : 'Create'} onPress={handleSave} loading={saving} />
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: {
    maxHeight: '92%',
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: space.lg,
    gap: space.md,
  },
  sheetTitle: { color: colors.text, fontFamily: font.bold, fontSize: 20 },
  form: { gap: space.md, paddingBottom: space.md },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: space.sm },
  dateColumn: { flex: 2 },
  timeColumn: { flex: 1 },
  label: { color: colors.textStrong, fontFamily: font.semi, fontSize: 15 },
  publicRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.md,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
  },
  publicText: { flex: 1, gap: 3 },
  publicTitle: { color: colors.textStrong, fontFamily: font.semi, fontSize: 15 },
  publicBody: { color: colors.textSoft, fontFamily: font.medium, fontSize: 12.5, lineHeight: 17 },
  tags: { gap: space.sm },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs },
  tag: { height: 32, justifyContent: 'center', paddingHorizontal: 13, borderRadius: radius.pill, borderWidth: 1 },
  tagIdle: { backgroundColor: colors.surface, borderColor: colors.border },
  tagActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  tagLabel: { color: colors.textSoft, fontFamily: font.semi, fontSize: 12.5 },
  tagLabelActive: { color: colors.textOnBrand },
  pressed: { opacity: 0.7 },
  formError: { color: colors.danger, fontFamily: font.medium, fontSize: 13 },
});
