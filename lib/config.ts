import Constants from 'expo-constants';

// Placeholder: change this one line when the real support address exists.
export const SUPPORT_EMAIL = 'hello@squaddict.app';

// Where the privacy policy lives on the web (public/privacy.html on Netlify).
// The stores ask for this URL.
export const PRIVACY_URL = 'https://squaddict.netlify.app/privacy.html';

// The web app: where the links in Squaddict's emails (confirm your email,
// reset your password) bring people back to. Add it to Supabase's Redirect URLs.
export const WEB_URL = 'https://squaddict.netlify.app';

// Terms of use, next to the privacy policy (public/terms.html on Netlify).
export const TERMS_URL = 'https://squaddict.netlify.app/terms.html';

// Where invite links open for people without the app (Netlify serves the web app).
export const INVITE_URL = 'https://squaddict.netlify.app/join';

export const APP_VERSION = Constants.expoConfig?.version ?? '1.0.0';
