// ── Squaddict design system ────────────────────────────────────────────
// "Warm daylight" — ζεστό ανοιχτό θέμα, βασισμένο στην οθόνη σύνδεσης.
// Παλέτα: κρεμ φόντο, βαθύ δαμασκηνί κείμενο, ροζέ κύρια ενέργεια, κοραλί τόνος.

export const colors = {
  bg: '#FFF8F4',          // φόντο σελίδας (ζεστό κρεμ)
  surface: '#FFFFFF',     // κάρτες, πεδία, φύλλα
  surfaceAlt: '#FDF3EE',  // ήπια εναλλακτική επιφάνεια

  border: '#E2D5D9',      // περιγράμματα
  borderStrong: '#D6C4CA',

  text: '#2D1F2B',        // κύριο κείμενο (βαθύ δαμασκηνί)
  textStrong: '#3A2936',  // ετικέτες
  textSoft: '#7A6974',    // δευτερεύον κείμενο
  textFaint: '#9B8F96',   // placeholders / hints

  primary: '#A33D57',     // κύρια ενέργεια (ροζέ)
  primaryDark: '#7A233C', // σκιά κουμπιού
  accent: '#E76854',      // τόνος (κοραλί)

  success: '#2E9E78',
  danger: '#C4453B',
};

// Το κύριο gradient της μάρκας (κοραλί → ροζέ).
export const brand = ['#E76854', '#A33D57'] as const;

// Παλέτα gradients για avatars — κάθε παρέα/χρήστης παίρνει το δικό της χρώμα.
// Όλα αρκετά κορεσμένα ώστε το λευκό γράμμα από πάνω να διαβάζεται.
export const avatarGradients: readonly (readonly [string, string])[] = [
  ['#E76854', '#A33D57'],
  ['#F0916A', '#E76854'],
  ['#7A9E7E', '#4E7A63'],
  ['#6D8FB8', '#48678F'],
  ['#B08BBF', '#7A5C8A'],
  ['#E0A458', '#C97B3C'],
  ['#5FA8A0', '#3B7B76'],
];

export function gradientFor(name: string): readonly [string, string] {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return avatarGradients[h % avatarGradients.length];
}

// Σκιά καρτών/κουμπιών — ενιαία σε όλο το app.
export const shadow = {
  card: {
    shadowColor: '#7A233C',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  button: {
    shadowColor: '#7A233C',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 4,
  },
};

export const radius = { sm: 10, md: 14, lg: 18, xl: 26, pill: 999 };
export const space = { xs: 6, sm: 10, md: 16, lg: 24, xl: 32 };

export const font = {
  display: 'Poppins_800ExtraBold',
  bold: 'Poppins_700Bold',
  semi: 'Poppins_600SemiBold',
  medium: 'Poppins_500Medium',
};
