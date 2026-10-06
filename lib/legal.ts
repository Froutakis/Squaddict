import { SUPPORT_EMAIL } from './config';

// The privacy policy, shown in the app and mirrored in public/privacy.html.
// Keep the two in step when this changes.
export const PRIVACY_UPDATED = '28 September 2026';

export const PRIVACY_SECTIONS: { title: string; body: string }[] = [
  {
    title: 'What Squaddict is',
    body:
      'Squaddict helps groups of friends ("pareas") plan nights out, chat, and keep the photos from those nights together.',
  },
  {
    title: 'What we keep',
    body:
      'Your email and password (to sign you in), your name and profile photo, the pareas you are in, the plans you make or answer, your chat messages and reactions, and the photos you add to a night. If you allow notifications, we keep a push token so we can reach this device.',
  },
  {
    title: 'Who sees it',
    body:
      'Only the members of a parea see its chat, plans and photos. Public plans, and photos you choose to show in Explore, can be seen by anyone signed in to Squaddict. You can hide a photo from Explore again at any time.',
  },
  {
    title: 'Your location',
    body:
      'We use your location to show plans near you and, while a plan you are in is happening, to show your friends where you are. Live positions are passed on while the app is open and are never stored.',
  },
  {
    title: 'Where it lives',
    body:
      'Your data is stored with Supabase, and notifications are delivered through Expo and Apple or Google. We do not sell your data or show you ads.',
  },
  {
    title: 'Deleting your account',
    body:
      'You can delete your account from You → Settings → Delete account. Your login, profile photo, photos, answers and memberships are removed. Messages you sent stay in your friends\' chats under the name "Deleted user".',
  },
  {
    title: 'Contact',
    body: `Questions or requests about your data: ${SUPPORT_EMAIL}`,
  },
];

// The terms of use, shown in the app and mirrored in public/terms.html.
// Keep the two in step when this changes.
export const TERMS_UPDATED = '6 October 2026';

export const TERMS_SECTIONS: { title: string; body: string }[] = [
  {
    title: 'Who can use Squaddict',
    body:
      'You need to be at least 15 years old. One account per person, with your real name or the name your friends know you by.',
  },
  {
    title: 'Your account',
    body:
      'Keep your password to yourself. You are responsible for what happens on your account. If you think someone else got in, change your password from the sign-in screen.',
  },
  {
    title: 'What you share',
    body:
      'Your messages, plans and photos stay yours. By sharing them you let Squaddict store them and show them to the people you shared them with: your parea, or everyone signed in for public plans and photos you show in Explore.',
  },
  {
    title: 'No tolerance for abuse',
    body:
      'No harassment, threats, hate, nudity or sexual content, violence, spam, or anything illegal. Only share photos you took or have the right to share, and never photos of people who did not agree to it. We remove content that breaks these rules and close the accounts that post it.',
  },
  {
    title: 'Report and block',
    body:
      'Long-press a message, or use the menu on a photo, plan or parea, to report it or to block its author. We review every report within 24 hours. Blocking hides that person\'s messages and photos from you straight away.',
  },
  {
    title: 'Public plans and Explore',
    body:
      'A public plan, and a photo you show in Explore, can be seen by anyone signed in to Squaddict. Meeting people from a public plan is your own choice: meet in public places and look after each other.',
  },
  {
    title: 'Ending',
    body:
      'You can delete your account at any time from You, Settings, Delete account. We may suspend accounts that break these terms.',
  },
  {
    title: 'The app as it is',
    body:
      'Squaddict is provided as it is, without guarantees that it will always be available or free of errors. As far as the law allows, we are not liable for what happens at plans made through the app.',
  },
  {
    title: 'Changes',
    body:
      'If these terms change, the app will tell you. Using Squaddict after a change means you accept the new terms.',
  },
  {
    title: 'Contact',
    body: `Questions, or something to report by email: ${SUPPORT_EMAIL}`,
  },
];
