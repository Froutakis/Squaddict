import { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Group } from '../../models/main';
import { createEvent, updateEvent, type MyEvent } from '../../services/serviceEvents';
import { colors, font, radius, space } from '../../theme';
import AuthField from '../general/AuthField';
import Button from '../general/Button';

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
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    setTitle(event?.title ?? '');
    setEventDate(event?.date ?? defaultDate);
    setFormError(null);
  }, [visible, defaultDate, event?.id]);

  const editing = !!event;

  async function handleSave() {
    const groupId = defaultGroupId ?? groups[0]?.id;

    if (!title.trim()) { setFormError('Give your event a title.'); return; }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(eventDate)) { setFormError('Use the format YYYY-MM-DD.'); return; }
    if (!event && !groupId) { setFormError('Join a squad first.'); return; }

    setSaving(true);
    setFormError(null);
    try {
      if (event) await updateEvent(event.id, { title: title.trim(), date: eventDate });
      else await createEvent(groupId!, { title: title.trim(), date: eventDate });

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
            <AuthField
              label='Date'
              icon='calendar-outline'
              value={eventDate}
              onChangeText={setEventDate}
              placeholder="YYYY-MM-DD"
              loading={saving}
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
  sheetTitle: { color: colors.text, fontFamily: font.bold, fontSize: 20 },
  form: { gap: space.md },
  formError: { color: colors.danger, fontFamily: font.medium, fontSize: 13 },
});
