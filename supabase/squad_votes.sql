-- Squad votes: what a squad decides together goes to a vote. Following and
-- unfollowing other squads, and going to (or skipping) their public plans.
-- Run once in the Supabase SQL editor, after schema.sql, push_notifications.sql
-- and parea_going.sql. Safe to run again. Replaces the "follow votes" tables:
-- every follow vote, open or closed, is copied over with its ballots.

-- ─── tables ───
create table if not exists public.squad_proposals (
  id              uuid        primary key default gen_random_uuid(),
  group_id        uuid        not null references public.groups(id) on delete cascade,
  kind            text        not null,
  target_group_id uuid        references public.groups(id) on delete cascade,
  target_event_id uuid        references public.events(id) on delete cascade,
  proposed_by     uuid        references public.profiles(id) on delete set null,
  status          text        not null default 'open',
  created_at      timestamptz not null default now(),
  closed_at       timestamptz,
  constraint squad_proposals_kind check (kind in ('follow', 'unfollow', 'attend', 'unattend')),
  constraint squad_proposals_status check (status in ('open', 'passed', 'rejected', 'cancelled', 'expired')),
  constraint squad_proposals_target check (
    (kind in ('follow', 'unfollow') and target_group_id is not null and target_event_id is null)
    or (kind in ('attend', 'unattend') and target_event_id is not null and target_group_id is null)
  ),
  constraint squad_proposals_not_self check (target_group_id is null or target_group_id <> group_id)
);

-- One open vote per squad and target.
create unique index if not exists squad_proposals_one_open_squad
  on public.squad_proposals (group_id, target_group_id) where status = 'open' and target_group_id is not null;
create unique index if not exists squad_proposals_one_open_event
  on public.squad_proposals (group_id, target_event_id) where status = 'open' and target_event_id is not null;
create index if not exists squad_proposals_group_idx
  on public.squad_proposals (group_id, status, created_at desc);

create table if not exists public.squad_ballots (
  proposal_id uuid        not null references public.squad_proposals(id) on delete cascade,
  user_id     uuid        not null references public.profiles(id) on delete cascade,
  approve     boolean     not null,
  voted_at    timestamptz not null default now(),
  primary key (proposal_id, user_id)
);

-- "This squad is going": written only by a passed attend vote.
-- It has its own id on purpose: with (group_id, event_id) as the primary key,
-- PostgREST reads it as a link table between events and groups, and every
-- events → groups embed in the app becomes ambiguous (PGRST201).
create table if not exists public.squad_event_going (
  id         uuid        primary key default gen_random_uuid(),
  group_id   uuid        not null references public.groups(id) on delete cascade,
  event_id   uuid        not null references public.events(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint squad_event_going_one unique (group_id, event_id)
);
create index if not exists squad_event_going_event_idx on public.squad_event_going (event_id);

-- Databases that got the first version of this file (keyed on the pair).
do $going_key$
begin
  if not exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'squad_event_going' and column_name = 'id'
  ) then
    alter table public.squad_event_going drop constraint squad_event_going_pkey;
    alter table public.squad_event_going add column id uuid not null default gen_random_uuid() primary key;
    alter table public.squad_event_going add constraint squad_event_going_one unique (group_id, event_id);
  end if;
end
$going_key$;

alter table public.squad_proposals   enable row level security;
alter table public.squad_ballots     enable row level security;
alter table public.squad_event_going enable row level security;

-- Members read their squad's votes. Nobody writes these tables directly:
-- proposing, voting and cancelling all go through the functions below.
drop policy if exists "read votes of my squads" on public.squad_proposals;
create policy "read votes of my squads" on public.squad_proposals
  for select to authenticated
  using (group_id in (select public.my_group_ids()));

drop policy if exists "read ballots of my squads" on public.squad_ballots;
create policy "read ballots of my squads" on public.squad_ballots
  for select to authenticated
  using (
    proposal_id in (
      select id from public.squad_proposals where group_id in (select public.my_group_ids())
    )
  );

-- Who is going shows on public plans for everyone, and on any plan for its squads.
drop policy if exists "read going squads" on public.squad_event_going;
create policy "read going squads" on public.squad_event_going
  for select to authenticated
  using (
    group_id in (select public.my_group_ids())
    or exists (
      select 1 from public.events e
       where e.id = squad_event_going.event_id and e.is_public and e.date >= current_date
    )
  );

