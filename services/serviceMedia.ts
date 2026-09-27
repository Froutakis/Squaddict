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
import {
  SQUADS_BUCKET,
  squadImagePath,
  squadPathFromUrl,
  type SquadImageKind,
} from "../lib/squadLook";

const BUCKET = "chat";

export type PickedImage = {
  uri: string;
  width: number;
  height: number;
};

export async function pickImage(): Promise<PickedImage | null> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    return null;
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    quality: 1,
    allowsMultipleSelection: false,
  });

  if (result.canceled || result.assets.length === 0) {
    return null;
  }

  const asset = result.assets[0];
  return { uri: asset.uri, width: asset.width, height: asset.height };
}

export async function takePhoto(): Promise<PickedImage | null> {
  const permission = await ImagePicker.requestCameraPermissionsAsync();
  if (!permission.granted) {
    return null;
  }

  const result = await ImagePicker.launchCameraAsync({
    mediaTypes: ["images"],
    quality: 1,
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

async function readBytes(uri: string): Promise<ArrayBuffer> {
  if (Platform.OS === "web") {
    const response = await fetch(uri);
    return await response.arrayBuffer();
  }
  return await new File(uri).arrayBuffer();
}

async function uploadTo(
  bucket: string,
  path: string,
  image: PickedImage,
  upsert: boolean,
): Promise<void> {
  const bytes = await readBytes(image.uri);

  const problem = uploadRejection(bytes.byteLength);
  if (problem) {
    throw new Error(problem);
  }

  const { error } = await supabase.storage.from(bucket).upload(path, bytes, {
    contentType: "image/jpeg",
    upsert,
  });
  if (error) {
    console.error("[squaddict] το ανέβασμα απέρριψε:", {
      bucket,
      path,
      bytes: bytes.byteLength,
      name: (error as any).name,
      message: error.message,
      status: (error as any).status ?? (error as any).statusCode,
    });
    throw error;
  }
}

export async function uploadImage(
  path: string,
  image: PickedImage,
): Promise<Attachment> {
  await uploadTo(BUCKET, path, image, true);

  return {
    path,
    type: "image/jpeg",
    width: image.width,
    height: image.height,
  };
}

export async function uploadSquadImage(
  groupId: string,
  kind: SquadImageKind,
  picked: PickedImage,
): Promise<string> {
  const image = await prepareImage(picked);
  const path = squadImagePath(groupId, kind, Date.now());
  await uploadTo(SQUADS_BUCKET, path, image, false);

  return supabase.storage.from(SQUADS_BUCKET).getPublicUrl(path).data.publicUrl;
}

export async function removeSquadImage(url: string | null): Promise<void> {
  if (!url) return;

  const path = squadPathFromUrl(url);
  if (!path) return;

  try {
    const { error } = await supabase.storage.from(SQUADS_BUCKET).remove([path]);
    if (error) throw error;
  } catch (problem) {
    console.error("[squaddict] η εικόνα της παρέας δεν σβήστηκε:", problem);
  }
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
