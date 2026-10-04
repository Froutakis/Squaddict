import { useEffect, useState } from 'react';
import type { Person } from '../../lib/people';
import { openLiveMap, type LivePerson } from '../../services/serviceLiveLocation';

// Everyone sharing their spot on any of these plans, merged by person. It only
// watches: your own spot is shared from the plan itself, never from here.
export function useLivePeopleAround(eventIds: string[], me: Person): LivePerson[] {
  const [byEvent, setByEvent] = useState<Record<string, LivePerson[]>>({});
  const key = [...eventIds].sort().join(',');

  useEffect(() => {
    setByEvent({});
    if (key === '' || !me.id) return;

    const maps = key.split(',').map((eventId) =>
      openLiveMap(eventId, me, (people) => setByEvent((all) => ({ ...all, [eventId]: people }))),
    );

    return () => maps.forEach((map) => map.close());
  }, [key, me.id, me.name]);

  const merged = new Map<string, LivePerson>();
  for (const people of Object.values(byEvent)) {
    for (const person of people) merged.set(person.id, person);
  }
  return [...merged.values()];
}
