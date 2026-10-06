import type { TextStyle } from 'react-native';

export const colors = {
  bg: '#F1F3F7',
  surface: '#FFFFFF',
  surfaceAlt: '#E4EAF0',

  border: '#DFE5EE',
  borderStrong: '#C9D4E1',

  text: '#0C1926',
  textStrong: '#0C1926',
  textSoft: '#5A6B7D',
  textFaint: '#7A8898',
  textOnBrand: '#FFFFFF',

  ink: '#0C1926',
  inkStrong: '#16233A',
  onInk: '#FFFFFF',

  onLight: '#0B1421',
  onLightSoft: '#5A6B7D',

  primary: '#2347DC',
  primaryDark: '#16309E',
  // Blue is the voice: soft fills for chosen-but-quiet things, ink for words on them.
  accentSoft: '#E6EBFC',
  accentInk: '#1A36A8',
  // A sunk fill: inputs, idle chips, soft buttons.
  sunk: '#E7EBF1',
  accent: '#D5442F',

  success: '#1F7A57',
  danger: '#D5442F',
};

export const sun = '#FFC53D';
// Words on the sun, and its soft fill.
export const sunInk = '#7A5800';
export const sunOn = '#3A2A00';

// The plan line: a dashed cobalt rail.
export const rail = 'rgba(35,71,220,0.42)';

export const tint = {
  success: '#E2F1EA',
  danger: '#FBE6E1',
  neutral: '#E4EAF0',
  sun: '#FFF3D6',
};

// A theme colour see-through: alpha(colors.bg, 0.7) → 'rgba(237,240,245,0.7)'.
// For fades and glass, so they stay the page's colour if it ever changes.
export function alpha(hex: string, opacity: number): string {
  const n = parseInt(hex.slice(1, 7), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${opacity})`;
}

// What sits over a photo or under a sheet.
export const scrim = {
  // Behind a bottom sheet.
  sheet: 'rgba(0,0,0,0.45)',
  // The top of a full-screen photo, so its bar stays readable.
  photoTop: 'rgba(0,0,0,0.6)',
  photoClear: 'rgba(0,0,0,0)',
  // The bottom of a photo strip, under its words.
  reel: 'rgba(8,14,24,0.82)',
  reelClear: 'rgba(8,14,24,0)',
  // A dark pill laid over a picture.
  ink: alpha(colors.ink, 0.42),
  inkStrong: alpha(colors.ink, 0.55),
};

// Words and glass laid over a photo.
export const onPhoto = {
  black: '#000000',
  text: '#FFFFFF',
  soft: 'rgba(255,255,255,0.78)',
  faint: 'rgba(255,255,255,0.75)',
  track: 'rgba(255,255,255,0.32)',
  glass: 'rgba(255,255,255,0.16)',
};

// Explore's painted waterfront at dusk.
export const dusk = {
  skyTop: '#2B3A66',
  skyMid: '#7A6A9E',
  skyLow: '#E9A27C',
  horizon: '#F6CFA2',
  seaTop: '#5E6C93',
  seaDeep: '#2E3A5E',
  sun: '#FFE2B0',
  city: '#273356',
  tower: '#1D2848',
};

// The spot of the week: warm, like the sun.
export const spot = {
  ink: '#8A6400',
  tint: '#FFF3D6',
};

export const brand = ['#1D3AC0', '#152C8F'] as const;

export const avatarGradients: readonly (readonly [string, string])[] = [
  ['#152C6B', '#152C6B'],
  ['#2347DC', '#2347DC'],
  ['#3D2C8D', '#3D2C8D'],
  ['#5B21B6', '#5B21B6'],
  ['#9333EA', '#9333EA'],
];

export function gradientFor(name: string): readonly [string, string] {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return avatarGradients[h % avatarGradients.length];
}

export function solidFor(name: string): string {
  return gradientFor(name)[1];
}

export const shadow = {
  card: {
    shadowColor: '#0C1926',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  button: {
    shadowColor: '#0C1926',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 14,
    elevation: 4,
  },
  bubble: {
    shadowColor: '#0C1926',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  hero: {
    shadowColor: '#0C1926',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.22,
    shadowRadius: 22,
    elevation: 6,
  },
};

export const radius = { sm: 10, md: 14, lg: 18, xl: 24, pill: 999 };
export const space = { xxs: 4, xs: 6, sm: 10, md: 16, lg: 24, xl: 32 };

export const layout = { column: 720 };

type TypeRole = 'display' | 'title' | 'bold' | 'semi' | 'medium' | 'regular' | 'mono';

export const typo: Record<TypeRole, TextStyle> = {
  display: { fontWeight: '800' },
  title: { fontWeight: '700' },
  bold: { fontWeight: '700' },
  semi: { fontWeight: '600' },
  medium: { fontWeight: '500' },
  regular: { fontWeight: '400' },
  mono: { fontWeight: '500', fontVariant: ['tabular-nums'] },
};

export const tracking = {
  display: -0.8,
  title: -0.45,
  lead: -0.25,
  body: 0,
  caps: 0.6,
};

export const textSize = {
  micro: 10,
  caption: 11,
  small: 12,
  body: 13,
  base: 14,
  lead: 15,
  heading: 20,
  hero: 26,
  display: 30,
};

export const paper = {
  bg: '#F1F3F7',
  surface: '#FFFFFF',
  surfaceAlt: '#E4EAF0',

  line: '#DFE5EE',
  lineSoft: '#EAEFF5',

  ink: '#0C1926',
  inkSoft: '#5A6B7D',
  inkFaint: '#7A8898',

  // Your own bubbles are the accent blue.
  mine: '#2347DC',
  onMine: '#FFFFFF',

  accent: '#2347DC',
  accentSoft: '#E6EBFC',
  accentInk: '#1A36A8',
  accentOnMine: '#D6DFFF',

  danger: '#D5442F',
  dangerSoft: '#FBE6E1',
};
