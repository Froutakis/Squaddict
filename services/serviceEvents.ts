import type { Person } from "../lib/people";
import { supabase } from "./supabaseClient";
import { requireUser } from "./serviceAuth";
import { toEventTags, type EventTag } from "../lib/tags";
import { newId } from "../lib/ids";
import { removeImage, uploadImage, type PickedImage } from "./serviceMedia";
import { keyOf } from "../lib/datetime";
import { toSquadMemories, type SquadMemory } from "../lib/squadLook";

type EventRow = {
  id: string;
  group_id: string;
  title: string;
  date: string;
  start_time: string | null;
  end_time: string | null;
  location: string | null;
  description: string | null;
  created_by: string;
  is_public: boolean;
  lat: number | null;
  lng: number | null;
  place_label: string | null;
  tags: string[] | null;
  cover_url?: string | null;
};

type AttendeeRow = {
  user_id: string;
  status: string;
  profiles: { display_name: string; avatar_url: string | null } | null;
};

type EventPhotoRow = {
  id: string;
  event_id: string;
  user_id: string;
  path: string;
  width: number;
  height: number;
  created_at: string;
  in_explore?: boolean | null;
};

type EventRowWithJoins = EventRow & {
  groups: { name: string } | null;
  event_attendees: AttendeeRow[] | null;
};

export type GroupEvent = {
  id: string;
  groupId: string;
  title: string;
  date: string;
  startTime?: string;
  endTime?: string;
  location?: string;
  description?: string;
  createdBy: string;
  isPublic: boolean;
  lat?: number;
  lng?: number;
  placeLabel?: string;
  tags: EventTag[];
  coverUrl?: string | null;
};

export type NewEvent = Omit<
  GroupEvent,
  'id' | 'groupId' | 'createdBy' | 'isPublic' | 'tags'
> & {
  isPublic?: boolean;
  tags?: EventTag[];
};

export type EventPhoto = {
  id: string;
  eventId: string;
  userId: string;
  path: string;
  width: number;
  height: number;
  createdAt: string;
  inExplore: boolean;
};

export type RsvpStatus = "in" | "out";

export type Attendee = Person & {
  status: RsvpStatus;
};

export type MyEvent = GroupEvent & {
  groupName: string;
  myStatus?: RsvpStatus;
  going: Person[];
  // On another parea's public plan you said you're in to: your pareas, so it
  // shows on each of their lines (it is your night, whichever you look at).
  withGroupIds?: string[];
};

function toEvent(r: EventRow): GroupEvent {
  return {
    id: r.id,
    groupId: r.group_id,
    title: r.title,
    date: r.date,
    startTime: r.start_time?.slice(0, 5) ?? undefined,
    endTime: r.end_time?.slice(0, 5) ?? undefined,
    location: r.location ?? undefined,
    description: r.description ?? undefined,
    createdBy: r.created_by,
    isPublic: r.is_public ?? false,
    lat: r.lat ?? undefined,
    lng: r.lng ?? undefined,
    placeLabel: r.place_label ?? undefined,
    tags: toEventTags(r.tags),
    coverUrl: r.cover_url ?? null,
  };
}

function toAttendee(a: AttendeeRow): Attendee {
  return {
    id: a.user_id,
    name: a.profiles?.display_name ?? "",
    avatarUrl: a.profiles?.avatar_url ?? null,
    status: a.status === "in" ? "in" : "out",
  };
}

function toMyEvent(r: EventRowWithJoins, userId: string): MyEvent {
    const answers = r.event_attendees ?? [];
    const mine = answers.find((a) => a.user_id === userId)?.status;

    return {
        ...toEvent(r),
        groupName: r.groups?.name ?? "Squad",
        myStatus: mine === "in" || mine === "out" ? mine : undefined,
        going: answers
            .filter((a) => a.status === "in")
            .map((a) => ({
                id: a.user_id,
                name: a.profiles?.display_name ?? "",
                avatarUrl: a.profiles?.avatar_url ?? null,
            })),
    };
}

