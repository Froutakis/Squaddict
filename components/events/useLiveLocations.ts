import { useEffect, useState } from 'react';
import type { Person } from '../../lib/people';
import { openLiveMap, type LivePerson } from '../../services/serviceLiveLocation';
import { watchCoords } from '../../services/serviceLocation';

export function useLiveLocations(eventId: string | undefined, me: Person): LivePerson[] {
  const [people, setPeople] = useState<LivePerson[]>([]);

  useEffect(() => {
    setPeople([]);
    if (!eventId || !me.id || !me.name) return;

    const live = openLiveMap(eventId, me, setPeople);
    let stop: (() => void) | null = null;
    let cancelled = false;

    watchCoords(live.share).then(function (unwatch) {
      if (cancelled) unwatch?.();
      else stop = unwatch;
    });

    return () => {
      cancelled = true;
      stop?.();
      live.close();
    };
  }, [eventId, me.id, me.name]);

  return people;
}
