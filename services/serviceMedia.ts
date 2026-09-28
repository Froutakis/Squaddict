import { Platform } from "react-native";
import { Directory, File, Paths } from "expo-file-system";
import * as ImageManipulator from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";
import {
  MAX_DIMENSION,
  SIGNED_URL_TTL_SECONDS,
  fitWithin,
  uploadRejection,
  type Attachment,
  type SignedMap,
} from "../components/chat/media";
import { supabase } from "./supabaseClient";

const BUCKET = "chat";
const AVATAR_BUCKET = "avatars";
const AVATAR_SIZE = 512;
const COVER_BUCKET = "event-covers";
const COVER_WIDTH = 1280;
const COVER_ASPECT = 16 / 9;

export type PickedImage = {
  uri: string;
  width: number;
  height: number;
};

export type PickOptions = {
  square?: boolean;
  aspect?: [number, number];
};

function squareEditing(options: PickOptions) {
  if (options.square) return { allowsEditing: true, aspect: [1, 1] as [number, number] };
  if (options.aspect) return { allowsEditing: true, aspect: options.aspect };
  return {};
}

export async function pickImage(options: PickOptions = {}): Promise<PickedImage | null> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    return null;
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    quality: 1,
    allowsMultipleSelection: false,
    ...squareEditing(options),
  });

  if (result.canceled || result.assets.length === 0) {
    return null;
  }

  const asset = result.assets[0];
  return { uri: asset.uri, width: asset.width, height: asset.height };
}

export async function takePhoto(options: PickOptions = {}): Promise<PickedImage | null> {
  const permission = await ImagePicker.requestCameraPermissionsAsync();
  if (!permission.granted) {
    return null;
  }

  const result = await ImagePicker.launchCameraAsync({
    mediaTypes: ["images"],
    quality: 1,
    ...squareEditing(options),
  });

  if (result.canceled || result.assets.length === 0) {
    return null;
  }

  const asset = result.assets[0];
  return { uri: asset.uri, width: asset.width, height: asset.height };
}

export async function prepareImage(picked: PickedImage): Promise<PickedImage> {
  const target = fitWithin(picked.width, picked.height, MAX_DIMENSION);
  const alreadySmall =
    target.width === picked.width && target.height === picked.height;

  try {
    const context = ImageManipulator.ImageManipulator.manipulate(picked.uri);
    if (!alreadySmall) {
      context.resize({ width: target.width, height: target.height });
    }

    const rendered = await context.renderAsync();
    const saved = await rendered.saveAsync({
      format: ImageManipulator.SaveFormat.JPEG,
      compress: 0.8,
    });

    return {
      uri: saved.uri,
      width: saved.width ?? target.width,
      height: saved.height ?? target.height,
    };
  } catch (problem) {
    console.error("[squaddict] η εικόνα δεν διαβάστηκε:", problem);
    throw new Error("That photo could not be read. Try another one.");
  }
}

export async function squareImage(picked: PickedImage, size = AVATAR_SIZE): Promise<PickedImage> {
  const side = Math.min(picked.width, picked.height);
  const final = Math.min(side, size);

  try {
    const context = ImageManipulator.ImageManipulator.manipulate(picked.uri);
    context.crop({
      originX: Math.round((picked.width - side) / 2),
      originY: Math.round((picked.height - side) / 2),
      width: side,
      height: side,
    });
    if (side > size) {
      context.resize({ width: size, height: size });
    }

    const rendered = await context.renderAsync();
    const saved = await rendered.saveAsync({
      format: ImageManipulator.SaveFormat.JPEG,
      compress: 0.85,
    });

    return { uri: saved.uri, width: saved.width ?? final, height: saved.height ?? final };
  } catch (problem) {
    console.error("[squaddict] η εικόνα δεν διαβάστηκε:", problem);
    throw new Error("That photo could not be read. Try another one.");
  }
}

async function readBytes(uri: string): Promise<ArrayBuffer> {
  if (Platform.OS === "web") {
    const response = await fetch(uri);
    return await response.arrayBuffer();
  }
  return await new File(uri).arrayBuffer();
}

export async function uploadImage(
  path: string,
  image: PickedImage,
): Promise<Attachment> {
  const bytes = await readBytes(image.uri);

  const problem = uploadRejection(bytes.byteLength);
  if (problem) {
    throw new Error(problem);
  }

  const { error } = await supabase.storage.from(BUCKET).upload(path, bytes, {
    contentType: "image/jpeg",
    upsert: true,
  });
  if (error) {
    console.error("[squaddict] το ανέβασμα απέρριψε:", {
      path,
      bytes: bytes.byteLength,
      name: (error as any).name,
      message: error.message,
      status: (error as any).status ?? (error as any).statusCode,
    });
    throw error;
  }

  return {
    path,
    type: "image/jpeg",
    width: image.width,
    height: image.height,
  };
}