function toColumns(input: NewEvent) {
  const columns: Record<string, unknown> = {
    title: input.title,
    date: input.date,
    start_time: input.startTime || null,
    end_time: input.endTime || null,
    location: input.location || null,
    description: input.description || null,
  };

  if (input.isPublic !== undefined) columns.is_public = input.isPublic;
  if (input.lat !== undefined) columns.lat = input.lat;
  if (input.lng !== undefined) columns.lng = input.lng;
  if (input.placeLabel !== undefined) columns.place_label = input.placeLabel || null;
  if (input.tags !== undefined) columns.tags = input.tags;
  if (input.coverUrl !== undefined) columns.cover_url = input.coverUrl;

  return columns;
}

// New plans are not inserted from the app: they go to the parea's vote
// (proposePlan in serviceVotes) and the database makes them when it passes.

export async function updateEvent(eventId: string, input: NewEvent): Promise<GroupEvent> {
    const user = await requireUser();

    const { data, error } = await supabase
        .from("events")
        .update(toColumns(input))
        .eq("id", eventId)
        .eq("created_by", user.id)
        .select()
        .single();
    if (error) throw error;

    return toEvent(data as EventRow);
}

export async function getMyEvents(userId: string): Promise<MyEvent[]> {
    const [{ data: memberships, error: mErr }, { data: answered, error: aErr }] = await Promise.all([
        supabase.from("group_members").select("group_id").eq("user_id", userId),
        supabase
            .from("event_attendees")
            .select("event_id")
            .eq("user_id", userId)
            .eq("status", "in"),
    ]);
    if (mErr) throw mErr;
    if (aErr) throw aErr;

    const groupIds = (memberships ?? []).map((m) => m.group_id);
    const eventIds = [...new Set((answered ?? []).map((a) => a.event_id))];
    if (groupIds.length === 0 && eventIds.length === 0) return [];

    const filters: string[] = [];
    if (groupIds.length > 0) filters.push(`group_id.in.(${groupIds.join(",")})`);
    if (eventIds.length > 0) filters.push(`id.in.(${eventIds.join(",")})`);

    const { data, error } = await supabase
        .from("events")
        .select("*, groups!events_group_id_fkey(name), event_attendees(user_id, status, profiles(display_name, avatar_url))")
        .or(filters.join(","))
        .order("date", { ascending: true })
        .order("start_time", { ascending: true, nullsFirst: true });
    if (error) throw error;

    return (data as EventRowWithJoins[]).map((r) => {
        const event = toMyEvent(r, userId);
        const foreignIn = !groupIds.includes(r.group_id) && event.myStatus === "in";
        return { ...event, withGroupIds: foreignIn ? groupIds : [] };
    });
}

export async function setEventCover(eventId: string, coverUrl: string | null): Promise<void> {
    const { error } = await supabase.from("events").update({ cover_url: coverUrl }).eq("id", eventId);
    if (error) throw error;
}

export async function deleteEvent(eventId: string): Promise<void> {
    const user = await requireUser();

    const { data, error } = await supabase
        .from("events")
        .delete()
        .eq("id", eventId)
        .eq("created_by", user.id)
        .select("id");
    if (error) throw error;
    if (!data || data.length === 0) {
        throw new Error("You can only delete events you created.");
    }
}

export async function setRsvp(eventId: string, status: RsvpStatus): Promise<void> {
    const user = await requireUser();

    const { error } = await supabase
        .from("event_attendees")
        .upsert(
            {
                event_id: eventId,
                user_id: user.id,
                status,
                updated_at: new Date().toISOString(),
            },
            { onConflict: "event_id,user_id" }
        );
    if (error) throw error;
}

export async function clearRsvp(eventId: string): Promise<void> {
    const user = await requireUser();

    const { error } = await supabase
        .from("event_attendees")
        .delete()
        .eq("event_id", eventId)
        .eq("user_id", user.id);
    if (error) throw error;
}

export async function getAttendees(eventId: string): Promise<Attendee[]> {
    const { data, error } = await supabase
        .from("event_attendees")
        .select("user_id, status, profiles(display_name, avatar_url)")
        .eq("event_id", eventId)
        .in("status", ["in", "out"]);
    if (error) throw error;

    return (data as unknown as AttendeeRow[]).map(toAttendee);
}

function toEventPhoto(r: EventPhotoRow): EventPhoto {
  return {
    id: r.id,
    eventId: r.event_id,
    userId: r.user_id,
    path: r.path,
    width: r.width,
    height: r.height,
    createdAt: r.created_at,
    inExplore: r.in_explore ?? false,
  };
}

export function eventPhotoPath(groupId: string, eventId: string, photoId: string): string {
  return `${groupId}/events/${eventId}/${photoId}.jpg`;
}

