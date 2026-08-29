# Locations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make a Parea event carry a real, verified point on the map — pickable, readable, and openable in a maps app — so the discovery feed has something trustworthy to search on.

**Architecture:** Coordinates are the truth (`lat`/`lng`), `place_label` is the human name that came with them, and `location` stays the nickname the squad uses. Nothing derives a location from free text at read time. Two thin services wrap the outside world: `servicePlaces` talks to Nominatim (text ↔ coordinates), `serviceLocation` talks to the device (permission + current position). Every screen reads a place through one helper, `placeLines`.

**Tech Stack:** React Native 0.81 / Expo 54, TypeScript, Supabase, `expo-location` ~19.0.8, Nominatim (OpenStreetMap) over plain `fetch`.

## Global Constraints

- No comments in code. Explanations go in the commit message or the chat.
- Files are CRLF. String-replacement tooling must normalise before matching.
- There is no test runner in this repo. Verification is `npx tsc --noEmit`, throwaway `tsx` scripts under `debug/` (gitignored), and named manual checks on a device.
- Nominatim usage policy: identify with a real contact address, at most 1 request/second, and display "© OpenStreetMap contributors" wherever results are shown.
- All user-facing copy is English, matching the existing screens.
- `place_label`, `lat`, `lng` are only mandatory for public events — the database constraint `events_public_needs_place` enforces exactly that, and must not be widened.

---

## Already done — do not redo

These landed in commit `8cfb832` and the follow-up working-tree changes. Read them before starting; every task below builds on them.

| What | Where |
|---|---|
| `lat`, `lng`, `place_label` columns, `events_public_needs_place`, `events_public_geo_idx` | Supabase (applied by hand) |
| Text → coordinates via Nominatim | `services/servicePlaces.ts` |
| Radius search, haversine distance, squad rollup | `services/serviceFeed.ts` |
| Category list | `lib/tags.ts` |
| Display rule (nickname over address) | `lib/place.ts` |
| Coordinates on the event model, non-clobbering writes | `services/serviceEvents.ts` |
| The picker | `components/general/PlaceField.tsx` |
| Picker + nickname + public switch + tags in the form | `components/events/EventFormSheet.tsx` |
| Place shown in list, hero card, and detail sheet | `EventCard.tsx`, `UpNext.tsx`, `EventSheet.tsx` |
| `expo-location@~19.0.8` installed | `package.json` — **imported by nothing yet** |

**Out of scope for this plan:** the feed screen, its cards, filters, and the third tab. Those are a separate plan; this one ends when a location is fully usable inside the existing screens.

---

## File Structure

**Create:**
- `services/serviceLocation.ts` — the only file that touches `expo-location`. Asks permission, returns a position or a reason it could not.
- `lib/maps.ts` — builds a platform-correct maps URL from coordinates. Pure, no imports from `react-native`.
- `debug/test-location.ts` — runs the pure location logic from the terminal. `debug/` is gitignored, so this file is never committed; the `package.json` entry that runs it is.

**Modify:**
- `app.json` — the `expo-location` plugin block and the iOS permission sentence. Without this the permission prompt has no text and the build is rejected.
- `services/servicePlaces.ts` — add `reversePlace`, a real contact address, and a request throttle.
- `components/general/PlaceField.tsx` — a "Use my location" button that fills the field from the device.
- `components/events/EventSheet.tsx` — an "Open in maps" button when the event has coordinates.
- `package.json` — one `scripts` entry for the debug script.

---

## Task 1: Device location behind one service

**Files:**
- Create: `services/serviceLocation.ts`
- Modify: `app.json`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces:
  - `type Coords = { lat: number; lng: number }`
  - `type LocationResult = { ok: true; coords: Coords } | { ok: false; reason: 'denied' | 'unavailable' }`
  - `async function getCurrentCoords(): Promise<LocationResult>`

- [ ] **Step 1: Add the permission strings to `app.json`**

Insert a `plugins` array as a sibling of `"web"`, and the iOS usage string. Without the plugin block, `expo-location` has no permission text on iOS and the app is rejected at review; on Android the prompt appears but the manifest permission is missing in a bare build.

```json
    "ios": {
      "supportsTablet": true,
      "infoPlist": {
        "NSLocationWhenInUseUsageDescription": "Parea uses your location to show you what is happening nearby. It is never stored or shared."
      }
    },
    "plugins": [
      [
        "expo-location",
        {
          "locationWhenInUsePermission": "Parea uses your location to show you what is happening nearby. It is never stored or shared."
        }
      ]
    ],
```

- [ ] **Step 2: Write `services/serviceLocation.ts`**

The service never throws for the ordinary cases. A refused permission is a normal outcome the feed has to render, not an exception.

