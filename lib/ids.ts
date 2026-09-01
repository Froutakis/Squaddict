import * as Crypto from 'expo-crypto';

export function newMessageId(): string {
  return Crypto.randomUUID();
}
