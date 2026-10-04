import { useEffect, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { getMemberProfiles, searchGroups, type Group } from '../../services/serviceGroup';
import { getFollowing } from '../../services/serviceFollow';
import { getFeed } from '../../services/serviceFeed';
import { pickImage, removeSquadImage, uploadSquadImage } from '../../services/serviceMedia';
import { getSquadGoingPlans, propose, type VoteKind, type VoteStatus } from '../../services/serviceVotes';
import { errorText, UNIQUE_VIOLATION } from '../../lib/postgres';
import { formatDateTime } from '../../lib/datetime';
import { features } from '../../lib/features';
import type { Person } from '../../lib/people';
import Monogram from '../general/Monogram';
import SheetHeader from '../general/SheetHeader';
import { fieldStyles } from '../../fieldStyles';
import { colors, radius, space, textSize, typo } from '../../theme';

type Step = 'menu' | VoteKind;

// A row to pick in the list steps: a squad, a plan or a member.
type Choice = { id: string; title: string; detail?: string; avatarUrl?: string | null; square?: boolean };

const NAME_MAX = 40;
const QUESTION_MAX = 120;
const OPTION_MAX = 60;
const MIN_OPTIONS = 2;
const MAX_OPTIONS = 4;
const SEARCH_DELAY_MS = 300;

type NewVoteSheetProps = {
  visible: boolean;
  group: Group;
  userId: string;
  onClose: () => void;
  // The vote went in: open, or already decided in a small squad.
  onStarted: (kind: VoteKind, status: VoteStatus) => void;
};

// "What do we decide?": every vote starts here, and only here. One small step
// per kind of decision, then it goes to the parea.
export default function NewVoteSheet({ visible, group, userId, onClose, onStarted }: NewVoteSheetProps) {
  const [step, setStep] = useState<Step>('menu');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Ask the parea.
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState<string[]>(['', '']);
  // Invite, rename.
  const [name, setName] = useState('');
  // The list steps: what there is to pick, and the pick.
  const [query, setQuery] = useState('');
  const [choices, setChoices] = useState<Choice[]>([]);
  const [loadingChoices, setLoadingChoices] = useState(false);
  const [picked, setPicked] = useState<string | null>(null);
  // New photo: uploaded to the squad's folder, then put to the vote.
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const busy = saving || uploading;

  useEffect(() => {
    if (!visible) return;
    setStep('menu');
    resetStep();
  }, [visible]);

  function resetStep() {
    setSaving(false);
    setError(null);
    setQuestion('');
    setOptions(['', '']);
    setName('');
    setQuery('');
    setChoices([]);
    setPicked(null);
  }

  // A photo uploaded but never put to the vote is not left behind.
  function dropPhoto() {
    if (photoUrl) removeSquadImage(photoUrl);
    setPhotoUrl(null);
  }

  function close() {
    if (busy) return;
    dropPhoto();
    onClose();
  }

  function back() {
    if (busy) return;
    dropPhoto();
    resetStep();
    setStep('menu');
  }

  function open(next: Step) {
    resetStep();
    setStep(next);
  }

  // What the list steps show. Searching ones wait for typing to settle.
  useEffect(() => {
    if (!visible) return;
    if (step !== 'follow' && step !== 'unfollow' && step !== 'attend' && step !== 'unattend' && step !== 'remove') return;

    let cancelled = false;
    const wait = step === 'follow' || step === 'attend' ? SEARCH_DELAY_MS : 0;

    const timer = setTimeout(async function () {
      setLoadingChoices(true);
      setError(null);
      try {
        const next = await loadChoices(step, query.trim());
        if (cancelled) return;
        setChoices(next);
        setPicked((current) => (current && next.some((choice) => choice.id === current) ? current : null));
      } catch (problem) {
        if (!cancelled) {
          setChoices([]);
          setError(errorText(problem, 'Could not load the list. Try again.'));
        }
      } finally {
        if (!cancelled) setLoadingChoices(false);
      }
    }, wait);

    return function cleanup() {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [visible, step, query, group.id]);

  async function loadChoices(kind: Step, term: string): Promise<Choice[]> {
    if (kind === 'follow') {
      if (term === '') return [];
      const [found, following] = await Promise.all([searchGroups(term), getFollowing(group.id).catch(() => [])]);
      const followed = new Set(following.map((one) => one.id));
      return found
        .filter((one) => one.id !== group.id && !followed.has(one.id))
        .map((one) => ({ id: one.id, title: one.name, detail: `@${one.handle}`, avatarUrl: one.avatarUrl }));
    }

    if (kind === 'unfollow') {
      const following = await getFollowing(group.id);
      return following.map((one) => ({ id: one.id, title: one.name, detail: `@${one.handle}`, avatarUrl: one.avatarUrl }));
    }

    if (kind === 'attend') {
      const [feed, going] = await Promise.all([
        getFeed(term === '' ? {} : { search: term }),
        getSquadGoingPlans(group.id).catch(() => []),
      ]);
      const already = new Set(going.map((plan) => plan.id));
      return feed.events
        .filter((plan) => plan.groupId !== group.id && !already.has(plan.id))
        .map((plan) => ({
          id: plan.id,
          title: plan.title,
          detail: `${plan.groupName} · ${formatDateTime(plan.date, plan.startTime)}`,
          avatarUrl: plan.coverUrl ?? null,
          square: true,
        }));
    }

    if (kind === 'unattend') {
      const going = await getSquadGoingPlans(group.id);
      return going.map((plan) => ({
        id: plan.id,
        title: plan.title,
        detail: `${plan.groupName} · ${formatDateTime(plan.date, plan.startTime)}`,
        avatarUrl: plan.coverUrl,
        square: true,
      }));
    }

    const people: Person[] = await getMemberProfiles(group.id);
    return people
      .filter((person) => person.id !== userId)
      .map((person) => ({ id: person.id, title: person.name || 'Someone', avatarUrl: person.avatarUrl ?? null }));
  }

  async function choosePhoto() {
    if (busy) return;
    setError(null);

    const image = await pickImage({ square: true });
    if (!image) return;

    setUploading(true);
    try {
      const url = await uploadSquadImage(group.id, 'avatar', image);
      dropPhoto();
      setPhotoUrl(url);
    } catch (problem) {
      setError(errorText(problem, 'Could not upload that photo. Try again.'));
    } finally {
      setUploading(false);
    }
  }

  // What goes to propose() for the current step, or a reason it can't yet.
  function draft(): { target: string | null; payload: Record<string, unknown> | null } | string {
    switch (step) {
      case 'poll': {
        const filled = options.map((option) => option.trim()).filter(Boolean);
        if (question.trim() === '') return 'Write the question.';
        if (filled.length < MIN_OPTIONS) return 'Give at least two choices.';
        return { target: null, payload: { question: question.trim(), options: filled } };
      }
      case 'invite':
        if (name.trim() === '') return 'Write who you want to invite.';
        return { target: null, payload: { name: name.trim() } };
      case 'rename':
        if (name.trim() === '') return 'Write the new name.';
        if (name.trim() === group.name) return 'That is the name already.';
        return { target: null, payload: { name: name.trim() } };
      case 'photo':
        if (!photoUrl) return 'Choose a photo first.';
        return { target: null, payload: { url: photoUrl } };
      case 'memories':
        return { target: null, payload: { public: !group.memoriesPublic } };
      case 'menu':
        return 'Pick what to decide.';
      default:
        if (!picked) return 'Pick one first.';
        return { target: picked, payload: null };
    }
  }

  async function start() {
    if (busy || step === 'menu') return;
    const ready = draft();
    if (typeof ready === 'string') {
      setError(ready);
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const status = await propose(group.id, step, ready.target, ready.payload);
      // The photo now belongs to the vote: keep it.
      setPhotoUrl(null);
      onStarted(step, status);
    } catch (problem) {
      // Two members opening the same vote at once: the second hits the
      // one-open-vote indexes instead of the friendly check in propose().
      const code = (problem as { code?: unknown } | null)?.code;
      setError(
        code === UNIQUE_VIOLATION
          ? 'There is already an open vote on that.'
          : errorText(problem, 'Could not start the vote. Try again.'),
      );
    } finally {
      setSaving(false);
    }
  }

  const menu: { step: Step; icon: keyof typeof Ionicons.glyphMap; title: string; detail: string }[] = [
    { step: 'poll', icon: 'help-circle-outline', title: 'Ask the parea', detail: 'A question with 2 to 4 choices' },
    { step: 'invite', icon: 'person-add-outline', title: 'Invite someone', detail: 'If it passes, you get a link that works once' },
    { step: 'attend', icon: 'calendar-outline', title: 'Go to a plan', detail: "Another parea's public plan" },
    { step: 'unattend', icon: 'calendar-clear-outline', title: 'Skip a plan', detail: 'One your parea said yes to' },
    ...(features.squadFollows
      ? [
          { step: 'follow' as const, icon: 'compass-outline' as const, title: 'Follow a parea', detail: 'See their nights and plans' },
          { step: 'unfollow' as const, icon: 'remove-circle-outline' as const, title: 'Unfollow a parea', detail: 'Stop following them' },
        ]
      : []),
    { step: 'rename', icon: 'text-outline', title: 'Rename', detail: `Now "${group.name}"` },
    { step: 'photo', icon: 'image-outline', title: 'New photo', detail: 'The round photo by the name' },
    {
      step: 'memories',
      icon: group.memoriesPublic ? 'lock-closed-outline' : 'lock-open-outline',
      title: group.memoriesPublic ? 'Make memories private' : 'Make memories public',
      detail: group.memoriesPublic ? 'Only members would see your nights' : 'Anyone who opens the profile would see them',
    },
    { step: 'remove', icon: 'person-remove-outline', title: 'Remove a member', detail: 'They do not vote on it' },
  ];

  const title =
    step === 'menu' ? 'What do we decide?' : menu.find((item) => item.step === step)?.title ?? 'New vote';

  function renderChoices(placeholder: string | null, empty: string) {
    return (
      <>
        {placeholder !== null ? (
          <View style={fieldStyles.box}>
            <Ionicons name="search" size={18} color={colors.textSoft} />
            <TextInput
              style={fieldStyles.input}
              value={query}
              onChangeText={setQuery}
              placeholder={placeholder}
              placeholderTextColor={colors.textFaint}
              autoCorrect={false}
              autoCapitalize="none"
              accessibilityLabel={placeholder}
              editable={!busy}
            />
          </View>
        ) : null}

        {loadingChoices ? (
          <ActivityIndicator color={colors.primary} style={styles.spinner} />
        ) : choices.length === 0 ? (
          <Text style={styles.empty}>{empty}</Text>
        ) : (
          <View style={styles.choices}>
            {choices.map((choice) => {
              const chosen = picked === choice.id;
              return (
                <Pressable
                  key={choice.id}
                  onPress={() => setPicked(choice.id)}
                  disabled={busy}
                  accessibilityRole="radio"
                  accessibilityLabel={[choice.title, choice.detail].filter(Boolean).join(', ')}
                  accessibilityState={{ checked: chosen, disabled: busy }}
                  style={({ pressed }) => [styles.choice, chosen && styles.choiceChosen, pressed && styles.pressed]}
                >
                  {choice.square && choice.avatarUrl ? (
                    <Image source={{ uri: choice.avatarUrl }} style={styles.cover} />
                  ) : (
                    <Monogram name={choice.title} uri={choice.avatarUrl ?? null} size={36} square={choice.square} />
                  )}
                  <View style={styles.choiceText}>
                    <Text style={styles.choiceTitle} numberOfLines={1}>
                      {choice.title}
                    </Text>
                    {choice.detail ? (
                      <Text style={styles.choiceDetail} numberOfLines={1}>
                        {choice.detail}
                      </Text>
                    ) : null}
                  </View>
                  <Ionicons
                    name={chosen ? 'radio-button-on' : 'radio-button-off'}
                    size={22}
                    color={chosen ? colors.primary : colors.textFaint}
                  />
                </Pressable>
              );
            })}
          </View>
        )}
      </>
    );
  }

  function field(label: string, value: string, onChange: (text: string) => void, placeholder: string, max: number) {
    return (
      <View style={fieldStyles.field}>
        <Text style={fieldStyles.label}>{label}</Text>
        <View style={fieldStyles.box}>
          <TextInput
            style={fieldStyles.input}
            value={value}
            onChangeText={onChange}
            placeholder={placeholder}
            placeholderTextColor={colors.textFaint}
            maxLength={max}
            accessibilityLabel={label}
            editable={!busy}
          />
        </View>
      </View>
    );
  }

  function renderStep() {
    switch (step) {
      case 'menu':
        return (
          <View style={styles.choices}>
            {menu.map((item) => (
              <Pressable
                key={item.step}
                onPress={() => open(item.step)}
                accessibilityRole="button"
                accessibilityLabel={item.title}
                accessibilityHint={item.detail}
                style={({ pressed }) => [styles.menuRow, pressed && styles.pressed]}
              >
                <View style={styles.menuIcon}>
                  <Ionicons name={item.icon} size={20} color={colors.text} />
                </View>
                <View style={styles.choiceText}>
                  <Text style={styles.choiceTitle}>{item.title}</Text>
                  <Text style={styles.choiceDetail} numberOfLines={1}>
                    {item.detail}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.textFaint} />
              </Pressable>
            ))}
          </View>
        );

      case 'poll':
        return (
          <>
            {field('Question', question, setQuestion, 'Where do we go on Friday?', QUESTION_MAX)}
            <View style={fieldStyles.field}>
              <Text style={fieldStyles.label}>Choices</Text>
              {options.map((option, index) => (
                <View key={index} style={fieldStyles.box}>
                  <TextInput
                    style={fieldStyles.input}
                    value={option}
                    onChangeText={(text) => setOptions((list) => list.map((one, at) => (at === index ? text : one)))}
                    placeholder={`Choice ${index + 1}`}
                    placeholderTextColor={colors.textFaint}
                    maxLength={OPTION_MAX}
                    accessibilityLabel={`Choice ${index + 1}`}
                    editable={!busy}
                  />
                  {index >= MIN_OPTIONS ? (
                    <Pressable
                      onPress={() => setOptions((list) => list.filter((_, at) => at !== index))}
                      disabled={busy}
                      hitSlop={10}
                      accessibilityRole="button"
                      accessibilityLabel={`Remove choice ${index + 1}`}
                      style={({ pressed }) => [styles.removeChoice, pressed && styles.pressed]}
                    >
                      <Ionicons name="close-circle" size={20} color={colors.textSoft} />
                    </Pressable>
                  ) : null}
                </View>
              ))}
              {options.length < MAX_OPTIONS ? (
                <Pressable
                  onPress={() => setOptions((list) => [...list, ''])}
                  disabled={busy}
                  accessibilityRole="button"
                  accessibilityLabel="Add choice"
                  style={({ pressed }) => [styles.addChoice, pressed && styles.pressed]}
                >
                  <Ionicons name="add" size={18} color={colors.primary} />
                  <Text style={styles.addChoiceText}>Add choice</Text>
                </Pressable>
              ) : null}
            </View>
            <Text style={styles.hint}>
              A choice wins with more than half of the parea. If everyone answers without that, the most votes win.
            </Text>
          </>
        );

      case 'invite':
        return (
          <>
            {field("Friend's name", name, setName, 'Nikos', NAME_MAX)}
            <Text style={styles.hint}>
              If the parea says yes, you get a link to send them. It works once.
            </Text>
          </>
        );

      case 'rename':
        return field('New name', name, setName, group.name, NAME_MAX);

      case 'photo':
        return (
          <View style={styles.photoRow}>
            <Monogram name={group.name} uri={photoUrl ?? group.avatarUrl} size={72} />
            <View style={styles.choiceText}>
              <Text style={styles.hint}>
                {photoUrl ? 'This one goes to the vote.' : 'Pick the photo you want the parea to vote on.'}
              </Text>
              <Pressable
                onPress={choosePhoto}
                disabled={busy}
                accessibilityRole="button"
                accessibilityLabel={photoUrl ? 'Choose another photo' : 'Choose a photo'}
                style={({ pressed }) => [styles.addChoice, pressed && styles.pressed]}
              >
                {uploading ? (
                  <ActivityIndicator color={colors.primary} />
                ) : (
                  <>
                    <Ionicons name="image-outline" size={18} color={colors.primary} />
                    <Text style={styles.addChoiceText}>{photoUrl ? 'Choose another' : 'Choose a photo'}</Text>
                  </>
                )}
              </Pressable>
            </View>
          </View>
        );

      case 'memories':
        return (
          <Text style={styles.body}>
            {group.memoriesPublic
              ? 'Your memories are public now: anyone who opens the profile sees your nights. Ask the parea to make them private?'
              : 'Your memories are private now: only members see your nights. Ask the parea to make them public?'}
          </Text>
        );

      case 'follow':
        return renderChoices('Search pareas', query.trim() === '' ? 'Type a name or @handle.' : 'No parea found.');
      case 'unfollow':
        return renderChoices(null, `${group.name} follows nobody yet.`);
      case 'attend':
        return renderChoices('Search plans', 'No upcoming public plans found.');
      case 'unattend':
        return renderChoices(null, `${group.name} is not going to any plan right now.`);
      case 'remove':
        return renderChoices(null, 'Nobody else is in the parea yet.');
    }
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={step === 'menu' ? close : back}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable style={styles.backdrop} onPress={close}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            <SheetHeader title={title} onClose={close} closeDisabled={busy} grabber />

            {step !== 'menu' ? (
              <Pressable
                onPress={back}
                disabled={busy}
                accessibilityRole="button"
                accessibilityLabel="Back to all decisions"
                style={({ pressed }) => [styles.back, pressed && styles.pressed]}
              >
                <Ionicons name="chevron-back" size={18} color={colors.primary} />
                <Text style={styles.backText}>All decisions</Text>
              </Pressable>
            ) : (
              <Text style={styles.hint}>Every vote passes with more than half of {group.name}.</Text>
            )}

            <ScrollView
              style={styles.scroll}
              contentContainerStyle={styles.content}
              keyboardShouldPersistTaps="handled"
            >
              {renderStep()}
            </ScrollView>

            {error ? (
              <Text style={styles.error} accessibilityLiveRegion="polite">
                {error}
              </Text>
            ) : null}

            {step !== 'menu' ? (
              <Pressable
                onPress={start}
                disabled={busy}
                accessibilityRole="button"
                accessibilityLabel="Start the vote"
                style={({ pressed }) => [styles.start, (pressed || busy) && styles.startPressed]}
              >
                {saving ? <ActivityIndicator color={colors.onInk} /> : <Text style={styles.startText}>Start vote</Text>}
              </Pressable>
            ) : null}
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: {
    maxHeight: '88%',
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingHorizontal: space.lg,
    paddingTop: space.sm,
    paddingBottom: space.xl,
    gap: space.sm,
  },
  scroll: { flexGrow: 0 },
  content: { gap: space.md, paddingBottom: space.xs },
  pressed: { opacity: 0.6 },
  hint: { color: colors.textSoft, ...typo.medium, fontSize: textSize.body },
  body: { color: colors.text, ...typo.medium, fontSize: textSize.base, lineHeight: 20 },
  error: { color: colors.danger, ...typo.medium, fontSize: textSize.body },
  spinner: { marginVertical: space.lg },
  empty: { color: colors.textSoft, ...typo.medium, fontSize: textSize.base, textAlign: 'center', paddingVertical: space.lg },

  back: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 2, minHeight: 44, paddingRight: space.sm },
  backText: { color: colors.primary, ...typo.semi, fontSize: textSize.base },

  menuRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: 56, paddingVertical: space.xxs },
  menuIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceAlt,
  },

  choices: { gap: space.xxs },
  choice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    minHeight: 56,
    paddingHorizontal: space.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  choiceChosen: { borderColor: colors.primary },
  cover: { width: 36, height: 36, borderRadius: radius.sm, backgroundColor: colors.surfaceAlt },
  choiceText: { flex: 1, minWidth: 0, gap: 2 },
  choiceTitle: { color: colors.text, ...typo.semi, fontSize: textSize.base },
  choiceDetail: { color: colors.textSoft, ...typo.medium, fontSize: textSize.small },

  removeChoice: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  addChoice: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: space.xxs,
    minHeight: 44,
    paddingHorizontal: space.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  addChoiceText: { color: colors.primary, ...typo.semi, fontSize: textSize.body },

  photoRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },

  start: {
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    backgroundColor: colors.primary,
  },
  startPressed: { opacity: 0.85 },
  startText: { color: colors.onInk, ...typo.semi, fontSize: 16 },
});
