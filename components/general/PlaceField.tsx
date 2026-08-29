import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { reversePlace, searchPlaces, type Place } from '../../services/servicePlaces';
import { getCurrentCoords } from '../../services/serviceLocation';
import { colors, font, radius, space } from '../../theme';

type PlaceFieldProps = {
  label: string;
  place: Place | null;
  onChange: (place: Place | null) => void;
  loading?: boolean;
  error?: string;
};

const DEBOUNCE_MS = 500;

const SEARCH_FAILED = 'Could not reach the map service. Try again.';
const PERMISSION_OFF = 'Location is off for Parea. Turn it on in Settings, or search for the spot.';
const NO_FIX = 'Could not work out where you are. Search for the spot instead.';
const NO_NAME = 'Could not name that spot. Search for it instead.';

export default function PlaceField({ label, place, onChange, loading = false, error }: PlaceFieldProps) {
  const [query, setQuery] = useState(place?.label ?? '');
  const [results, setResults] = useState<Place[]>([]);
  const [searching, setSearching] = useState(false);
  const [locating, setLocating] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [focused, setFocused] = useState(false);

  const dirty = useRef(false);

  useEffect(
    function () {
      if (dirty.current) return;

      setQuery(place?.label ?? '');
    },
    [place],
  );

  useEffect(
    function () {
      if (!dirty.current) return;
      if (place && query === place.label) return;

      const trimmed = query.trim();
      if (trimmed.length < 3) {
        setResults([]);
        setSearching(false);
        return;
      }

      const controller = new AbortController();
      setSearching(true);
      setProblem(null);

      const timer = setTimeout(function () {
        searchPlaces(trimmed, controller.signal)
          .then(function (found) {
            setResults(found);
            setSearching(false);
          })
          .catch(function (e) {
            if (e?.name === 'AbortError') return;
            setProblem(SEARCH_FAILED);
            setSearching(false);
          });
      }, DEBOUNCE_MS);

      return function () {
        clearTimeout(timer);
        controller.abort();
      };
    },
    [query, place],
  );

  function handleChange(text: string) {
    dirty.current = true;
    setQuery(text);
    if (place) onChange(null);
  }

  function handlePick(found: Place) {
    dirty.current = false;
    setQuery(found.label);
    setResults([]);
    setProblem(null);
    onChange(found);
  }

  async function handleUseMyLocation() {
    setLocating(true);
    setProblem(null);

    const position = await getCurrentCoords();

    if (!position.ok) {
      setLocating(false);
      setProblem(position.reason === 'denied' ? PERMISSION_OFF : NO_FIX);
      return;
    }

    try {
      const found = await reversePlace(position.coords);
      setLocating(false);

      if (!found) {
        setProblem(NO_NAME);
        return;
      }

      handlePick(found);
    } catch {
      setLocating(false);
      setProblem(SEARCH_FAILED);
    }
  }

  const showResults = focused && results.length > 0 && !place;

  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>

      <View style={[styles.inputBox, focused && styles.focused, !!error && styles.errorBox]}>
        <Ionicons
          name={place ? 'location' : 'location-outline'}
          size={20}
          color={error ? colors.danger : place ? colors.success : focused ? colors.primary : colors.textSoft}
        />
        <TextInput
          accessibilityLabel={label}
          style={styles.input}
          value={query}
          onChangeText={handleChange}
          placeholder="Search for a street, place or area"
          placeholderTextColor={colors.textFaint}
          autoCapitalize="none"
          autoCorrect={false}
          editable={!loading && !locating}
          onFocus={() => setFocused(true)}
          onBlur={() => setTimeout(() => setFocused(false), 150)}
          selectionColor={colors.primary}
        />
        {searching ? <ActivityIndicator size="small" color={colors.primary} /> : null}
        {place ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Clear location"
            hitSlop={10}
            onPress={function () {
              dirty.current = true;
              setQuery('');
              setProblem(null);
              onChange(null);
            }}
          >
            <Ionicons name="close-circle" size={20} color={colors.textFaint} />
          </Pressable>
        ) : null}
      </View>

      {showResults ? (
        <View style={styles.results}>
          <ScrollView keyboardShouldPersistTaps="handled" style={styles.resultsScroll}>
            {results.map(function (found) {
              return (
                <Pressable
                  key={`${found.lat},${found.lng}`}
                  accessibilityRole="button"
                  accessibilityLabel={found.label}
                  onPress={() => handlePick(found)}
                  style={({ pressed }) => [styles.result, pressed && styles.pressed]}
                >
                  <Ionicons name="navigate-outline" size={16} color={colors.textSoft} />
                  <Text style={styles.resultText} numberOfLines={2}>{found.label}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
          <Text style={styles.attribution}>© OpenStreetMap contributors</Text>
        </View>
      ) : null}

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Use my current location"
        accessibilityState={{ disabled: locating || loading }}
        onPress={handleUseMyLocation}
        disabled={locating || loading}
        style={({ pressed }) => [styles.useMine, pressed && styles.useMinePressed]}
      >
        {locating ? (
          <ActivityIndicator size="small" color={colors.primary} />
        ) : (
          <Ionicons name="navigate-circle-outline" size={18} color={colors.primary} />
        )}
        <Text style={styles.useMineText}>
          {locating ? 'Finding you...' : 'Use my current location'}
        </Text>
      </Pressable>

      {problem ? <Text style={styles.error}>{problem}</Text> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: 8 },
  label: { color: colors.textStrong, fontFamily: font.semi, fontSize: 15 },
  inputBox: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: space.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  input: { flex: 1, minHeight: 54, color: colors.text, fontFamily: font.medium, fontSize: 16 },
  focused: { borderColor: colors.primary },
  errorBox: { borderColor: colors.danger },
  results: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  resultsScroll: { maxHeight: 190 },
  result: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingVertical: space.sm,
    paddingHorizontal: space.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  resultText: { flex: 1, color: colors.text, fontFamily: font.medium, fontSize: 14 },
  pressed: { backgroundColor: colors.surfaceAlt },
  attribution: {
    color: colors.textFaint,
    fontFamily: font.medium,
    fontSize: 10,
    paddingVertical: 5,
    paddingHorizontal: space.md,
  },
  useMine: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', paddingVertical: 2 },
  useMinePressed: { opacity: 0.6 },
  useMineText: { color: colors.primary, fontFamily: font.semi, fontSize: 13 },
  error: { color: colors.danger, fontFamily: font.medium, fontSize: 13 },
});
