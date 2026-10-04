import { useEffect, useState } from 'react';
import { getGroupsForUser, type Group } from '../../services/serviceGroup';
import { getActingGroupId } from '../../services/serviceUser';
import { castVote, getMyGoing, getOpenEventVotes, propose, type SquadVote } from '../../services/serviceVotes';
import { pickActing } from '../../lib/acting';
import { planStance, type PlanStance, type SquadRef } from '../../lib/squadVote';

export type PlanRef = { id: string; groupId: string };

function toRef(group: Group): SquadRef {
  return { id: group.id, name: group.name, memberCount: group.memberCount };
}

// For a list of plans: what this member can do on each (answer, or put it to
// the acting squad's vote), and the actions that change it.
export function useSquadPlans(userId: string, plans: PlanRef[]) {
  const [myGroups, setMyGroups] = useState<Group[] | null>(null);
  const [acting, setActing] = useState<Group | null>(null);
  const [going, setGoing] = useState<Record<string, string[]>>({});
  const [votes, setVotes] = useState<Record<string, SquadVote>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let cancelled = false;
    Promise.all([getGroupsForUser(userId), getActingGroupId(userId).catch(() => null)])
      .then(function ([groups, actingId]) {
        if (cancelled) return;
        setMyGroups(groups);
        setActing(pickActing(groups, actingId));
      })
      .catch(function () {
        if (!cancelled) setMyGroups([]);
      });
    return function cleanup() {
      cancelled = true;
    };
  }, [userId]);

  const mine = new Set((myGroups ?? []).map((group) => group.id));
  const foreignKey = plans
    .filter((plan) => !mine.has(plan.groupId))
    .map((plan) => plan.id)
    .sort()
    .join(',');
  const mineKey = [...mine].sort().join(',');

  useEffect(() => {
    if (myGroups === null) return;
    if (foreignKey === '') {
      setGoing({});
      setVotes({});
      return;
    }

    let cancelled = false;
    const ids = foreignKey.split(',');
    Promise.all([
      getMyGoing(mineKey === '' ? [] : mineKey.split(','), ids),
      acting ? getOpenEventVotes(acting.id, ids, userId) : Promise.resolve({} as Record<string, SquadVote>),
    ])
      .then(function ([goingNow, votesNow]) {
        if (cancelled) return;
        setGoing(goingNow);
        setVotes(votesNow);
      })
      .catch(function () {});
    return function cleanup() {
      cancelled = true;
    };
  }, [myGroups, foreignKey, mineKey, acting?.id, userId, nonce]);

  function stanceFor(plan: PlanRef): PlanStance | null {
    if (myGroups === null) return null;
    const vote = votes[plan.id];
    return planStance({
      hostGroupId: plan.groupId,
      myGroups: myGroups.map(toRef),
      acting: acting ? toRef(acting) : null,
      goingGroupIds: going[plan.id] ?? [],
      vote: vote ? { kind: vote.kind, myVote: vote.myVote, yes: vote.yes } : null,
    });
  }

  async function run(planId: string, action: () => Promise<unknown>): Promise<boolean> {
    if (busyId) return false;
    setBusyId(planId);
    setError(null);
    try {
      await action();
      setNonce((n) => n + 1);
      return true;
    } catch {
      setError('Could not put that to the vote. Try again.');
      return false;
    } finally {
      setBusyId(null);
    }
  }

  // "Go with MVPS?": opens the attend vote, or says yes to the open one.
  function act(plan: PlanRef): Promise<boolean> {
    const vote = votes[plan.id];
    if (!acting) return Promise.resolve(false);
    return run(plan.id, () =>
      vote && vote.kind === 'attend' ? castVote(vote.id, true) : propose(acting.id, 'attend', plan.id),
    );
  }

  // "Vote to skip": opens the unattend vote, or says yes to the open one.
  function skip(plan: PlanRef): Promise<boolean> {
    const vote = votes[plan.id];
    if (!acting) return Promise.resolve(false);
    return run(plan.id, () =>
      vote && vote.kind === 'unattend' ? castVote(vote.id, true) : propose(acting.id, 'unattend', plan.id),
    );
  }

  return { stanceFor, act, skip, busyId, error, reload: () => setNonce((n) => n + 1) };
}