-- ─── carry the follow votes over ───
do $migrate$
begin
  if to_regclass('public.squad_follow_proposals') is not null then
    insert into public.squad_proposals
      (id, group_id, kind, target_group_id, proposed_by, status, created_at, closed_at)
    select id, group_id, action, target_group_id, proposed_by, status, created_at, closed_at
      from public.squad_follow_proposals
    on conflict (id) do nothing;

    insert into public.squad_ballots (proposal_id, user_id, approve, voted_at)
    select proposal_id, user_id, approve, voted_at
      from public.squad_follow_ballots
    on conflict (proposal_id, user_id) do nothing;
  end if;
end
$migrate$;

drop function if exists public.propose_follow(uuid, uuid, text);
drop function if exists public.vote_follow(uuid, boolean);
drop function if exists public.cancel_follow_proposal(uuid);
drop function if exists public.resolve_follow_proposal(uuid);
drop table if exists public.squad_follow_ballots;
drop table if exists public.squad_follow_proposals;

-- Follows only happen through a vote (repeated so this file stands alone).
drop policy if exists "follow as my squad" on public.squad_follows;
drop policy if exists "unfollow as my squad" on public.squad_follows;

-- ─── pushes ───
-- 'opened': the other members hear there is something to vote on.
-- 'passed': for a passed attend vote, every member hears the squad is going.
create or replace function public.notify_proposal(p_id uuid, p_moment text)
returns void language plpgsql security definer set search_path to 'public' as $function$
declare
  v public.squad_proposals%rowtype;
  e public.events%rowtype;
  squad text;
  proposer text;
  target text;
  starts text;
  push_title text;
  push_body text;
  payload jsonb;
  notifications jsonb;
begin
  if public.push_is_quiet(now()) then
    return;
  end if;

  select * into v from public.squad_proposals where id = p_id;
  if not found then
    return;
  end if;

  select name into squad from public.groups where id = v.group_id;
  select coalesce(display_name, 'Someone') into proposer from public.profiles where id = v.proposed_by;
  proposer := coalesce(proposer, 'Someone');

  if v.target_event_id is not null then
    select * into e from public.events where id = v.target_event_id;
    starts := to_char(e.date, 'Dy DD Mon') || coalesce(' · ' || to_char(e.start_time, 'HH24:MI'), '');
  else
    select name into target from public.groups where id = v.target_group_id;
  end if;

  if p_moment = 'opened' then
    push_title := '🗳️ ' || squad;
    push_body := proposer || ' wants ' || squad || case v.kind
      when 'follow'   then ' to follow ' || target
      when 'unfollow' then ' to unfollow ' || target
      when 'attend'   then ' to go to ' || e.title || ' · ' || starts
      else ' to skip ' || e.title
    end || '. Vote now';
    payload := jsonb_build_object('type', 'votes', 'groupId', v.group_id);
  elsif p_moment = 'passed' and v.kind = 'attend' then
    push_title := '📅 ' || e.title;
    push_body := squad || ' is going · ' || starts || '. Are you in?';
    payload := jsonb_build_object('type', 'event', 'groupId', e.group_id, 'eventId', e.id);
  else
    return;
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
           'to', t.token,
           'sound', 'default',
           'channelId', 'default',
           'title', push_title,
           'body', push_body,
           'data', payload
         )), '[]'::jsonb)
    into notifications
    from public.group_members m
    join public.push_tokens t on t.user_id = m.user_id
   where m.group_id = v.group_id
     and (p_moment <> 'opened' or m.user_id is distinct from v.proposed_by);

  if jsonb_array_length(notifications) > 0 then
    perform public.send_pushes(notifications);
  end if;
end $function$;

revoke all on function public.notify_proposal(uuid, text) from public, anon, authenticated;

-- ─── votes ───
-- Open votes on plans whose day has gone close as expired.
create or replace function public.expire_old_votes(p_group_id uuid)
returns void language sql security definer set search_path to 'public' as $function$
  update public.squad_proposals p
     set status = 'expired', closed_at = now()
    from public.events e
   where p.target_event_id = e.id
     and p.group_id = p_group_id
     and p.status = 'open'
     and e.date < current_date;
$function$;

revoke all on function public.expire_old_votes(uuid) from public, anon, authenticated;

