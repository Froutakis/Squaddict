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