```ts
import * as Location from 'expo-location';

export type Coords = {
  lat: number;
  lng: number;
};

export type LocationResult =
  | { ok: true; coords: Coords }
  | { ok: false; reason: 'denied' | 'unavailable' };

function toCoords(position: Location.LocationObject): Coords {
  return { lat: position.coords.latitude, lng: position.coords.longitude };
}

export async function getCurrentCoords(): Promise<LocationResult> {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return { ok: false, reason: 'denied' };

    const last = await Location.getLastKnownPositionAsync({ maxAge: 5 * 60 * 1000 });
    if (last) return { ok: true, coords: toCoords(last) };

    const fresh = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });

    return { ok: true, coords: toCoords(fresh) };
  } catch {
    return { ok: false, reason: 'unavailable' };
  }
}
```

`getLastKnownPositionAsync` is tried first because a cached fix returns in milliseconds while a fresh GPS lock can take ten seconds. Five minutes of staleness is irrelevant at a 25 km radius.

- [ ] **Step 3: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: exit code 0, no output.

- [ ] **Step 4: Manual check on a device**

Temporarily add to `App.tsx` inside the existing session `useEffect`:

```ts
import { getCurrentCoords } from './services/serviceLocation';
getCurrentCoords().then((r) => console.log('LOCATION', r));
```

Run `npm start`, open the app, and confirm in the Metro console:
- the OS permission dialog appears with the sentence from Step 1
- accepting logs `LOCATION { ok: true, coords: { lat: ..., lng: ... } }` with plausible numbers
- rejecting logs `LOCATION { ok: false, reason: 'denied' }`

Remove the temporary lines before committing.

- [ ] **Step 5: Commit**

```bash
git add app.json services/serviceLocation.ts
git commit -m "Read the device location behind one service"
```

---

## Task 2: Coordinates back to a name

**Files:**
- Modify: `services/servicePlaces.ts`

**Interfaces:**
- Consumes: `Coords` from Task 1; the existing `Place` type (`{ label, lat, lng }`) and `shortLabel` helper in this file.
- Produces: `async function reversePlace(coords: Coords): Promise<Place | null>`

Task 3 needs this: the device gives numbers, but `place_label` is `not null` for public events, so a position without a name cannot be saved.

- [ ] **Step 1: Add the reverse lookup**

Append to `services/servicePlaces.ts`:

```ts
import type { Coords } from './serviceLocation';

const REVERSE_ENDPOINT = 'https://nominatim.openstreetmap.org/reverse';

export async function reversePlace(coords: Coords): Promise<Place | null> {
  const url =
    `${REVERSE_ENDPOINT}?lat=${coords.lat}&lon=${coords.lng}` +
    `&format=jsonv2&zoom=18&email=${encodeURIComponent(CONTACT)}`;

  const response = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!response.ok) return null;

  const row = await response.json();
  if (!row || row.error) return null;

  const label = shortLabel(row);
  if (!label) return null;

  return { label, lat: coords.lat, lng: coords.lng };
}
```

The returned `lat`/`lng` are the device's, not Nominatim's. The lookup names the point; it must not move it.

`zoom=18` asks for building-level detail. Lower values return the neighbourhood, which is too vague for "where do we meet".

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: exit code 0.

- [ ] **Step 3: Write the debug script**

Create `debug/test-location.ts`. It is gitignored, so it never enters a commit — only the `package.json` entry does:

```ts
import { reversePlace, searchPlaces } from '../services/servicePlaces';

async function main() {
  const found = await searchPlaces('Aristotelous Square Thessaloniki');
  console.log('searchPlaces:', found.length, 'results');
  console.log('  first:', found[0]);

  if (!found[0]) throw new Error('searchPlaces returned nothing');

  const back = await reversePlace({ lat: found[0].lat, lng: found[0].lng });
  console.log('reversePlace:', back);

  if (!back) throw new Error('reversePlace returned null');
  if (back.lat !== found[0].lat) throw new Error('reversePlace moved the point');

  console.log('OK');
}

main()
  .then(() => process.exit(0))
  .catch((e) => { console.error('FAILED:', e.message); process.exit(1); });
```

Add to `package.json` scripts:

```json
    "test-location": "tsx debug/test-location.ts",
```

- [ ] **Step 4: Run it**

Run: `npm run test-location`
Expected: a non-zero result count, a `reversePlace` object whose `label` is a real street or square, and a final `OK`.

If it prints `FAILED: reversePlace returned null`, Nominatim is rate-limiting you — wait a minute and re-run before changing code.

- [ ] **Step 5: Commit**

```bash
git add services/servicePlaces.ts package.json
git commit -m "Turn coordinates back into a place name"
```

---

## Task 3: Use my location

**Files:**
- Modify: `components/general/PlaceField.tsx`

