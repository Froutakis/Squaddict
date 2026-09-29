import type { Coords } from "./serviceLocation";
import { supabase } from "./supabaseClient";
import { requireUser } from "./serviceAuth";
import { dateRange, daysUntil, keyOf, type FeedWhen } from "../lib/datetime";
import { searchTerm } from "../lib/search";

export type { FeedWhen };
import { toEventTags, type EventTag } from "../lib/tags";
import type { EventPhoto, MyEvent, RsvpStatus } from "./serviceEvents";
import type { Person } from "../lib/people";

export type FeedEvent = {
  id: string;
  title: string;
  date: string;
  startTime?: string;
  endTime?: string;
  location?: string;
  lat: number;
  lng: number;
  placeLabel: string;
  distanceKm?: number;
  tags: EventTag[];
  groupId: string;
  groupName: string;
  groupHandle: string;
  goingCount: number;
  myStatus?: RsvpStatus;
  isMember: boolean;
  coverUrl?: string | null;
};

export type FeedGroup = {
  id: string;
  handle: string;
  name: string;
  bio: string | null;
  avatarUrl: string | null;
  memberCount: number;
  followerCount?: number;
  openEvents: number;
};

export type FeedFilters = {
  center?: Coords | null;
  radiusKm?: number;
  tags?: EventTag[];
  when?: FeedWhen | null;
  groupIds?: string[];
  search?: string;
};

export type FeedPage = {
  events: FeedEvent[];
  groups: FeedGroup[];
  hasMore: boolean;
};

export const FEED_PAGE_SIZE = 20;

export const DEFAULT_RADIUS_KM = 25;

const EARTH_KM = 6371;

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

export function distanceKm(a: Coords, b: Coords): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;

  return 2 * EARTH_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

const FEED_FIELDS =
  "id, title, date, start_time, end_time, location, lat, lng, place_label, tags, group_id, cover_url, " +
  "groups(name, handle, bio, avatar_url, member_count, parea_follower_count), event_attendees(user_id, status)";

function score(event: FeedEvent, radiusKm: number, tags: EventTag[]): number {
  const near =
    event.distanceKm === undefined ? 0 : Math.max(0, 1 - event.distanceKm / radiusKm) * 3;
  const overlap = tags.filter((t) => event.tags.includes(t)).length * 2;
  const soon = Math.max(0, 14 - daysUntil(event.date)) * 0.1;

  return near + overlap + soon;
}

function toFeedEvent(r: any, userId: string, isMember: boolean, center: Coords | null): FeedEvent {
  const answers = (r.event_attendees ?? []) as { user_id: string; status: string }[];
  const mine = answers.find((a) => a.user_id === userId)?.status;

  return {
    id: r.id,
    title: r.title,
    date: r.date,
    startTime: r.start_time?.slice(0, 5) ?? undefined,
    endTime: r.end_time?.slice(0, 5) ?? undefined,
    location: r.location ?? undefined,
    lat: r.lat,
    lng: r.lng,
    placeLabel: r.place_label ?? "",
    distanceKm: center ? distanceKm(center, { lat: r.lat, lng: r.lng }) : undefined,
    tags: toEventTags(r.tags),
    groupId: r.group_id,
    groupName: r.groups?.name ?? "Squad",
    groupHandle: r.groups?.handle ?? "",
    goingCount: answers.filter((a) => a.status === "in").length,
    myStatus: mine === "in" || mine === "out" ? mine : undefined,
    isMember,
    coverUrl: r.cover_url ?? null,
  };
}

// A squad's upcoming public plans, for its profile page.
export async function getGroupPublicEvents(groupId: string): Promise<FeedEvent[]> {
  const user = await requireUser();

  const { data, error } = await supabase
    .from("events")
    .select(FEED_FIELDS)
    .eq("group_id", groupId)
    .eq("is_public", true)
    .gte("date", keyOf(new Date()))
    .order("date", { ascending: true })
    .order("start_time", { ascending: true, nullsFirst: true })
    .limit(20);
  if (error) throw error;

  return ((data ?? []) as any[]).map((r) => toFeedEvent(r, user.id, false, null));
}

