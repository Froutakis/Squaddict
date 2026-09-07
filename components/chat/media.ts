export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

export const MAX_DIMENSION = 1600;

export const SIGNED_URL_TTL_SECONDS = 60 * 60;

const RENEW_BEFORE_MS = 5 * 60 * 1000;

export type Attachment = {
  path: string;
  type: string;
  width: number;
  height: number;
};

export function attachmentPath(groupId: string, messageId: string): string {
  return groupId + '/' + messageId + '.jpg';
}

export function fitWithin(
  width: number,
  height: number,
  max: number = MAX_DIMENSION,
): { width: number; height: number } {
  const longest = Math.max(width, height);
  if (longest <= max || longest === 0) {
    return { width, height };
  }

  const scale = max / longest;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

export function bubbleSize(
  width: number,
  height: number,
  maxWidth: number,
  maxHeight: number,
): { width: number; height: number } {
  if (width <= 0 || height <= 0) {
    return { width: maxWidth, height: Math.round(maxWidth * 0.75) };
  }

  const scale = Math.min(maxWidth / width, maxHeight / height, 1);
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

export function uploadRejection(bytes: number): string | null {
  if (bytes > MAX_UPLOAD_BYTES) {
    return 'That photo is still larger than 5 MB after compression.';
  }
  return null;
}

export type SignedUrl = { url: string; expiresAt: number };

export type SignedMap = Record<string, SignedUrl>;

export function needsSigning(entry: SignedUrl | undefined, now: number): boolean {
  return entry === undefined || entry.expiresAt - RENEW_BEFORE_MS <= now;
}

export function pathsToSign(paths: string[], signed: SignedMap, now: number): string[] {
  const missing: string[] = [];
  for (const path of paths) {
    if (needsSigning(signed[path], now) && !missing.includes(path)) {
      missing.push(path);
    }
  }
  return missing;
}

export function mergeSigned(previous: SignedMap, fresh: SignedMap): SignedMap {
  const keys = Object.keys(fresh);
  if (keys.length === 0) {
    return previous;
  }

  let changed = false;
  for (const key of keys) {
    if (previous[key]?.url !== fresh[key].url) {
      changed = true;
      break;
    }
  }

  return changed ? { ...previous, ...fresh } : previous;
}

export function previewText(content: string, hasPhoto: boolean): string {
  if (!hasPhoto) {
    return content;
  }
  return content.trim().length > 0 ? '📷 ' + content : '📷 Photo';
}