-- Counts the ballots of the squad's current members and closes the vote when
-- it is decided, applying the change. Returns the status afterwards.
create or replace function public.resolve_proposal(p_id uuid)
returns text language plpgsql security definer set search_path to 'public' as $function$
declare
  v public.squad_proposals%rowtype;
  v_event_date date;
  v_host uuid;
  v_members integer;
  v_yes integer;
  v_no integer;
begin
  select * into v from public.squad_proposals where id = p_id for update;
  if not found then
    return null;
  end if;
  if v.status <> 'open' then
    return v.status;
  end if;

  if v.target_event_id is not null then
    select date, group_id into v_event_date, v_host from public.events where id = v.target_event_id;
    if v_event_date < current_date then
      update public.squad_proposals set status = 'expired', closed_at = now() where id = p_id;
      return 'expired';
    end if;
  end if;

  select count(*) into v_members from public.group_members where group_id = v.group_id;

  select count(*) filter (where b.approve), count(*) filter (where not b.approve)
    into v_yes, v_no
    from public.squad_ballots b
    join public.group_members m on m.group_id = v.group_id and m.user_id = b.user_id
   where b.proposal_id = p_id;

  if v_yes * 2 > v_members then
    if v.kind = 'follow' then
      insert into public.squad_follows (follower_group_id, followed_group_id, created_by)
      values (v.group_id, v.target_group_id, v.proposed_by)
      on conflict do nothing;
    elsif v.kind = 'unfollow' then
      delete from public.squad_follows
       where follower_group_id = v.group_id and followed_group_id = v.target_group_id;
    elsif v.kind = 'attend' then
      insert into public.squad_event_going (group_id, event_id)
      values (v.group_id, v.target_event_id)
      on conflict do nothing;
    else
      delete from public.squad_event_going
       where group_id = v.group_id and event_id = v.target_event_id;

      -- Answers this squad covered go too, unless another squad of theirs
      -- (or the host squad) still covers them.
      delete from public.event_attendees a
       where a.event_id = v.target_event_id
         and a.user_id in (select user_id from public.group_members where group_id = v.group_id)
         and not exists (
           select 1 from public.group_members h
            where h.group_id = v_host and h.user_id = a.user_id
         )
         and not exists (
           select 1 from public.squad_event_going g
             join public.group_members gm on gm.group_id = g.group_id
            where g.event_id = v.target_event_id and gm.user_id = a.user_id
         );
    end if;

    update public.squad_proposals set status = 'passed', closed_at = now() where id = p_id;
    perform public.notify_proposal(p_id, 'passed');
    return 'passed';
  end if;

  -- The members still to vote can no longer make a majority.
  if (v_members - v_no) * 2 <= v_members then
    update public.squad_proposals set status = 'rejected', closed_at = now() where id = p_id;
    return 'rejected';
  end if;

  return 'open';
end;
$function$;

revoke all on function public.resolve_proposal(uuid) from public, anon, authenticated;

create or replace function public.propose(p_group_id uuid, p_kind text, p_target_id uuid)
returns public.squad_proposals
language plpgsql security definer set search_path to 'public' as $function$
declare
  v public.squad_proposals%rowtype;
  e public.events%rowtype;
  v_on boolean;
  v_new boolean := false;