export async function getEventPhotos(eventId: string): Promise<EventPhoto[]> {
    const { data, error } = await supabase
        .from("event_photos")
        .select("*")
        .eq("event_id", eventId)
        .order("created_at", { ascending: true });
    if (error) throw error;

    return (data as EventPhotoRow[]).map(toEventPhoto);
}

export type EventCover = EventPhoto & { latestAt: string };

// The first photo of each night, plus when its newest photo was added.
export async function getEventCovers(eventIds: string[]): Promise<Record<string, EventCover>> {
    if (eventIds.length === 0) return {};

    const { data, error } = await supabase
        .from("event_photos")
        .select("*")
        .in("event_id", eventIds)
        .order("created_at", { ascending: true });
    if (error) throw error;

    const covers: Record<string, EventCover> = {};
    for (const row of data as EventPhotoRow[]) {
        const cover = covers[row.event_id];
        if (cover) cover.latestAt = row.created_at;
        else covers[row.event_id] = { ...toEventPhoto(row), latestAt: row.created_at };
    }
    return covers;
}

export async function getGroupMemories(groupId: string, userId: string): Promise<SquadMemory[]> {
    const today = keyOf(new Date());

    const { data, error } = await supabase
        .from("events")
        .select("*, groups!events_group_id_fkey(name), event_attendees(user_id, status, profiles(display_name))")
        .eq("group_id", groupId)
        .lt("date", today)
        .order("date", { ascending: false });
    if (error) throw error;

    const events = (data as EventRowWithJoins[]).map((r) => toMyEvent(r, userId));
    if (events.length === 0) return [];

    const { data: photoRows, error: photoError } = await supabase
        .from("event_photos")
        .select("*")
        .in("event_id", events.map((e) => e.id))
        .order("created_at", { ascending: true });
    if (photoError) throw photoError;

    return toSquadMemories(events, (photoRows as EventPhotoRow[]).map(toEventPhoto), today);
}

export async function addEventPhoto(
    event: { id: string; groupId: string },
    image: PickedImage,
    inExplore = false,
): Promise<EventPhoto> {
    const user = await requireUser();

    const id = newId();
    const path = eventPhotoPath(event.groupId, event.id, id);
    const attachment = await uploadImage(path, image);

    const { data, error } = await supabase
        .from("event_photos")
        .insert({
            id,
            event_id: event.id,
            user_id: user.id,
            path: attachment.path,
            width: attachment.width,
            height: attachment.height,
            in_explore: inExplore,
        })
        .select()
        .single();

    if (error) {
        console.error("[squaddict] η γραμμή της φωτογραφίας απορρίφθηκε:", {
            path,
            eventId: event.id,
            userId: user.id,
            code: error.code,
            message: error.message,
            details: error.details,
        });
        await removeImage(path);
        throw error;
    }

    return toEventPhoto(data as EventPhotoRow);
}

export async function setPhotoInExplore(photoId: string, shown: boolean): Promise<void> {
    const { error } = await supabase.rpc("set_photo_in_explore", { photo_id: photoId, shown });
    if (error) throw error;
}

export async function removeEventPhoto(photo: EventPhoto): Promise<void> {
    const { error } = await supabase
        .from("event_photos")
        .delete()
        .eq("id", photo.id);
    if (error) throw error;

    await removeImage(photo.path);
}

export async function getCheckins(eventIds: string[]): Promise<Record<string, string[]>> {
    if (eventIds.length === 0) return {};

    const { data, error } = await supabase
        .from("event_checkins")
        .select("event_id, user_id")
        .in("event_id", eventIds);
    if (error) throw error;

    const byEvent: Record<string, string[]> = {};
    for (const row of data as { event_id: string; user_id: string }[]) {
        (byEvent[row.event_id] ??= []).push(row.user_id);
    }
    return byEvent;
}

export async function checkIn(eventId: string): Promise<void> {
    const user = await requireUser();

    const { error } = await supabase
        .from("event_checkins")
        .upsert({ event_id: eventId, user_id: user.id }, { onConflict: "event_id,user_id", ignoreDuplicates: true });
    if (error) throw error;
}

export async function countMyPhotos(userId: string): Promise<number> {
    const { count, error } = await supabase
        .from("event_photos")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId);
    if (error) throw error;

    return count ?? 0;
}
