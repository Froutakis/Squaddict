import type { TextStyle } from 'react-native';

export const colors = {
  bg: '#080E19',
  surface: '#111B2B',
  surfaceAlt: '#1A2739',

  border: 'rgba(150,175,215,0.15)',
  borderStrong: 'rgba(150,175,215,0.27)',

  text: '#E9EFF8',
  textStrong: '#FFFFFF',
  textSoft: '#A3B2C7',
  textFaint: '#7B8BA3',
  textOnBrand: '#FFFFFF',

  ink: '#20304C',
  inkStrong: '#2A3D5E',
  onInk: '#FFFFFF',

  onLight: '#0B1421',
  onLightSoft: '#5A6B7D',

  primary: '#5B84FF',
  primaryDark: '#2145E6',
  accent: '#FF7F63',

  success: '#3DBB8B',
  danger: '#FF6F55',
};

export const sun = '#FFC53D';

export const tint = {
  success: 'rgba(61,187,139,0.16)',
  danger: 'rgba(255,111,85,0.16)',
  neutral: 'rgba(150,175,215,0.12)',
  sun: 'rgba(255,197,61,0.16)',
};

export const brand = ['#2145E6', '#2145E6'] as const;

export const avatarGradients: readonly (readonly [string, string])[] = [
  ['#3557C7', '#3557C7'],
  ['#4C79F5', '#4C79F5'],
  ['#6A4BC4', '#6A4BC4'],
  ['#8B44E0', '#8B44E0'],
  ['#B25BF5', '#B25BF5'],
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
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 14,
    elevation: 2,
  },
  button: {
    shadowColor: '#2145E6',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.28,
    shadowRadius: 18,
    elevation: 4,
  },
  bubble: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.35,
    shadowRadius: 3,
    elevation: 1,
  },
  hero: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.75,
    shadowRadius: 30,
    elevation: 8,
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
  bg: '#080E19',
  surface: '#111B2B',
  surfaceAlt: '#1A2739',

  line: 'rgba(150,175,215,0.15)',
  lineSoft: 'rgba(150,175,215,0.08)',

  ink: '#E9EFF8',
  inkSoft: '#A3B2C7',
  inkFaint: '#7B8BA3',

  mine: '#2B4FC4',
  onMine: '#FFFFFF',

  accent: '#5B84FF',
  accentSoft: 'rgba(91,132,255,0.16)',
  accentOnMine: '#C7D6FF',

  danger: '#FF6F55',
  dangerSoft: 'rgba(255,111,85,0.16)',
};