**Interfaces:**
- Consumes: `getCurrentCoords` (Task 1), `reversePlace` (Task 2), the existing `handlePick` and `dirty` ref in this file.
- Produces: no new exports. `PlaceField`'s props are unchanged.

- [ ] **Step 1: Add the state and the handler**

Inside the component, next to the existing state:

```ts
const [locating, setLocating] = useState(false);
```

And a handler beside `handlePick`:

```ts
async function handleUseMyLocation() {
  setLocating(true);
  setFailed(false);

  const result = await getCurrentCoords();

  if (!result.ok) {
    setLocating(false);
    setFailed(true);
    return;
  }

  const found = await reversePlace(result.coords);
  setLocating(false);

  if (!found) {
    setFailed(true);
    return;
  }

  handlePick(found);
}
```

Add the imports:

```ts
import { getCurrentCoords } from '../../services/serviceLocation';
import { reversePlace, searchPlaces, type Place } from '../../services/servicePlaces';
```

- [ ] **Step 2: Add the button under the input**

Place it directly after the closing tag of the `inputBox` view and before the results block, so it stays visible while the suggestion list is open:

```tsx
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Use my current location"
        onPress={handleUseMyLocation}
        disabled={locating || loading}
        style={({ pressed }) => [styles.useMine, pressed && styles.pressed]}
      >
        {locating ? (
          <ActivityIndicator size="small" color={colors.primary} />
        ) : (
          <Ionicons name="navigate-circle-outline" size={17} color={colors.primary} />
        )}
        <Text style={styles.useMineText}>
          {locating ? 'Finding you...' : 'Use my current location'}
        </Text>
      </Pressable>
```

Add the styles:

```ts
  useMine: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 2 },
  useMineText: { color: colors.primary, fontFamily: font.semi, fontSize: 13 },
```

- [ ] **Step 3: Widen the failure message**

The existing message names the map service, which is wrong when the user refused permission. Replace the `failed` line:

```tsx
      {failed ? (
        <Text style={styles.error}>
          Could not work out that location. Search for it instead.
        </Text>
      ) : null}
```

- [ ] **Step 4: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: exit code 0.

- [ ] **Step 5: Manual check**

Run `npm start`, open the create-event sheet, and confirm:
- tapping "Use my current location" shows the spinner, then fills the field with a real street name
- the pin icon turns green, meaning a `Place` with coordinates is held, not just text
- refusing the OS permission shows the failure message and leaves the field usable
- typing over a filled field clears the green pin

- [ ] **Step 6: Commit**

```bash
git add components/general/PlaceField.tsx
git commit -m "Fill the spot from the device location"
```

---

## Task 4: Open in maps

**Files:**
- Create: `lib/maps.ts`
- Modify: `components/events/EventSheet.tsx`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: `function mapsUrl(platform: string, lat: number, lng: number, label?: string): string`

This is the payoff for storing coordinates instead of text: the user taps once and their maps app navigates there.

- [ ] **Step 1: Write `lib/maps.ts`**

```ts
export function mapsUrl(platform: string, lat: number, lng: number, label?: string): string {
  const point = `${lat},${lng}`;
  const name = label ? encodeURIComponent(label) : '';

  if (platform === 'ios') {
    return `http://maps.apple.com/?ll=${point}${name ? `&q=${name}` : ''}`;
  }

  if (platform === 'android') {
    return `geo:${point}?q=${point}${name ? `(${name})` : ''}`;
  }

  return `https://www.google.com/maps/search/?api=1&query=${point}`;
}
```

Three platforms, three schemes. `geo:` on Android opens whichever maps app the user actually uses; `maps.apple.com` on iOS opens Apple Maps but degrades to the web if it is missing; the web branch covers Expo Go on a browser.

The platform is a parameter rather than a `Platform.OS` read inside the function. That keeps this file free of any `react-native` import, which is what lets the debug script in Step 2 run it under plain `tsx` — importing `react-native` from Node fails.

- [ ] **Step 2: Write the debug check**

Append to `debug/test-location.ts`, before the final `console.log('OK')`:

```ts
  const { mapsUrl } = await import('../lib/maps');

  const android = mapsUrl('android', 40.6325, 22.9412, "Stefanos place");
  const ios = mapsUrl('ios', 40.6325, 22.9412, "Stefanos place");
  const web = mapsUrl('web', 40.6325, 22.9412);
  console.log('mapsUrl android:', android);
  console.log('mapsUrl ios:', ios);
  console.log('mapsUrl web:', web);

  if (!android.startsWith('geo:')) throw new Error('android did not get a geo: url');
  if (!ios.includes('maps.apple.com')) throw new Error('ios did not get an apple url');
  if (!web.includes('google.com')) throw new Error('web did not get a google url');
  if (!android.includes('40.6325')) throw new Error('mapsUrl dropped the latitude');
  if (android.includes(' ')) throw new Error('mapsUrl left an unescaped space');