begin
  if auth.uid() is null or not exists (
    select 1 from public.group_members where group_id = p_group_id and user_id = auth.uid()
  ) then
    raise exception 'Only members can put something to the vote.';
  end if;

  if p_kind is null or p_kind not in ('follow', 'unfollow', 'attend', 'unattend') then
    raise exception 'A vote is to follow, unfollow, go or skip.';
  end if;

  perform public.expire_old_votes(p_group_id);

  if p_kind in ('follow', 'unfollow') then
    if p_group_id = p_target_id then
      raise exception 'A squad cannot follow itself.';
    end if;
    if not exists (select 1 from public.groups where id = p_target_id) then
      raise exception 'That squad does not exist.';
    end if;

    v_on := exists (
      select 1 from public.squad_follows
       where follower_group_id = p_group_id and followed_group_id = p_target_id
    );
    if p_kind = 'follow' and v_on then
      raise exception 'Your squad already follows them.';
    end if;
    if p_kind = 'unfollow' and not v_on then
      raise exception 'Your squad does not follow them.';
    end if;

    select * into v from public.squad_proposals
     where group_id = p_group_id and target_group_id = p_target_id and status = 'open';
  else
    select * into e from public.events where id = p_target_id;
    if not found or not e.is_public then
      raise exception 'Only public plans can be put to the vote.';
    end if;
    if e.group_id = p_group_id then
      raise exception 'This is your own squad''s plan.';
    end if;
    if e.date < current_date then
      raise exception 'That plan is over.';
    end if;

    v_on := exists (
      select 1 from public.squad_event_going where group_id = p_group_id and event_id = p_target_id
    );
    if p_kind = 'attend' and v_on then
      raise exception 'Your squad is already going.';
    end if;
    if p_kind = 'unattend' and not v_on then
      raise exception 'Your squad is not going.';
    end if;

    select * into v from public.squad_proposals
     where group_id = p_group_id and target_event_id = p_target_id and status = 'open';
  end if;

  -- Proposing again while a vote is open is simply a yes on that vote.
  if not found then
    insert into public.squad_proposals (group_id, kind, target_group_id, target_event_id, proposed_by)
    values (
      p_group_id,
      p_kind,
      case when p_kind in ('follow', 'unfollow') then p_target_id end,
      case when p_kind in ('attend', 'unattend') then p_target_id end,
      auth.uid()
    )
    returning * into v;
    v_new := true;
  end if;

  insert into public.squad_ballots (proposal_id, user_id, approve)
  values (v.id, auth.uid(), true)
  on conflict (proposal_id, user_id) do update set approve = true, voted_at = now();

  if public.resolve_proposal(v.id) = 'open' and v_new then
    perform public.notify_proposal(v.id, 'opened');
  end if;

  select * into v from public.squad_proposals where id = v.id;
  return v;
end;
$function$;

revoke all on function public.propose(uuid, text, uuid) from public;
grant execute on function public.propose(uuid, text, uuid) to authenticated;

create or replace function public.vote(p_proposal_id uuid, p_approve boolean)
returns public.squad_proposals
language plpgsql security definer set search_path to 'public' as $function$
declare
  v public.squad_proposals%rowtype;
begin
  select * into v from public.squad_proposals where id = p_proposal_id;

  if not found or auth.uid() is null or not exists (
    select 1 from public.group_members where group_id = v.group_id and user_id = auth.uid()
  ) then
    raise exception 'Only members can vote.';
  end if;

  if p_approve is null then
    raise exception 'A vote is yes or no.';
  end if;

  if v.status <> 'open' then
    raise exception 'That vote is closed.';
  end if;

  insert into public.squad_ballots (proposal_id, user_id, approve)
  values (v.id, auth.uid(), p_approve)
  on conflict (proposal_id, user_id) do update set approve = excluded.approve, voted_at = now();

  perform public.resolve_proposal(v.id);

  select * into v from public.squad_proposals where id = v.id;
  return v;
end;
$function$;

revoke all on function public.vote(uuid, boolean) from public;
grant execute on function public.vote(uuid, boolean) to authenticated;

create or replace function public.cancel_proposal(p_proposal_id uuid)
returns void language plpgsql security definer set search_path to 'public' as $function$
begin
  update public.squad_proposals
     set status = 'cancelled', closed_at = now()
   where id = p_proposal_id and status = 'open' and proposed_by = auth.uid();

  if not found then
    raise exception 'Only the member who opened an open vote can cancel it.';
  end if;
end;
$function$;

revoke all on function public.cancel_proposal(uuid) from public;
grant execute on function public.cancel_proposal(uuid) to authenticated;

-- The old names, for app builds that still call them.
create or replace function public.propose_follow(p_group_id uuid, p_target_id uuid, p_action text)
returns public.squad_proposals
language plpgsql security invoker set search_path to 'public' as $function$
begin
  if p_action is null or p_action not in ('follow', 'unfollow') then
    raise exception 'A vote is to follow or to unfollow.';
  end if;
  return public.propose(p_group_id, p_action, p_target_id);
end;
$function$;

create or replace function public.vote_follow(p_proposal_id uuid, p_approve boolean)
returns public.squad_proposals
language sql security invoker set search_path to 'public' as $function$
  select * from public.vote(p_proposal_id, p_approve);
$function$;

