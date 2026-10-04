import { supabase } from "./supabaseClient";
import { keyOf } from "../lib/datetime";

// Meeting other pareas (crossed_waves.sql): the pareas yours crossed on public
// nights, the waves between pareas, and the month's board. All of it is about
// public nights only; when the SQL isn't in yet, these come back empty.

export type Crossing = {
  myEventId: string;
  night: string;
  place: string | null;
  otherGroupId: string;
  otherName: string;
  otherAvatarUrl: string | null;
  otherEventId: string;
  otherTitle: string;
  // How many times your parea crossed this one in the window.
  times: number;
};

export type Wave = {
  id: string;
  eventId: string | null;
  createdAt: string;
  fromGroupId: string;
  fromName: string;
  fromAvatarUrl: string | null;
  wavedBack: boolean;
};

export type BoardRow = {
  groupId: string;
  name: string;
  avatarUrl: string | null;
  nights: number;
  place: number;
  isMine: boolean;
};

export async function getCrossings(groupId: string): Promise<Crossing[]> {
  const { data, error } = await supabase.rpc("crossed_pareas", { p_group: groupId });
  if (error || !Array.isArray(data)) return [];
  return (data as any[]).map((row) => ({
    myEventId: row.my_event_id,
    night: row.night,
    place: row.place ?? null,
    otherGroupId: row.other_group_id,
    otherName: row.other_name,
    otherAvatarUrl: row.other_avatar_url ?? null,
    otherEventId: row.other_event_id,
    otherTitle: row.other_title,
    times: row.times ?? 1,
  }));
}

export async function getWaves(groupId: string): Promise<Wave[]> {
  const { data, error } = await supabase.rpc("waves_for", { p_group: groupId });
  if (error || !Array.isArray(data)) return [];
  return (data as any[]).map((row) => ({
    id: row.id,
    eventId: row.event_id ?? null,
    createdAt: row.created_at,
    fromGroupId: row.from_group_id,
    fromName: row.from_name,
    fromAvatarUrl: row.from_avatar_url ?? null,
    wavedBack: !!row.waved_back,
  }));
}

// Returns false when you already waved this week.
export async function sendWave(fromGroupId: string, toGroupId: string): Promise<boolean> {
  const { data, error } = await supabase.rpc("send_wave", { p_from: fromGroupId, p_to: toGroupId });
  if (error) throw error;
  return Array.isArray(data) ? data.length > 0 : !!data;
}

// The board of the month that `day` falls in.
export async function getBoard(groupId: string, day: Date): Promise<BoardRow[]> {
  const { data, error } = await supabase.rpc("city_board", { p_group: groupId, p_month: keyOf(day) });
  if (error || !Array.isArray(data)) return [];
  return (data as any[]).map((row) => ({
    groupId: row.group_id,
    name: row.name,
    avatarUrl: row.avatar_url ?? null,
    nights: row.nights,
    place: row.place,
    isMine: !!row.is_mine,
  }));
}
