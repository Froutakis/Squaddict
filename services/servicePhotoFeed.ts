import { supabase } from "./supabaseClient";
import { requireUser } from "./serviceAuth";
import { GROUP_FIELDS, toGroup, type Group } from "./serviceGroup";
import { getFollowing } from "./serviceFollow";
import type { EventPhoto, MyEvent } from "./serviceEvents";
import { keyOf } from "../lib/datetime";
import { capPerNight, isOwnCircle, mixFeed, type FeedReason, type PhotoReaction } from "../lib/photoFeed";

// One memory in the Home feed: a photo, with the night and the squad it is from.
export type FeedPhoto = {
  photo: EventPhoto;
  event: MyEvent;
  group: Group;
  reason: FeedReason;
  // Who links you to the night: the member who went, the parea, or the tag.
  via: string | null;
};

type Night = { id: string; reason: FeedReason; via: string | null };

const NIGHTS = 120;
const PHOTOS = 600;
// One post per night: the feed is about the memory, not every photo in it.
const PER_NIGHT = 1;

// A parea's feed: its own nights and the pareas it follows, with a few public
// nights of other pareas mixed in (one of yours went, a parea you follow went,
// the same kind of night, or simply public). The database picks the nights and
// says why; this keeps one photo per night and mixes them.
export async function getPhotoFeed(groupId: string): Promise<FeedPhoto[]> {
  const nights = await pickNights(groupId);
  if (nights.length === 0) return [];
  const why = new Map(nights.map((night) => [night.id, night]));

  const { data: eventRows, error: eventError } = await supabase
    .from("events")
    .select(`*, groups(${GROUP_FIELDS})`)
    .in("id", nights.map((night) => night.id))
    .order("date", { ascending: false });
  if (eventError) throw eventError;

  const byEvent = new Map<string, Omit<FeedPhoto, "photo">>();
  for (const row of (eventRows ?? []) as any[]) {
    if (!row.groups) continue;
    const group = toGroup(row.groups);
    const night = why.get(row.id);
    byEvent.set(row.id, {
      group,
      reason: night?.reason ?? "yours",
      via: night?.via ?? null,
      event: {
        id: row.id,
        groupId: row.group_id,
        groupName: group.name,
        title: row.title,
        date: row.date,
        startTime: row.start_time?.slice(0, 5) ?? undefined,
        endTime: row.end_time?.slice(0, 5) ?? undefined,
        location: row.location ?? undefined,
        placeLabel: row.place_label ?? undefined,
        description: row.description ?? undefined,
        lat: row.lat ?? undefined,
        lng: row.lng ?? undefined,
        createdBy: row.created_by ?? "",
        isPublic: row.is_public ?? false,
        tags: row.tags ?? [],
        going: [],
      },
    });
  }
  if (byEvent.size === 0) return [];

  const { data: photoRows, error: photoError } = await supabase
    .from("event_photos")
    .select("*")
    .in("event_id", [...byEvent.keys()])
    .order("created_at", { ascending: false })
    .limit(PHOTOS);
  if (photoError) throw photoError;

  const photos: EventPhoto[] = ((photoRows ?? []) as any[]).map((row) => ({
    id: row.id,
    eventId: row.event_id,
    userId: row.user_id,
    path: row.path,
    width: row.width,
    height: row.height,
    createdAt: row.created_at,
    inExplore: row.in_explore ?? false,
  }));

  const posts = capPerNight(photos, PER_NIGHT).map((photo) => ({ photo, ...byEvent.get(photo.eventId)! }));
  return mixFeed(posts, (post) => isOwnCircle(post.reason));
}

// The nights for the feed, with why each is there. Falls back to the parea's
// own nights and the ones it follows while feed_nights.sql isn't in yet.
async function pickNights(groupId: string): Promise<Night[]> {
  const { data, error } = await supabase.rpc("feed_nights", { p_group: groupId, p_limit: NIGHTS });
  if (!error && Array.isArray(data)) {
    return (data as any[]).map((row) => ({ id: row.event_id, reason: row.reason as FeedReason, via: row.via ?? null }));
  }

  const following = await getFollowing(groupId).catch(() => [] as Group[]);
  const followed = following.filter((g) => g.memoriesPublic);
  const names = new Map(followed.map((g) => [g.id, g.name]));

  const { data: rows, error: rowsError } = await supabase
    .from("events")
    .select("id, group_id")
    .in("group_id", [groupId, ...followed.map((g) => g.id)])
    .lte("date", keyOf(new Date()))
    .order("date", { ascending: false })
    .limit(NIGHTS);
  if (rowsError) throw rowsError;

  return ((rows ?? []) as any[]).map((row) =>
    row.group_id === groupId
      ? { id: row.id, reason: "yours" as const, via: null }
      : { id: row.id, reason: "following" as const, via: names.get(row.group_id) ?? null },
  );
}

// Reactions on these photos, oldest first, with who gave them and as which squad.
export async function getPhotoReactions(photoIds: string[]): Promise<Record<string, PhotoReaction[]>> {
  if (photoIds.length === 0) return {};

  const { data, error } = await supabase.rpc("photo_reactions_for", { p_photo_ids: photoIds });
  if (error) throw error;

  const byPhoto: Record<string, PhotoReaction[]> = {};
  for (const row of (data ?? []) as any[]) {
    (byPhoto[row.photo_id] ??= []).push({
      photoId: row.photo_id,
      userId: row.user_id,
      emoji: row.emoji,
      name: row.display_name ?? "Someone",
      avatarUrl: row.avatar_url ?? null,
      groupId: row.group_id ?? null,
      groupName: row.group_name ?? null,
    });
  }
  return byPhoto;
}

// One reaction per person per photo: a new emoji replaces the old one.
export async function setPhotoReaction(photoId: string, groupId: string, emoji: string): Promise<void> {
  const user = await requireUser();

  const { error } = await supabase
    .from("photo_reactions")
    .upsert(
      { photo_id: photoId, user_id: user.id, group_id: groupId, emoji, created_at: new Date().toISOString() },
      { onConflict: "photo_id,user_id" },
    );
  if (error) throw error;
}

export async function clearPhotoReaction(photoId: string): Promise<void> {
  const user = await requireUser();

  const { error } = await supabase
    .from("photo_reactions")
    .delete()
    .eq("photo_id", photoId)
    .eq("user_id", user.id);
  if (error) throw error;
}
