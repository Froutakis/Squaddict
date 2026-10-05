import { useCallback, useEffect, useRef, useState } from 'react';
import { getMyEvents, type MyEvent } from '../../services/serviceEvents';
import { getPhotoFeed, type FeedPhoto } from '../../services/servicePhotoFeed';
import { getVotes, type SquadVote } from '../../services/serviceVotes';

export type ChatEventData = {
  plans: MyEvent[];
  openVotes: SquadVote[];
  decidedVotes: SquadVote[];
  memories: FeedPhoto[];
};

const NONE: ChatEventData = { plans: [], openVotes: [], decidedVotes: [], memories: [] };

// The parea's plans, votes and memories, for the tickets in its chat. Each
// one is read on its own and quietly left out when it can't be (an SQL file
// not installed yet, no connection): the chat works without them.
export function useChatEvents(groupId: string | null, userId: string) {
  const [data, setData] = useState<ChatEventData>(NONE);
  const forRef = useRef<string | null>(groupId);
  forRef.current = groupId;

  const reload = useCallback(
    async function reload() {
      if (!groupId) {
        setData(NONE);
        return;
      }
      const forGroup = groupId;
      const [plans, votes, memories] = await Promise.all([
        getMyEvents(userId).catch(() => null),
        getVotes(forGroup, userId).catch(() => null),
        getPhotoFeed(forGroup).catch(() => null),
      ]);
      if (forRef.current !== forGroup) return;
      setData((prev) => ({
        plans: plans ?? prev.plans,
        openVotes: votes ? votes.open : prev.openVotes,
        decidedVotes: votes ? votes.decided : prev.decidedVotes,
        memories: memories ?? prev.memories,
      }));
    },
    [groupId, userId],
  );

  useEffect(() => {
    setData(NONE);
    reload();
  }, [reload]);

  // Answering a plan shows at once; the caller puts it back if saving fails.
  const setPlans = useCallback(function setPlans(update: (plans: MyEvent[]) => MyEvent[]) {
    setData((prev) => ({ ...prev, plans: update(prev.plans) }));
  }, []);

  return { ...data, reload, setPlans };
}