export async function getFeed(filters: FeedFilters = {}, page = 0): Promise<FeedPage> {
  const user = await requireUser();
  const from = page * FEED_PAGE_SIZE;

  const center = filters.center ?? null;
  const radiusKm = filters.radiusKm ?? DEFAULT_RADIUS_KM;

  const { data: memberships } = await supabase
    .from("group_members")
    .select("group_id")
    .eq("user_id", user.id);

  const myGroups = new Set((memberships ?? []).map((m) => m.group_id));

  let query = supabase
    .from("events")
    .select(FEED_FIELDS)
    .eq("is_public", true)
    .gte("date", keyOf(new Date()));

  if (center) {
    const latDelta = radiusKm / 111;
    const lngDelta = radiusKm / (111 * Math.max(0.01, Math.cos(toRad(center.lat))));

    query = query
      .gte("lat", center.lat - latDelta)
      .lte("lat", center.lat + latDelta)
      .gte("lng", center.lng - lngDelta)
      .lte("lng", center.lng + lngDelta);
  }

  if (filters.tags?.length) query = query.overlaps("tags", filters.tags);

  if (filters.when) {
    const [first, last] = dateRange(filters.when);
    query = query.gte("date", first).lte("date", last);
  }

  // Accent- and case-insensitive: "καφε" finds "Καφές" (see supabase/search.sql).
  const term = filters.search ? searchTerm(filters.search) : null;
  if (term) {
    const { data: found, error: searchError } = await supabase.rpc("search_public_event_ids", {
      needle: term,
    });
    if (searchError) throw searchError;

    const ids = (found ?? []) as string[];
    if (ids.length === 0) return { events: [], groups: [], hasMore: false };
    query = query.in("id", ids);
  }

  if (filters.groupIds) {
    if (filters.groupIds.length === 0) return { events: [], groups: [], hasMore: false };
    query = query.in("group_id", filters.groupIds);
  }

  const { data, error } = await query
    .order("date", { ascending: true })
    .order("start_time", { ascending: true, nullsFirst: true })
    .range(from, from + FEED_PAGE_SIZE);
  if (error) throw error;

  const rows = (data ?? []) as any[];
  const hasMore = rows.length > FEED_PAGE_SIZE;
  const pageRows = rows.slice(0, FEED_PAGE_SIZE);

  const events: FeedEvent[] = pageRows.map((r) =>
    toFeedEvent(r, user.id, myGroups.has(r.group_id), center),
  );

  const preferred = filters.tags ?? [];
  const near = center
    ? events.filter((e) => (e.distanceKm ?? Infinity) <= radiusKm)
    : events;

  near.sort((a, b) => score(b, radiusKm, preferred) - score(a, radiusKm, preferred));

  const byId = new Map(pageRows.map((r) => [r.id, r]));
  const groups = new Map<string, FeedGroup>();

  near.forEach(function (event) {
    if (event.isMember) return;

    const seen = groups.get(event.groupId);
    if (seen) {
      seen.openEvents += 1;
      return;
    }

    groups.set(event.groupId, {
      id: event.groupId,
      handle: event.groupHandle,
      name: event.groupName,
      bio: byId.get(event.id)?.groups?.bio ?? null,
      avatarUrl: byId.get(event.id)?.groups?.avatar_url ?? null,
      memberCount: byId.get(event.id)?.groups?.member_count ?? 0,
      followerCount: byId.get(event.id)?.groups?.parea_follower_count ?? 0,
      openEvents: 1,
    });
  });

  return { events: near, groups: [...groups.values()], hasMore };
}

export type FeedHighlight = {
  event: MyEvent;
  cover: EventPhoto;
  goingCount: number;
  group: Omit<FeedGroup, "openEvents">;
};

