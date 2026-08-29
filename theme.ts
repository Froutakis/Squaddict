// ── Squaddict design system ────────────────────────────────────────────
// "Twilight" — μοβ θέμα, από το design του Claude Design (Squaddict Home).
// Παλέτα: παγωμένο λιλά φόντο, βαθύ δαμασκηνί κείμενο, μοβ κύρια ενέργεια,
// κοραλί τόνος μόνο για badges και ειδοποιήσεις.

export const colors = {
  bg: '#FAF8FD',          // φόντο οθόνης (παγωμένο λιλά)
  surface: '#FFFFFF',     // κάρτες, πεδία, φύλλα
  surfaceAlt: '#F3EEF9',  // ήπια εναλλακτική επιφάνεια (κυκλικά κουμπιά, bubbles)

  border: '#E1DAE9',      // περιγράμματα
  borderStrong: '#D2C8DD',// έμφαση / διάστικτα περιγράμματα

  text: '#2D1F2B',        // κύριο κείμενο (βαθύ δαμασκηνί)
  textStrong: '#3A2936',  // ετικέτες, τίτλοι καρτών
  textSoft: '#7A6974',    // δευτερεύον κείμενο
  textFaint: '#9B8F96',   // placeholders, ανενεργά, μέρες εκτός μήνα
  textOnBrand: '#FFFFFF', // κείμενο πάνω στο gradient

  primary: '#7B4C93',     // κύρια ενέργεια (μοβ)
  primaryDark: '#5C3570', // πατημένη κατάσταση / χρώμα σκιάς
  accent: '#E76854',      // κοραλί — unread badges, κουκκίδα ειδοποίησης

  success: '#2E9E78',
  danger: '#C4453B',
};

// Απαλά φόντα για status pills — Going / Maybe / No.
export const tint = {
  success: '#E4F3EC',
  danger: '#FBEBEA',
  neutral: '#F3EEF9',
};

// Το κύριο gradient της μάρκας (λιλά → βαθύ μοβ).
export const brand = ['#A96BC4', '#6E3F87'] as const;

// Παλέτα gradients για avatars — κάθε παρέα/χρήστης παίρνει το δικό της χρώμα.
// Όλα αρκετά κορεσμένα ώστε το λευκό γράμμα από πάνω να διαβάζεται.
export const avatarGradients: readonly (readonly [string, string])[] = [
  ['#A96BC4', '#6E3F87'],
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

// Συμπαγές χρώμα μιας παρέας — για τις κουκκίδες του ημερολογίου, όπου ένα
// gradient σε 5px δεν διαβάζεται. Παίρνουμε το σκούρο άκρο του gradient.
export function solidFor(name: string): string {
  return gradientFor(name)[1];
}

// Σκιές — ενιαίες σε όλο το app, όλες σε μοβ βάση ώστε να δένουν με το φόντο.
export const shadow = {
  card: {
    shadowColor: '#5C3570',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 8,
    elevation: 2,
  },
  button: {
    shadowColor: '#5C3570',
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 4,
  },
  // Απαλή ανύψωση για φυσαλίδες chat και για το header — μόλις που φαίνεται.
  bubble: {
    shadowColor: '#5C3570',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 1,
  },
  hero: {
    shadowColor: '#5C3570',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 18,
    elevation: 6,
  },
};

export const radius = { sm: 10, md: 14, lg: 18, xl: 26, pill: 999 };
export const space = { xxs: 4, xs: 6, sm: 10, md: 16, lg: 24, xl: 32 };

// Μέγιστο πλάτος περιεχομένου. Στο κινητό δεν δεσμεύει· στο web κρατά το chat
// σε στήλη αντί να απλώνεται σε όλη την οθόνη.
export const layout = { column: 720 };

export const font = {
  display: 'Poppins_800ExtraBold',
  bold: 'Poppins_700Bold',
  semi: 'Poppins_600SemiBold',
  medium: 'Poppins_500Medium',
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
};

// ── Chat: "Paper" ──────────────────────────────────────────────────────
// Ξεχωριστή, πιο ήσυχη παλέτα μόνο για την οθόνη των μηνυμάτων: ζεστό κρεμ
// χαρτί, μελανί κείμενο, ένα γήινο κεραμιδί σαν μοναδικός τόνος. Χωρίς
// gradients και χωρίς σκιές — ο διαχωρισμός γίνεται με λεπτές γραμμές.
export const paper = {
  bg: '#FAF9F5',          // φόντο οθόνης (κρεμ χαρτί)
  surface: '#FFFFFF',     // φυσαλίδες των άλλων, κάρτες λίστας
  surfaceAlt: '#F0EEE6',  // ήπια επιφάνεια (πεδίο εισόδου, chips)

  line: '#E8E5DA',        // λεπτές γραμμές / περιγράμματα
  lineSoft: '#F0EDE4',    // διαχωριστικά μέσα σε λίστα

  ink: '#1F1E1D',         // κύριο κείμενο
  inkSoft: '#6B6862',     // δευτερεύον κείμενο
  inkFaint: '#9A968D',    // ώρες, placeholders

  // Δικά μου μηνύματα: συμπαγές μελανί κουτί με κρεμ γράμματα.
  mine: '#262625',
  onMine: '#FAF9F5',

  accent: '#C96442',      // κεραμιδί — κουμπί αποστολής, ενεργές ενδείξεις
  accentSoft: '#F3E7E1',  // απαλό φόντο του τόνου

  // Μήνυμα που δεν στάλθηκε. Πιο βαθύ και πιο ήσυχο από το colors.danger του
  // κύριου θέματος — σε κρεμ χαρτί ένα έντονο κόκκινο ουρλιάζει.
  danger: '#A33A28',
  dangerSoft: '#F7E4E0',
};

// Γραμματοσειρές του chat: Inter για το UI και τα μηνύματα, Source Serif για
// τους τίτλους — ίδια λογική με το claude.ai (grotesque + serif κεφαλίδες).
export const paperFont = {
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semi: 'Inter_600SemiBold',
  serif: 'SourceSerif4_400Regular',
  serifSemi: 'SourceSerif4_600SemiBold',
};
