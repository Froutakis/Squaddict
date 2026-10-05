import type { Person } from "../lib/people";
import type { Coords } from "./serviceLocation";
import { supabase } from "./supabaseClient";

export type LivePerson = Person & Coords;

export type LiveMap = {
  share: (coords: Coords) => void;
  close: () => void;
};

export function openLiveMap(
  eventId: string,
  me: Person,
  onPeople: (people: LivePerson[]) => void,
): LiveMap {
  let ready = false;
  let latest: Coords | null = null;

  const channel = supabase.channel(`live:${eventId}`, {
    config: { private: true, presence: { key: me.id } },
  });

  function track(coords: Coords) {
    channel.track({ id: me.id, name: me.name, lat: coords.lat, lng: coords.lng }).catch(function () {
    });
  }

  channel
    .on("presence", { event: "sync" }, function () {
      const people: LivePerson[] = [];

      for (const metas of Object.values(channel.presenceState())) {
        const last = metas[metas.length - 1] as Partial<LivePerson> | undefined;
        if (!last?.id || last.id === me.id) continue;
        if (typeof last.lat !== "number" || typeof last.lng !== "number") continue;

        people.push({ id: last.id, name: last.name ?? "", lat: last.lat, lng: last.lng });
      }

      onPeople(people);
    })
    .subscribe(function (status) {
      if (status !== "SUBSCRIBED") return;

      ready = true;
      if (latest) track(latest);
    });

  return {
    share(coords) {
      latest = coords;
      if (ready) track(coords);
    },
    close() {
      channel.untrack().catch(function () {
      });
      supabase.removeChannel(channel);
    },
  };
}

// "On my way" (chat_cards.sql): you tell your parea's chat you are heading to
// one of its plans today, and share your spot on the plan's live map (above)
// until you stop. Only the card is stored, never where you are.
export type OnMyWay = {
  id: string;
  messageId: string | null;
  groupId: string;
  userId: string;
  createdAt: string;
  stoppedAt: string | null;
  event: {
    id: string;
    title: string;
    date: string;
    startTime?: string;
    endTime?: string;
    location?: string;
    placeLabel?: string;
    lat?: number;
    lng?: number;
  };
};

const ON_MY_WAY_FIELDS =
  "id, message_id, group_id, user_id, created_at, stopped_at, " +
  "event:events!chat_on_my_way_event_id_fkey(id, title, date, start_time, end_time, location, place_label, lat, lng)";

function toOnMyWay(row: any): OnMyWay | null {
  const event = Array.isArray(row.event) ? row.event[0] : row.event;
  if (!event) return null;

  return {
    id: row.id,
    messageId: row.message_id ?? null,
    groupId: row.group_id,
    userId: row.user_id,
    createdAt: row.created_at ?? "",
    stoppedAt: row.stopped_at ?? null,
    event: {
      id: event.id,
      title: event.title,
      date: event.date,
      startTime: event.start_time?.slice(0, 5) ?? undefined,
      endTime: event.end_time?.slice(0, 5) ?? undefined,
      location: event.location ?? undefined,
      placeLabel: event.place_label ?? undefined,
      lat: event.lat ?? undefined,
      lng: event.lng ?? undefined,
    },
  };
}

// Posts "On my way to …" in the plan's parea. Only when you are in on it and
// it is today; already on your way, it returns that one.
export async function startOnMyWay(eventId: string): Promise<void> {
  const { error } = await supabase.rpc("on_my_way", { p_event_id: eventId });
  if (error) throw error;
}

// Only whoever shared it can stop it.
export async function stopOnMyWay(messageId: string): Promise<void> {
  const { error } = await supabase.rpc("stop_on_my_way", { p_message_id: messageId });
  if (error) throw error;
}

// The cards on these messages. Before chat_cards.sql is installed there are
// none, and the messages stay plain text.
export async function getOnMyWay(groupId: string, messageIds: string[]): Promise<Record<string, OnMyWay>> {
  if (messageIds.length === 0) return {};

  const { data, error } = await supabase
    .from("chat_on_my_way")
    .select(ON_MY_WAY_FIELDS)
    .eq("group_id", groupId)
    .in("message_id", messageIds);
  if (error) {
    console.warn("[squaddict] on my way unavailable:", error.message);
    return {};
  }

  const byMessage: Record<string, OnMyWay> = {};
  for (const row of (data ?? []) as any[]) {
    const card = toOnMyWay(row);
    if (card?.messageId) byMessage[card.messageId] = card;
  }
  return byMessage;
}
