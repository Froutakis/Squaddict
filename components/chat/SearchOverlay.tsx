import { useEffect, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { searchMessages, type SearchHit } from '../../services/serviceChat';
import { highlightParts, isSearchable, snippet } from './search';
import { FAB_CENTER_Y } from '../general/MenuFab';
import { layout, paper, typo, radius, space } from '../../theme';

const DEBOUNCE_MS = 250;

type SearchOverlayProps = {
  groupId: string;
  visible: boolean;
  onClose: () => void;
};

export default function SearchOverlay({ groupId, visible, onClose }: SearchOverlayProps) {
  const [term, setTerm] = useState('');
  const [hits, setHits] = useState<SearchHit[] | null>(null);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    if (!visible) {
      return;
    }

    if (!isSearchable(term)) {
      setHits(null);
      setSearching(false);
      return;
    }

    let cancelled = false;
    setSearching(true);

    const timer = setTimeout(async function run() {
      try {
        const found = await searchMessages(groupId, term);
        if (!cancelled) setHits(found);
      } catch {
        if (!cancelled) setHits([]);
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, DEBOUNCE_MS);

    return function cleanup() {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [visible, term, groupId]);

  if (!visible) {
    return null;
  }

  let body;
  if (!isSearchable(term)) {
    body = <Text style={styles.note}>Type at least two characters.</Text>;
  } else if (searching && hits === null) {
    body = <ActivityIndicator style={styles.spinner} color={paper.accent} />;
  } else if (hits && hits.length === 0) {
    body = <Text style={styles.note}>Nothing found for "{term.trim()}".</Text>;
  } else if (hits) {
    body = hits.map(function (hit) {
      return <Hit key={hit.id} hit={hit} term={term} />;
    });
  }

  return (
    <Modal transparent visible animationType="fade" onRequestClose={onClose}>
      {/* Clear of the notch and the status bar on an iPhone. */}
      <SafeAreaView style={styles.screen}>
        {/* The chat's header: the white button where the menu button is, here
            to close the search, and the field beside it. */}
        <View style={styles.barWrap}>
          <Pressable
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Close search, back to the chat"
            hitSlop={4}
            style={({ pressed }) => [styles.back, pressed && styles.backPressed]}
          >
            <Ionicons name="chevron-back" size={22} color={paper.ink} />
          </Pressable>
          <View style={[styles.bar, term.length === 0 && styles.barEmpty]}>
            <Ionicons name="search" size={18} color={paper.inkSoft} />
            <TextInput
              style={styles.input}
              value={term}
              onChangeText={setTerm}
              placeholder="Search this chat"
              placeholderTextColor={paper.inkSoft}
              autoCorrect={false}
              autoFocus
              accessibilityLabel="Search messages"
            />
            {term.length > 0 ? (
              <Pressable
                onPress={function () {
                  setTerm('');
                }}
                accessibilityRole="button"
                accessibilityLabel="Clear search"
                style={styles.clear}
              >
                <Ionicons name="close-circle" size={18} color={paper.inkSoft} />
              </Pressable>
            ) : null}
          </View>
        </View>

        <ScrollView
          style={styles.results}
          contentContainerStyle={styles.resultsInner}
          keyboardShouldPersistTaps="handled"
        >
          {body}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

function Hit({ hit, term }: { hit: SearchHit; term: string }) {
  const text = snippet(hit.content, term);
  const who = hit.senderName || 'Someone';
  const when = new Date(hit.createdAt).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
  });

  return (
    <View style={styles.hit}>
      <Text style={styles.hitWho}>
        {who} · {when}
      </Text>
      <Text style={styles.hitText}>
        {highlightParts(text, term).map(function (part, index) {
          return (
            <Text key={index} style={part.match ? styles.hitMatch : undefined}>
              {part.text}
            </Text>
          );
        })}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: paper.bg },
  // The side gaps live on a wrapper: a 100% wide bar with margins ran into the screen's edges.
  barWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingTop: FAB_CENTER_Y - 22,
    paddingLeft: space.md,
    paddingRight: space.sm + 2,
  },
  back: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: paper.line,
    backgroundColor: paper.surface,
    shadowColor: paper.ink,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 4,
  },
  backPressed: { opacity: 0.7, transform: [{ scale: 0.96 }] },
  bar: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    maxWidth: layout.column,
    paddingLeft: 14,
    height: 44,
    backgroundColor: paper.surface,
    borderWidth: 1,
    borderColor: paper.line,
    borderRadius: radius.pill,
  },
  input: {
    flex: 1,
    minWidth: 0,
    color: paper.ink,
    ...typo.regular,
    fontSize: 16,
    outlineStyle: 'none',
  } as any,
  barEmpty: { paddingRight: 14 },
  clear: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  results: { flex: 1 },
  resultsInner: {
    width: '100%',
    maxWidth: layout.column,
    alignSelf: 'center',
    paddingHorizontal: space.md,
    paddingTop: space.md,
    paddingBottom: space.xl,
  },
  note: {
    paddingTop: space.lg,
    color: paper.inkSoft,
    ...typo.regular,
    fontSize: 13,
    textAlign: 'center',
  },
  spinner: { paddingTop: space.lg },

  hit: {
    paddingVertical: space.sm,
    borderBottomWidth: 1,
    borderBottomColor: paper.lineSoft,
  },
  hitWho: {
    marginBottom: 3,
    color: paper.inkFaint,
    ...typo.medium,
    fontSize: 11,
  },
  hitText: { color: paper.ink, ...typo.regular, fontSize: 14, lineHeight: 20 },
  hitMatch: { backgroundColor: paper.accentSoft, color: paper.accent, ...typo.semi },
});