```

- [ ] **Step 3: Run it**

Run: `npm run test-location`
Expected: the `mapsUrl` line prints a URL with the coordinates and no raw spaces, followed by `OK`.

- [ ] **Step 4: Add the button to the detail sheet**

In `components/events/EventSheet.tsx`, add the imports:

```ts
import { Linking, Platform } from 'react-native';
import { mapsUrl } from '../../lib/maps';
```

Then, inside the `body` view and directly above `<RsvpButtons ... />`, add:

```tsx
                {event.lat !== undefined && event.lng !== undefined ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Open in maps"
                    onPress={() => Linking.openURL(mapsUrl(Platform.OS, event.lat!, event.lng!, place.primary))}
                    style={({ pressed }) => [styles.maps, pressed && styles.mapsPressed]}
                  >
                    <Ionicons name="map-outline" size={17} color={colors.primary} />
                    <Text style={styles.mapsText}>Open in maps</Text>
                  </Pressable>
                ) : null}
```

Add the styles:

```ts
  maps: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingVertical: space.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
  },
  mapsPressed: { opacity: 0.7 },
  mapsText: { color: colors.primary, fontFamily: font.semi, fontSize: 14 },
```

The `event.lat !== undefined` guard matters: every event created before this feature has no coordinates, and those sheets must render without the button rather than opening a maps app at the equator.

- [ ] **Step 5: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: exit code 0.

- [ ] **Step 6: Manual check**

Open an event that has a picked spot: the button appears and opens the maps app at the right point, labelled with the nickname. Open an event created before this feature: no button, no crash.

- [ ] **Step 7: Commit**

```bash
git add lib/maps.ts components/events/EventSheet.tsx
git commit -m "Open an event spot in the maps app"
```

---

## Task 5: Meet the Nominatim terms

**Files:**
- Modify: `services/servicePlaces.ts`

**Interfaces:**
- Consumes: the existing `CONTACT` constant and `searchPlaces`/`reversePlace` in this file.
- Produces: no new exports.

Nominatim blocks unidentified clients and clients that exceed one request per second. `PlaceField` debounces typing, but "Use my location" fires a reverse lookup that can land inside that window, and nothing stops two screens from asking at once.

- [ ] **Step 1: Put in a real contact address**

Replace the placeholder:

```ts
const CONTACT = "parea-app@example.com";
```

with an address you actually read. This is not decoration — an unreachable address is grounds for blocking under the usage policy.

- [ ] **Step 2: Add the throttle**

Above `searchPlaces`:

```ts
const MIN_GAP_MS = 1100;

let lastRequest = 0;

async function waitForSlot(): Promise<void> {
  const wait = lastRequest + MIN_GAP_MS - Date.now();
  lastRequest = Date.now() + Math.max(0, wait);

  if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
}
```

Then `await waitForSlot();` as the first line of the request body in both `searchPlaces` (after the length check) and `reversePlace`.

`lastRequest` is set before awaiting, not after, so two calls started in the same tick queue behind each other instead of both seeing a free slot.

- [ ] **Step 3: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: exit code 0.

- [ ] **Step 4: Prove the throttle**

Append to `debug/test-location.ts`, before `console.log('OK')`:

```ts
  const started = Date.now();
  await Promise.all([searchPlaces('Athens'), searchPlaces('Patra'), searchPlaces('Larisa')]);
  const elapsed = Date.now() - started;
  console.log('three searches took', elapsed, 'ms');

  if (elapsed < 2200) throw new Error('throttle did not space the requests');
```

Run: `npm run test-location`
Expected: the elapsed time is at least 2200 ms and the script ends with `OK`.

- [ ] **Step 5: Commit**

```bash
git add services/servicePlaces.ts
git commit -m "Stay inside the Nominatim usage terms"
```

---

## Done when

- A new event cannot be saved without a real point, and the point survives an edit.
- The nickname and the address both appear in the list, the hero card, and the detail sheet.
- "Use my current location" fills the field with a named place in one tap.
- Tapping an event's spot opens the maps app there.
- Events created before this feature still open, edit, and save without a crash.
- `npx tsc --noEmit` exits 0 and `npm run test-location` ends with `OK`.

## Deliberately not done

- **No backfill of old events.** They keep null coordinates and simply never appear in the feed. Guessing coordinates from strings like "Kalamia" would put wrong pins on the map, which is worse than no pin.
- **No background or continuous location.** The position is read once, when asked for, and never stored server-side.
- **No map view.** `react-native-maps` needs a Google Maps key on Android and native configuration; the `geo:`/`maps.apple.com` handoff gives the same result for free.
