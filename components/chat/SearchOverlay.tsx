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
        <View style={styles.barWrap}>
          <View style={styles.bar}>
            <Ionicons name="search" size={16} color={paper.inkFaint} />
            <TextInput
              style={styles.input}
              value={term}
              onChangeText={setTerm}
              placeholder="Search this squad"
              placeholderTextColor={paper.inkFaint}
              autoCorrect={false}
              autoFocus
              accessibilityLabel="Search messages"
            />
            <Pressable
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Close search"
              hitSlop={8}
            >
              <Ionicons name="close" size={18} color={paper.inkSoft} />
            </Pressable>
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
  barWrap: { marginTop: space.xl, paddingHorizontal: space.md },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    width: '100%',
    maxWidth: layout.column,
    alignSelf: 'center',
    paddingHorizontal: 14,
    height: 42,
    backgroundColor: paper.surface,
    borderWidth: 1,
    borderColor: paper.line,
    borderRadius: radius.pill,
  },
  input: {
    flex: 1,
    color: paper.ink,
    ...typo.regular,
    fontSize: 14,
    outlineStyle: 'none',
  } as any,
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
