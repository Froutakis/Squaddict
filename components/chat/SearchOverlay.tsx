import { useEffect, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { searchMessages, type SearchHit } from '../../services/serviceGroup';
import { highlightParts, isSearchable, snippet } from './search';
import { layout, paper, paperFont, radius, space } from '../../theme';

/** Πόσο περιμένουμε μετά το τελευταίο πλήκτρο πριν ρωτήσουμε τη βάση. */
const DEBOUNCE_MS = 250;

type SearchOverlayProps = {
  /** Πού ψάχνουμε. */
  groupId: string;
  visible: boolean;
  onClose: () => void;
};

/**
 * Η αναζήτηση μηνυμάτων μιας Παρέας.
 *
 * Κρατά όλη τη δική της κατάσταση — όρο, αποτελέσματα, φόρτωση. Ο γονιός ξέρει
 * μόνο αν είναι ανοιχτή. Έτσι το κλείσιμο καθαρίζει τα πάντα από μόνο του: ο
 * γονιός αλλάζει το `visible`, το component ξεστήνεται, και δεν μένει
 * παλιός όρος να εμφανιστεί την επόμενη φορά που θα ανοίξει.
 */
export default function SearchOverlay({ groupId, visible, onClose }: SearchOverlayProps) {
  const [term, setTerm] = useState('');
  // null = δεν έχει γίνει ακόμα αναζήτηση· [] = έγινε και δεν βρήκε τίποτα.
  const [hits, setHits] = useState<SearchHit[] | null>(null);
  const [searching, setSearching] = useState(false);

  /**
   * Η αναζήτηση, με καθυστέρηση.
   *
   * Χωρίς αυτήν θα έφευγε ένα ερώτημα ανά πλήκτρο, και οι απαντήσεις θα
   * επέστρεφαν με άλλη σειρά από αυτή που στάλθηκαν — το «παρα» θα μπορούσε να
   * απαντηθεί μετά το «παραλ» και να δείξει λάθος αποτελέσματα. Η σημαία
   * `cancelled` κόβει κάθε απάντηση που δεν αφορά πια τον τρέχοντα όρο.
   */
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
      <View style={styles.screen}>
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

        <ScrollView
          style={styles.results}
          contentContainerStyle={styles.resultsInner}
          keyboardShouldPersistTaps="handled"
        >
          {body}
        </ScrollView>
      </View>
    </Modal>
  );
}

/** Ένα αποτέλεσμα — ο όρος τονισμένος μέσα σε ένα απόσπασμα του μηνύματος. */
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
          // Το key είναι ο δείκτης επίτηδες: τα κομμάτια δεν αναδιατάσσονται
          // ποτέ — ξαναφτιάχνονται από την αρχή σε κάθε αλλαγή του όρου.
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
  // Πλήρης οθόνη, όχι φύλλο: τα αποτελέσματα θέλουν ύψος, και στο κινητό το
  // πληκτρολόγιο τρώει το μισό.
  screen: { flex: 1, backgroundColor: paper.bg },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    width: '100%',
    maxWidth: layout.column,
    alignSelf: 'center',
    marginTop: space.xl,
    marginHorizontal: space.md,
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
    fontFamily: paperFont.regular,
    fontSize: 14,
    // Το web βάζει δικό του περίγραμμα στο focus — το σβήνουμε.
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
    fontFamily: paperFont.regular,
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
    fontFamily: paperFont.medium,
    fontSize: 11,
  },
  hitText: { color: paper.ink, fontFamily: paperFont.regular, fontSize: 14, lineHeight: 20 },
  // Τονισμός με φόντο και όχι μόνο με χρώμα γράμματος: διαβάζεται και όταν ο
  // όρος πέφτει πάνω σε σημεία στίξης.
  hitMatch: { backgroundColor: paper.accentSoft, color: paper.accent, fontFamily: paperFont.semi },
});