// Centre crop to 16:9 and cap the width, for event covers.
export async function wideImage(picked: PickedImage): Promise<PickedImage> {
  const tall = picked.width / picked.height < COVER_ASPECT;
  const width = tall ? picked.width : Math.round(picked.height * COVER_ASPECT);
  const height = tall ? Math.round(picked.width / COVER_ASPECT) : picked.height;
  const finalWidth = Math.min(width, COVER_WIDTH);

  try {
    const context = ImageManipulator.ImageManipulator.manipulate(picked.uri);
    context.crop({
      originX: Math.round((picked.width - width) / 2),
      originY: Math.round((picked.height - height) / 2),
      width,
      height,
    });
    if (width > COVER_WIDTH) {
      context.resize({ width: COVER_WIDTH, height: Math.round(COVER_WIDTH / COVER_ASPECT) });
    }

    const rendered = await context.renderAsync();
    const saved = await rendered.saveAsync({
      format: ImageManipulator.SaveFormat.JPEG,
      compress: 0.8,
    });

    return {
      uri: saved.uri,
      width: saved.width ?? finalWidth,
      height: saved.height ?? Math.round(finalWidth / COVER_ASPECT),
    };
  } catch (problem) {
    console.error("[squaddict] η εικόνα δεν διαβάστηκε:", problem);
    throw new Error("That photo could not be read. Try another one.");
  }
}

export async function uploadEventCover(
  groupId: string,
  eventId: string,
  image: PickedImage,
): Promise<string> {
  const bytes = await readBytes(image.uri);
  const path = `${groupId}/${eventId}/${Date.now()}.jpg`;

  const { error } = await supabase.storage.from(COVER_BUCKET).upload(path, bytes, {
    contentType: "image/jpeg",
  });
  if (error) throw error;

  return supabase.storage.from(COVER_BUCKET).getPublicUrl(path).data.publicUrl;
}

export async function removeEventCover(url: string): Promise<void> {
  const marker = `/object/public/${COVER_BUCKET}/`;
  const at = url.indexOf(marker);
  if (at === -1) return;

  const path = decodeURIComponent(url.slice(at + marker.length).split("?")[0]);
  const { error } = await supabase.storage.from(COVER_BUCKET).remove([path]);
  if (error) throw error;
}

export async function uploadAvatar(userId: string, image: PickedImage): Promise<string> {
  const bytes = await readBytes(image.uri);
  const path = `${userId}/${Date.now()}.jpg`;

  const { error } = await supabase.storage.from(AVATAR_BUCKET).upload(path, bytes, {
    contentType: "image/jpeg",
  });
  if (error) throw error;

  return supabase.storage.from(AVATAR_BUCKET).getPublicUrl(path).data.publicUrl;
}

export async function removeAvatar(url: string): Promise<void> {
  const marker = `/object/public/${AVATAR_BUCKET}/`;
  const at = url.indexOf(marker);
  if (at === -1) return;

  const path = decodeURIComponent(url.slice(at + marker.length).split("?")[0]);
  const { error } = await supabase.storage.from(AVATAR_BUCKET).remove([path]);
  if (error) throw error;
}

export async function signImages(paths: string[]): Promise<SignedMap> {
  if (paths.length === 0) {
    return {};
  }

  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrls(paths, SIGNED_URL_TTL_SECONDS);
  if (error) throw error;

  const expiresAt = Date.now() + SIGNED_URL_TTL_SECONDS * 1000;
  const signed: SignedMap = {};
  for (const row of data ?? []) {
    if (row.signedUrl && row.path) {
      signed[row.path] = { url: row.signedUrl, expiresAt };
    }
  }
  return signed;
}

export async function removeImage(path: string): Promise<void> {
  try {
    const { error } = await supabase.storage.from(BUCKET).remove([path]);
    if (error) throw error;
  } catch (problem) {
    console.error("[squaddict] το αρχείο δεν σβήστηκε:", problem);
  }
}

const OUTBOX_DIR = "outbox";

function outboxDirectory(): Directory {
  const dir = new Directory(Paths.document, OUTBOX_DIR);
  if (!dir.exists) {
    dir.create({ intermediates: true });
  }
  return dir;
}

export function persistImage(image: PickedImage, name: string): PickedImage {
  try {
    const target = new File(outboxDirectory(), name + ".jpg");
    if (target.exists) {
      target.delete();
    }
    new File(image.uri).copy(target);
    return { ...image, uri: target.uri };
  } catch (problem) {
    console.error("[squaddict] η φωτογραφία δεν αποθηκεύτηκε μόνιμα:", problem);
    return image;
  }
}

export function imageExists(uri: string): boolean {
  try {
    return new File(uri).exists;
  } catch {
    return true;
  }
}

export function discardImage(uri: string): void {
  try {
    const file = new File(uri);
    if (file.exists) {
      file.delete();
    }
  } catch {
  }
}

export function sweepOutboxImages(keep: string[]): void {
  try {
    for (const entry of outboxDirectory().list()) {
      if (entry instanceof File && !keep.includes(entry.uri)) {
        entry.delete();
      }
    }
  } catch {
  }
}
