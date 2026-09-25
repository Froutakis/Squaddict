import type { TextStyle } from 'react-native';

export const colors = {
  bg: '#EDF0F5',
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

  primary: '#2145E6',
  primaryDark: '#16309E',
  accent: '#D5442F',

  success: '#1F7A57',
  danger: '#D5442F',
};

export const sun = '#FFC53D';

export const tint = {
  success: '#E2F1EA',
  danger: '#FBE6E1',
  neutral: '#E4EAF0',
  sun: '#FFF3D6',
};

export const brand = ['#1D3AC0', '#152C8F'] as const;

export const avatarGradients: readonly (readonly [string, string])[] = [
  ['#152C6B', '#152C6B'],
  ['#2145E6', '#2145E6'],
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
  bg: '#EDF0F5',
  surface: '#FFFFFF',
  surfaceAlt: '#E4EAF0',

  line: '#DFE5EE',
  lineSoft: '#EAEFF5',

  ink: '#0C1926',
  inkSoft: '#5A6B7D',
  inkFaint: '#7A8898',

  mine: '#0C1926',
  onMine: '#FFFFFF',

  accent: '#2145E6',
  accentSoft: '#E4EAFD',
  accentOnMine: '#9DB4FF',

  danger: '#D5442F',
  dangerSoft: '#FBE6E1',
};
