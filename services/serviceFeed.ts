import type { Coords } from "./serviceLocation";
import { supabase } from "./supabaseClient";
import { requireUser } from "./serviceAuth";
import { daysUntil, keyOf } from "../lib/datetime";
import { toEventTags, type EventTag } from "../lib/tags";
import type { RsvpStatus } from "./serviceEvents";

export type FeedEvent = {
  id: string;
  title: string;
  date: string;
  startTime?: string;
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
};

export type FeedGroup = {
  id: string;
  handle: string;
  name: string;
  bio: string | null;
  memberCount: number;
  openEvents: number;
};

export type FeedFilters = {
  center?: Coords | null;
  radiusKm?: number;
  tags?: EventTag[];
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
  "id, title, date, start_time, location, lat, lng, place_label, tags, group_id, " +
  "groups(name, handle, bio, member_count), event_attendees(user_id, status)";

function score(event: FeedEvent, radiusKm: number, tags: EventTag[]): number {
  const near =
    event.distanceKm === undefined ? 0 : Math.max(0, 1 - event.distanceKm / radiusKm) * 3;
  const overlap = tags.filter((t) => event.tags.includes(t)).length * 2;
  const soon = Math.max(0, 14 - daysUntil(event.date)) * 0.1;

  return near + overlap + soon;
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

  const { data, error } = await query
    .order("date", { ascending: true })
    .order("start_time", { ascending: true, nullsFirst: true })
    .range(from, from + FEED_PAGE_SIZE);
  if (error) throw error;

  const rows = (data ?? []) as any[];
  const hasMore = rows.length > FEED_PAGE_SIZE;
  const pageRows = rows.slice(0, FEED_PAGE_SIZE);

  const events: FeedEvent[] = pageRows.map(function (r) {
    const answers = (r.event_attendees ?? []) as { user_id: string; status: string }[];
    const mine = answers.find((a) => a.user_id === user.id)?.status;

    return {
      id: r.id,
      title: r.title,
      date: r.date,
      startTime: r.start_time?.slice(0, 5) ?? undefined,
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
      isMember: myGroups.has(r.group_id),
    };
  });

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
      memberCount: byId.get(event.id)?.groups?.member_count ?? 0,
      openEvents: 1,
    });
  });

  return { events: near, groups: [...groups.values()], hasMore };
}
