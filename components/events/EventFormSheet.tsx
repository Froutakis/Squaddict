import { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import type { Group } from '../../services/serviceGroup';
import { createEvent, updateEvent, type MyEvent } from '../../services/serviceEvents';
import { colors, font, radius, space } from '../../theme';
import AuthField from '../general/AuthField';
import Button from '../general/Button';
import DateField from '../general/DateField';
import GroupBar from '../general/GroupBar';
import { requireUser } from '../../services/serviceAuth';

type EventFormSheetProps = {
  visible: boolean;
  groups: Group[];
  defaultGroupId: string | null;
  defaultDate: string;
  event?: MyEvent | null;
  onClose: () => void;
  onSaved: () => void | Promise<void>;
};

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
  const [location, setLocation] = useState('');
  const [targetGroup, setTargetGroup] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    setTitle(event?.title ?? '');
    setEventDate(event?.date ?? defaultDate);
    setFormError(null);
    setTargetGroup(defaultGroupId ?? groups[0]?.id ?? null);
  }, [visible, defaultDate, event?.id]);
  
  const editing = !!event;

  async function handleSave() {
    const groupId = targetGroup;

    if (!title.trim()) { setFormError('Give your event a title.'); return; }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(eventDate)) { setFormError('Use the format YYYY-MM-DD.'); return; }
    if (!event && !groupId) { setFormError('Pick a squad.'); return; }

    setSaving(true);
    setFormError(null);
    try {
      if (event) await updateEvent(event.id, { title: title.trim(), date: eventDate });
      else await createEvent(groupId!, { title: title.trim(), date: eventDate, startTime: startTime, location: location });

      await onSaved();
      onClose();
    }
    catch (e) {
      setFormError(event ? 'Could not save the changes. Try again.' : 'Could not create the event. Try again.');
    }
    finally {
      setSaving(false);
    }
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          <Text style={styles.sheetTitle}>{editing ? 'Edit event' : 'Create new event'}</Text>
          <View style={styles.form}>
            <AuthField
              label='Name'
              icon='airplane'
              value={title}
              onChangeText={setTitle}
              placeholder="Kalamia 2 ora karta"
              loading={saving}
            />
            <View style={styles.sheetRow}>
              <DateField
                label='Date'
                value={eventDate}
                onChange={setEventDate}
                style={styles.dateColumn}
              />
              <AuthField
                label='Time'
                value={startTime}
                onChangeText={setStartTime}
                placeholder="--:--"
                loading={saving}
                style={styles.timeColumn}
              />
            </View>
            <View style={styles.form}>
              <AuthField
                label='Location'
                value={location}
                onChangeText={setLocation}
                placeholder=' '
                loading={saving}
                />
            </View>
            <GroupBar
              groups={groups}
              activeId={targetGroup}
              onSelect={setTargetGroup}
              showAll={false}
              compact
            />

            {formError ? <Text style={styles.formError}>{formError}</Text> : null}
            <Button title={editing ? 'Save' : 'Create'} onPress={handleSave} loading={saving} />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: space.lg,
    gap: space.md,
  },
  sheetRow: { flexDirection: 'row', alignItems: 'flex-start', gap: space.sm },
  dateColumn: { flex: 2 },
  timeColumn: { flex: 1 },
  sheetTitle: { color: colors.text, fontFamily: font.bold, fontSize: 20 },
  form: { gap: space.md },
  formError: { color: colors.danger, fontFamily: font.medium, fontSize: 13 },
});