export async function getHighlights(
  center: Coords | null = null,
  radiusKm: number = DEFAULT_RADIUS_KM,
): Promise<FeedHighlight[]> {
  const { data, error } = await supabase.rpc("explore_highlights", {
    center_lat: center?.lat ?? null,
    center_lng: center?.lng ?? null,
    radius_km: center ? radiusKm : null,
  });
  if (error) throw error;

  return ((data ?? []) as any[]).map(function (r) {
    return {
      event: {
        id: r.event_id,
        groupId: r.group_id,
        groupName: r.group_name,
        title: r.title,
        date: r.date,
        startTime: r.start_time?.slice(0, 5) ?? undefined,
        endTime: r.end_time?.slice(0, 5) ?? undefined,
        location: r.location ?? undefined,
        placeLabel: r.place_label ?? undefined,
        description: r.description ?? undefined,
        lat: r.lat ?? undefined,
        lng: r.lng ?? undefined,
        createdBy: "",
        isPublic: r.is_public,
        tags: [],
        going: [],
      },
      cover: {
        id: r.cover_id,
        eventId: r.event_id,
        userId: r.cover_user_id,
        path: r.cover_path,
        width: r.cover_width,
        height: r.cover_height,
        createdAt: r.cover_created,
        inExplore: true,
      },
      goingCount: r.going_count,
      group: {
        id: r.group_id,
        handle: r.group_handle,
        name: r.group_name,
        bio: r.group_bio,
        avatarUrl: r.group_avatar_url ?? null,
        memberCount: r.member_count,
      },
    };
  });
}

export type PareaGoing = {
  event: MyEvent;
  friends: Person[];
  viaGroupIds: string[];
  goingCount: number;
};

// Public plans of other squads that people from your squads are in on.
export async function getPareaGoing(): Promise<PareaGoing[]> {
  const { data, error } = await supabase.rpc("parea_going");
  if (error) throw error;

  return ((data ?? []) as any[]).map(function (r) {
    return {
      event: {
        id: r.event_id,
        groupId: r.group_id,
        groupName: r.group_name,
        title: r.title,
        date: r.date,
        startTime: r.start_time?.slice(0, 5) ?? undefined,
        endTime: r.end_time?.slice(0, 5) ?? undefined,
        location: r.location ?? undefined,
        placeLabel: r.place_label ?? undefined,
        description: r.description ?? undefined,
        lat: r.lat ?? undefined,
        lng: r.lng ?? undefined,
        coverUrl: r.cover_url ?? null,
        createdBy: "",
        isPublic: true,
        tags: [],
        going: [],
      },
      friends: ((r.friends ?? []) as any[]).map((f) => ({
        id: f.id,
        name: f.name ?? "",
        avatarUrl: f.avatarUrl ?? null,
      })),
      viaGroupIds: r.via_groups ?? [],
      goingCount: r.going_count ?? 0,
    };
  });
}

export type PareaProfile = {
  nightsOut: number;
  places: string[];
  covers: string[];
  photos: EventPhoto[];
};

// The public side of a squad: counts, favourite spots, public covers and
// the photos its members shared to Explore (see supabase/parea_profile.sql).
export async function getPareaProfile(groupId: string): Promise<PareaProfile> {
  const { data, error } = await supabase.rpc("parea_profile", { target: groupId });
  if (error) throw error;

  const row = ((data ?? []) as any[])[0] ?? {};
  return {
    nightsOut: row.nights_out ?? 0,
    places: row.places ?? [],
    covers: row.covers ?? [],
    photos: ((row.photos ?? []) as any[]).map((p) => ({
      id: p.id,
      eventId: p.eventId,
      userId: p.userId,
      path: p.path,
      width: p.width,
      height: p.height,
      createdAt: p.createdAt,
      inExplore: true,
    })),
  };
}
