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