create or replace function public.cancel_follow_proposal(p_proposal_id uuid)
returns void
language sql security invoker set search_path to 'public' as $function$
  select public.cancel_proposal(p_proposal_id);
$function$;

revoke all on function public.propose_follow(uuid, uuid, text) from public;
revoke all on function public.vote_follow(uuid, boolean) from public;
revoke all on function public.cancel_follow_proposal(uuid) from public;
grant execute on function public.propose_follow(uuid, uuid, text) to authenticated;
grant execute on function public.vote_follow(uuid, boolean) to authenticated;
grant execute on function public.cancel_follow_proposal(uuid) to authenticated;

-- ─── who can answer a plan ───
-- Your own squads' plans, and public plans a squad of yours is going to.
create or replace function public.can_answer_event(p_event_id uuid)
returns boolean language sql stable security definer set search_path to 'public' as $function$
  select exists (
           select 1 from public.events e
             join public.group_members m on m.group_id = e.group_id
            where e.id = p_event_id and m.user_id = auth.uid()
         )
      or exists (
           select 1 from public.squad_event_going g
             join public.group_members m on m.group_id = g.group_id
            where g.event_id = p_event_id and m.user_id = auth.uid()
         );
$function$;

revoke all on function public.can_answer_event(uuid) from public;
grant execute on function public.can_answer_event(uuid) to authenticated;

drop policy if exists "write only my own answer"     on public.event_attendees;
drop policy if exists "read my own answer"           on public.event_attendees;
drop policy if exists "answer plans i can go to"     on public.event_attendees;
drop policy if exists "change my answer"             on public.event_attendees;
drop policy if exists "remove my own answer"         on public.event_attendees;

create policy "read my own answer" on public.event_attendees
  for select to authenticated
  using (user_id = auth.uid());

create policy "answer plans i can go to" on public.event_attendees
  for insert to authenticated
  with check (user_id = auth.uid() and public.can_answer_event(event_id));

create policy "change my answer" on public.event_attendees
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and public.can_answer_event(event_id));

create policy "remove my own answer" on public.event_attendees
  for delete to authenticated
  using (user_id = auth.uid());

-- ─── "your parea is going" ───
-- Same as parea_going.sql, but leaves out plans a squad of yours already goes
-- to: those are in your week already.
create or replace function public.parea_going()
returns table (
  event_id     uuid,
  title        text,
  date         date,
  start_time   time,
  end_time     time,
  location     text,
  place_label  text,
  description  text,
  lat          float8,
  lng          float8,
  cover_url    text,
  group_id     uuid,
  group_name   text,
  going_count  int,
  friends      jsonb,
  via_groups   uuid[]
)
language sql stable security definer set search_path to 'public' as $function$
  with mine as (
    select m.group_id from public.group_members m where m.user_id = auth.uid()
  ),
  friends as (
    select distinct m.user_id, m.group_id
      from public.group_members m
     where m.group_id in (select group_id from mine)
       and m.user_id <> auth.uid()
  ),
  picks as (
    select a.event_id,
           jsonb_agg(distinct jsonb_build_object(
             'id', p.id, 'name', p.display_name, 'avatarUrl', p.avatar_url
           )) as friends,
           array_agg(distinct f.group_id) as via_groups
      from public.event_attendees a
      join friends f on f.user_id = a.user_id
      join public.profiles p on p.id = a.user_id
     where a.status = 'in'
     group by a.event_id
  )
  select e.id, e.title, e.date, e.start_time, e.end_time, e.location, e.place_label,
         e.description, e.lat, e.lng, e.cover_url, e.group_id, g.name,
         (select count(*)::int from public.event_attendees x
           where x.event_id = e.id and x.status = 'in'),
         k.friends, k.via_groups
    from picks k
    join public.events e on e.id = k.event_id
    join public.groups g on g.id = e.group_id
   where e.is_public
     and e.date >= current_date
     and e.group_id not in (select group_id from mine)
     and not exists (
       select 1 from public.event_attendees x
        where x.event_id = e.id and x.user_id = auth.uid()
     )
     and not exists (
       select 1 from public.squad_event_going sg
        where sg.event_id = e.id and sg.group_id in (select group_id from mine)
     )
   order by e.date, e.start_time nulls first
   limit 20;
$function$;

-- PostgREST picks up the new tables, functions and keys straight away.
notify pgrst, 'reload schema';
