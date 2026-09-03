import { Directory, File, Paths } from "expo-file-system";
import * as ImageManipulator from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";
import {
  MAX_DIMENSION,
  SIGNED_URL_TTL_SECONDS,
  fitWithin,
  rejectionFor,
  type Attachment,
  type SignedMap,
} from "../components/chat/media";
import { supabase } from "./supabaseClient";

const BUCKET = "chat";

/** Μια εικόνα έτοιμη για ανέβασμα — τοπικό αρχείο, όχι ακόμα στη βάση. */
export type PickedImage = {
  uri: string;
  width: number;
  height: number;
};

/**
 * Ανοίγει τη συλλογή. `null` όταν ο χρήστης το ακύρωσε ή αρνήθηκε την άδεια —
 * και τα δύο είναι απάντηση, όχι σφάλμα.
 */
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
  const problem = rejectionFor(asset.mimeType, asset.fileSize);
  if (problem) {
    throw new Error(problem);
  }

  return { uri: asset.uri, width: asset.width, height: asset.height };
}

/**
 * Σμικραίνει και μετατρέπει σε jpeg.
 *
 * Χωρίς αυτό ανεβαίνει το αρχείο της κάμερας ως έχει — και κατεβαίνει ολόκληρο
 * σε κάθε συσκευή που θα ανοίξει τη συνομιλία.
 */
export async function prepareImage(picked: PickedImage): Promise<PickedImage> {
  const target = fitWithin(picked.width, picked.height, MAX_DIMENSION);
  const alreadySmall =
    target.width === picked.width && target.height === picked.height;

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
}

/**
 * Ανεβάζει και γυρίζει τι πρέπει να γραφτεί στο μήνυμα.
 *
 * Το `upsert` δεν είναι ευκολία: η επανάληψη μιας αποστολής που απέτυχε φέρνει
 * το ΙΔΙΟ id, άρα το ίδιο όνομα αρχείου. Χωρίς αυτό η δεύτερη προσπάθεια θα
 * έσκαγε πάνω σε ό,τι πρόλαβε να ανέβει στην πρώτη.
 */
export async function uploadImage(
  path: string,
  image: PickedImage,
): Promise<Attachment> {
  const response = await fetch(image.uri);
  const blob = await response.blob();

  const { error } = await supabase.storage.from(BUCKET).upload(path, blob, {
    contentType: "image/jpeg",
    upsert: true,
  });
  if (error) throw error;

  return {
    path,
    type: "image/jpeg",
    width: image.width,
    height: image.height,
  };
}

/**
 * Υπογεγραμμένοι σύνδεσμοι για μια σελίδα μηνυμάτων, με ένα αίτημα.
 *
 * Το bucket είναι κλειστό: χωρίς υπογραφή δεν υπάρχει τρόπος να δει κανείς την
 * εικόνα, ούτε καν με τη διαδρομή στο χέρι.
 */
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

/**
 * Σβήνει το αρχείο μιας διαγραμμένης φωτογραφίας.
 *
 * Δεν πετάει: το μήνυμα έχει ήδη σβηστεί και η γραμμή δεν δείχνει πια εδώ. Ένα
 * αρχείο που έμεινε είναι απρόσιτο — κακό για τον χώρο, όχι για την ιδιωτικότητα.
 */
export async function removeImage(path: string): Promise<void> {
  try {
    const { error } = await supabase.storage.from(BUCKET).remove([path]);
    if (error) throw error;
  } catch (problem) {
    console.error("[squaddict] το αρχείο δεν σβήστηκε:", problem);
  }
}


/**
 * Ο φάκελος όπου περιμένουν οι φωτογραφίες που δεν έχουν σταλεί.
 *
 * Ο επεξεργαστής εικόνας γράφει στην ΠΡΟΣΩΡΙΝΗ μνήμη, που το σύστημα αδειάζει
 * όποτε θέλει. Ένα μήνυμα που περίμενε αποστολή ξυπνούσε δείχνοντας σε αρχείο
 * που δεν υπήρχε πια.
 */
const OUTBOX_DIR = "outbox";

function outboxDirectory(): Directory {
  const dir = new Directory(Paths.document, OUTBOX_DIR);
  if (!dir.exists) {
    dir.create({ intermediates: true });
  }
  return dir;
}

/**
 * Αντιγράφει την εικόνα σε μόνιμο φάκελο και γυρίζει τη νέα της θέση.
 *
 * Σε αποτυχία γυρίζει την εικόνα ως έχει: καλύτερα να σταλεί τώρα και να χαθεί
 * σε επανεκκίνηση, παρά να μη σταλεί καθόλου. Το web δεν έχει τέτοιο σύστημα
 * αρχείων και περνά από εδώ αμετάβλητο.
 */
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

/** Υπάρχει ακόμα το αρχείο; */
export function imageExists(uri: string): boolean {
  try {
    return new File(uri).exists;
  } catch {
    // Χωρίς σύστημα αρχείων δεν μπορούμε να το διαψεύσουμε, οπότε το δεχόμαστε:
    // η αποστολή θα το πει καθαρά αν λείπει.
    return true;
  }
}

/** Σβήνει ένα αντίγραφο που δεν χρειάζεται πια. Σιωπηλά. */
export function discardImage(uri: string): void {
  try {
    const file = new File(uri);
    if (file.exists) {
      file.delete();
    }
  } catch {
    // το μαζεύει το sweepOutboxImages
  }
}

/**
 * Σβήνει ό,τι έμεινε στον φάκελο και δεν το διεκδικεί κανένα outbox.
 *
 * Χρειάζεται επειδή ο χρήστης μπορεί να διαλέξει φωτογραφία και να μην τη
 * στείλει ποτέ — να αλλάξει Παρέα, να κλείσει την εφαρμογή. Χωρίς αυτό, ο
 * φάκελος μεγαλώνει για πάντα.
 */
export function sweepOutboxImages(keep: string[]): void {
  try {
    for (const entry of outboxDirectory().list()) {
      if (entry instanceof File && !keep.includes(entry.uri)) {
        entry.delete();
      }
    }
  } catch {
    // σιωπηλά — καθάρισμα, όχι λειτουργία
  }
}
