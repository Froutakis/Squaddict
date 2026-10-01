import { useEffect, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Image, Modal, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import type { Group } from '../../services/serviceGroup';
import {
  createEvent,
  setEventCover,
  updateEvent,
  type MyEvent,
  type NewEvent,
} from '../../services/serviceEvents';
import {
  pickImage,
  removeEventCover,
  takePhoto,
  uploadEventCover,
  wideImage,
  type PickedImage,
} from '../../services/serviceMedia';
import { messageFor, PhotoSourceSheet, type PhotoSource } from './EventPhotos';
import type { Place } from '../../services/servicePlaces';
import { EVENT_TAGS, tagLabel, type EventTag } from '../../lib/tags';
import { colors, typo, radius, space, textSize } from '../../theme';
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
  onClose: () => void;
  onSaved: () => void | Promise<void>;
};

function placeOf(event?: MyEvent | null): Place | null {
  if (!event?.placeLabel || event.lat === undefined || event.lng === undefined) return null;

  return { label: event.placeLabel, lat: event.lat, lng: event.lng };
}

function Label({ children }: { children: string }) {
  return <Text style={styles.microLabel}>{children}</Text>;
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
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [pendingCover, setPendingCover] = useState<PickedImage | null>(null);
  const [askingCover, setAskingCover] = useState(false);
  const [preparingCover, setPreparingCover] = useState(false);

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
      setCoverUrl(event?.coverUrl ?? null);
      setPendingCover(null);
      setAskingCover(false);
    },
    [visible, defaultDate, event?.id],
  );

  const editing = !!event;
  const hadPlace = !!placeOf(event);
  const placeRequired = isPublic || !editing || hadPlace;

  const coverPreview = pendingCover?.uri ?? coverUrl;

  async function chooseCover(source: PhotoSource) {
    setAskingCover(false);
    setPreparingCover(true);
    setFormError(null);

    try {
      const picked =
        source === 'camera'
          ? await takePhoto({ aspect: [16, 9] })
          : await pickImage({ aspect: [16, 9] });
      if (picked) setPendingCover(await wideImage(picked));
    } catch (problem) {
      setFormError(messageFor(problem));
    } finally {
      setPreparingCover(false);
    }
  }

  function dropCover() {
    setAskingCover(false);
    setPendingCover(null);
    setCoverUrl(null);
  }

  // The event has to exist before its cover can be stored under its id.
  async function saveCover(eventId: string, groupId: string) {
    const before = event?.coverUrl ?? null;
    let after = coverUrl;

    if (pendingCover) after = await uploadEventCover(groupId, eventId, pendingCover);
    if (after !== before) await setEventCover(eventId, after);
    if (before && before !== after) await removeEventCover(before).catch(() => {});
  }

  function toggleTag(tag: EventTag) {
    setTags(function (current) {
      return current.includes(tag) ? current.filter((t) => t !== tag) : [...current, tag];
    });
  }

  async function handleSave() {
    if (!title.trim()) { setFormError('Give your plan a title.'); return; }
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
      const saved = event ? await updateEvent(event.id, input) : await createEvent(targetGroup!, input);

      try {
        await saveCover(saved.id, saved.groupId);
      } catch (problem) {
        console.error('[squaddict] το cover δεν ανέβηκε:', problem);
      }

      await onSaved();
      onClose();
    } catch {
      setFormError(editing ? 'Could not save the changes. Try again.' : 'Could not post the plan. Try again.');
    } finally {
      setSaving(false);
    }
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
      <Pressable
        style={styles.backdrop}
        onPress={function () {
          if (!saving) onClose();
        }}
      >
        <Pressable style={styles.sheet} onPress={() => {}}>
          <View style={styles.head}>
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

              <Text style={styles.sheetTitle}>{editing ? 'Edit plan' : 'New plan'}</Text>

              <Text style={[styles.cancel, styles.ghost]} accessibilityElementsHidden>Cancel</Text>
            </View>
          </View>

          <ScrollView
            style={styles.scroll}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.form}
          >
            <Pressable
              onPress={() => setAskingCover(true)}
              disabled={saving || preparingCover}
              accessibilityRole="button"
              accessibilityLabel={coverPreview ? 'Change the cover photo' : 'Add a cover photo'}
              style={({ pressed }) => [
                styles.cover,
                !coverPreview && styles.coverEmpty,
                pressed && styles.pressed,
              ]}
            >
              {coverPreview ? (
                <>
                  <Image source={{ uri: coverPreview }} style={StyleSheet.absoluteFill} resizeMode="cover" />
                  <LinearGradient
                    colors={['rgba(12,25,38,0)', 'rgba(12,25,38,0.6)']}
                    style={StyleSheet.absoluteFill}
                    pointerEvents="none"
                  />
                  <View style={styles.coverBadge}>
                    <Ionicons name="image-outline" size={14} color="#FFFFFF" />
                    <Text style={styles.coverBadgeText}>Change cover</Text>
                  </View>
                </>
              ) : (
                <>
                  <Ionicons
                    name={preparingCover ? 'hourglass-outline' : 'image-outline'}
                    size={24}
                    color={colors.textSoft}
                  />
                  <Text style={styles.coverTitle}>
                    {preparingCover ? 'Getting it ready…' : 'Add a cover photo'}
                  </Text>
                  <Text style={styles.coverBody}>The spot, the poster, the vibe. It goes behind the ticket.</Text>
                </>
              )}
            </Pressable>

            <View>
              <Label>Calling it</Label>
              <TextInput
                value={title}
                onChangeText={setTitle}
                placeholder=""
                placeholderTextColor={colors.textFaint}
                editable={!saving}
                selectionColor={colors.primary}
                accessibilityLabel="Plan title"
                style={styles.titleInput}
              />
              <View style={styles.underline} />
            </View>

            <View>
              <Label>With which parea</Label>
              <GroupBar
                groups={groups}
                activeId={targetGroup}
                onSelect={setTargetGroup}
                showAll={false}
              />
            </View>

            <View style={styles.section}>
              <Label>When</Label>
              <View style={styles.row}>
                <DateField value={eventDate} onChange={setEventDate} style={styles.dateColumn}/>
                <AuthField
                  value={startTime}
                  onChangeText={setStartTime}
                  placeholder="Start"
                  mono
                  loading={saving}
                  style={styles.timeColumn}
                />
                <AuthField
                  value={endTime}
                  onChangeText={setEndTime}
                  placeholder="End"
                  mono
                  loading={saving}
                  style={styles.timeColumn}
                />
                </View>
            </View>

            <View style={styles.section}>
              <Label>Spot</Label>
              <PlaceField place={place} onChange={setPlace} loading={saving} />
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
                  Anyone nearby can find this plan and ask to come, and its photos show up for other pareas after. Off means your squad only.
                </Text>
              </View>
              <Switch
                value={isPublic}
                onValueChange={setIsPublic}
                disabled={saving}
                trackColor={{ false: colors.border, true: colors.success }}
                thumbColor={colors.surface}
              />
            </View>
          </ScrollView>

          <PhotoSourceSheet
            visible={askingCover}
            title="Cover photo"
            onClose={() => setAskingCover(false)}
            onPick={chooseCover}
            onRemove={coverPreview ? dropCover : undefined}
          />

          <View style={styles.actionBar}>
            {formError ? <Text style={styles.formError}>{formError}</Text> : null}
            <Button
              title={editing ? 'Save changes' : 'Post plan'}
              onPress={handleSave}
              loading={saving}
            />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: {
    maxHeight: '90%',
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
  },

  head: { paddingHorizontal: space.lg, paddingTop: space.lg },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cancel: { color: colors.textSoft, ...typo.medium, fontSize: 15 },
  ghost: { color: 'transparent' },
  sheetTitle: { color: colors.text, ...typo.semi, fontSize: 15 },

  scroll: { flexShrink: 1 },
  form: { gap: space.lg, padding: space.lg },
  section: { gap: space.sm },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: space.sm },
  half: { flex: 1 },
  dateColumn: { flex: 1.6 },
  timeColumn: { flex: 1 },
  microLabel: {
    color: colors.textFaint,
    ...typo.mono,
    fontSize: 10,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    marginBottom: space.xs,
  },

  titleInput: {
    color: colors.text,
    ...typo.display,
    fontSize: textSize.display,
    letterSpacing: -0.6,
    paddingVertical: space.xs,
  },
  underline: { height: 1, backgroundColor: colors.border, marginTop: space.xs },

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

  cover: {
    aspectRatio: 16 / 9,
    borderRadius: radius.lg,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    backgroundColor: colors.bg,
  },
  coverEmpty: {
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.border,
    paddingHorizontal: space.lg,
  },
  coverTitle: { color: colors.text, ...typo.semi, fontSize: textSize.base },
  coverBody: { color: colors.textFaint, ...typo.medium, fontSize: textSize.small, textAlign: 'center' },
  coverBadge: {
    position: 'absolute',
    right: space.sm,
    bottom: space.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: space.sm,
    paddingVertical: 5,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(12,25,38,0.55)',
  },
  coverBadgeText: { color: '#FFFFFF', ...typo.semi, fontSize: textSize.caption },
  pressed: { opacity: 0.7 },

  actionBar: {
    padding: space.lg,
    paddingBottom: space.xl,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: space.sm,
  },
  formError: { color: colors.danger, ...typo.medium, fontSize: 13 },
});
