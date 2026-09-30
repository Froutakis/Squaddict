import { supabase } from "./supabaseClient";
import { requireUser } from "./serviceAuth";
import { GROUP_FIELDS, toGroup, type Group } from "./serviceGroup";
import { getFollowing } from "./serviceFollow";
import type { EventPhoto, MyEvent } from "./serviceEvents";
import { keyOf } from "../lib/datetime";
import { capPerNight, type PhotoReaction } from "../lib/photoFeed";

// One photo in the Home feed, with the night and the squad it belongs to.
export type FeedPhoto = {
  photo: EventPhoto;
  event: MyEvent;
  group: Group;
};

const NIGHTS = 40;
const PHOTOS = 80;
const PER_NIGHT = 2;

// The newest photos of a squad's own nights and of the squads it follows.
// Other squads only show what they made public: the database decides that.
export async function getPhotoFeed(groupId: string): Promise<FeedPhoto[]> {
  const following = await getFollowing(groupId).catch(() => [] as Group[]);
  const groupIds = [groupId, ...following.filter((g) => g.memoriesPublic).map((g) => g.id)];

  const { data: eventRows, error: eventError } = await supabase
    .from("events")
    .select(`*, groups(${GROUP_FIELDS})`)
    .in("group_id", groupIds)
    .lte("date", keyOf(new Date()))
    .order("date", { ascending: false })
    .limit(NIGHTS);
  if (eventError) throw eventError;

  const nights = new Map<string, { event: MyEvent; group: Group }>();
  for (const row of (eventRows ?? []) as any[]) {
    if (!row.groups) continue;
    const group = toGroup(row.groups);
    nights.set(row.id, {
      group,
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
  if (nights.size === 0) return [];

  const { data: photoRows, error: photoError } = await supabase
    .from("event_photos")
    .select("*")
    .in("event_id", [...nights.keys()])
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

  return capPerNight(photos, PER_NIGHT).map((photo) => ({ photo, ...nights.get(photo.eventId)! }));
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
