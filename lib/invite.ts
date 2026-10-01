import { INVITE_URL } from './config';

// Invite codes are ten characters, 0-9 and A-F (new_invite_code in schema.sql).
const CODE = /^[0-9A-F]{10}$/;
const LINK = /join\/([0-9a-zA-Z]{6,16})/;

export const INVITE_SCHEME_URL = 'squaddict://join';

// What goes out when someone taps Invite: the app link, and the web one for
// people who don't have the app yet.
export function inviteMessage(squadName: string, code: string): string {
  return `Join ${squadName} on Squaddict: ${INVITE_SCHEME_URL}/${code}\nNo app yet? ${INVITE_URL}/${code}`;
}

// The code inside an invite link (squaddict://join/CODE or https://…/join/CODE),
// or a bare code on its own. Null for anything else.
export function inviteCodeFrom(text: string | null | undefined): string | null {
  if (!text) return null;
  const trimmed = text.trim();

  const link = trimmed.match(LINK);
  if (link) return link[1].toUpperCase();

  const bare = trimmed.toUpperCase();
  return CODE.test(bare) ? bare : null;
}
