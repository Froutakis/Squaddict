-- Squad votes: what a squad decides together goes to a vote. Following and
-- unfollowing other squads, going to (or skipping) their public plans, a
-- question of its own, inviting someone, removing a member, and the squad's
-- name, photo and public memories. New members only come in through a passed
-- invite vote, with a link that works once.
-- Run once in the Supabase SQL editor, after schema.sql, push_notifications.sql
-- and parea_going.sql. Safe to run again. Replaces the "follow votes" tables:
-- every follow vote, open or closed, is copied over with its ballots.
-- It also takes over join_squad, update_squad_look and the "join as self",
-- "leave squad", "creator updates squad" and "creator deletes squad" policies
-- from schema.sql: if you run schema.sql again, run this file after it, or the
-- open invite codes come back.

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

-- ─── decisions beyond follows and plans ───
-- target_user_id: the member a remove vote is about. payload: what the vote
-- needs to say and apply ({question, winner}, {name}, {url}, {public}).
alter table public.squad_proposals
  add column if not exists target_user_id uuid references public.profiles(id) on delete cascade;
alter table public.squad_proposals
  add column if not exists payload jsonb not null default '{}'::jsonb;

alter table public.squad_proposals drop constraint if exists squad_proposals_kind;
alter table public.squad_proposals add constraint squad_proposals_kind check (
  kind in ('follow', 'unfollow', 'attend', 'unattend', 'poll', 'invite', 'remove', 'rename', 'photo', 'memories')
);
alter table public.squad_proposals drop constraint if exists squad_proposals_target;
alter table public.squad_proposals add constraint squad_proposals_target check (
  (kind in ('follow', 'unfollow')
     and target_group_id is not null and target_event_id is null and target_user_id is null)
  or (kind in ('attend', 'unattend')
     and target_event_id is not null and target_group_id is null and target_user_id is null)
  or (kind = 'remove'
     and target_user_id is not null and target_group_id is null and target_event_id is null)
  or (kind in ('poll', 'invite', 'rename', 'photo', 'memories')
     and target_group_id is null and target_event_id is null and target_user_id is null)
);

-- One open vote per member to remove, and one per setting.
create unique index if not exists squad_proposals_one_open_member
  on public.squad_proposals (group_id, target_user_id) where status = 'open' and target_user_id is not null;
create unique index if not exists squad_proposals_one_open_setting
  on public.squad_proposals (group_id, kind) where status = 'open' and kind in ('rename', 'photo', 'memories');

-- The choices of a question.
create table if not exists public.squad_proposal_options (
  id          uuid     primary key default gen_random_uuid(),
  proposal_id uuid     not null references public.squad_proposals(id) on delete cascade,
  label       text     not null,
  position    smallint not null,
  constraint squad_proposal_options_label check (char_length(label) between 1 and 60),
  constraint squad_proposal_options_one_position unique (proposal_id, position)
);

-- A ballot is a yes / no, or (on a question) one of its choices.
alter table public.squad_ballots alter column approve drop not null;
alter table public.squad_ballots
  add column if not exists option_id uuid references public.squad_proposal_options(id) on delete cascade;
alter table public.squad_ballots drop constraint if exists squad_ballots_one_answer;
alter table public.squad_ballots add constraint squad_ballots_one_answer check ((approve is null) <> (option_id is null));

-- The link a passed invite vote makes. It works once.
create table if not exists public.squad_invite_links (
  code         text        primary key,
  group_id     uuid        not null references public.groups(id) on delete cascade,
  proposal_id  uuid        not null unique references public.squad_proposals(id) on delete cascade,
  invitee_name text        not null,
  used_by      uuid        references public.profiles(id) on delete set null,
  used_at      timestamptz,
  created_at   timestamptz not null default now(),
  constraint squad_invite_links_code check (code ~ '^[A-Z0-9]{10}$')
);
create index if not exists squad_invite_links_group_idx on public.squad_invite_links (group_id);

alter table public.squad_proposals        enable row level security;
alter table public.squad_ballots          enable row level security;
alter table public.squad_event_going      enable row level security;
alter table public.squad_proposal_options enable row level security;
alter table public.squad_invite_links     enable row level security;

drop policy if exists "read options of my squads" on public.squad_proposal_options;
create policy "read options of my squads" on public.squad_proposal_options
  for select to authenticated
  using (
    proposal_id in (
      select id from public.squad_proposals where group_id in (select public.my_group_ids())
    )
  );

drop policy if exists "read invite links of my squads" on public.squad_invite_links;
create policy "read invite links of my squads" on public.squad_invite_links
  for select to authenticated
  using (group_id in (select public.my_group_ids()));

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
  elsif v.target_group_id is not null then
    select name into target from public.groups where id = v.target_group_id;
  elsif v.target_user_id is not null then
    select display_name into target from public.profiles where id = v.target_user_id;
    target := coalesce(target, 'a member');
  end if;

  if p_moment = 'opened' then
    push_title := '🗳️ ' || squad;
    push_body := proposer || case v.kind
      when 'follow'   then ' wants ' || squad || ' to follow ' || target
      when 'unfollow' then ' wants ' || squad || ' to unfollow ' || target
      when 'attend'   then ' wants ' || squad || ' to go to ' || e.title || ' · ' || starts
      when 'unattend' then ' wants ' || squad || ' to skip ' || e.title
      when 'poll'     then ' asks: ' || (v.payload->>'question')
      when 'invite'   then ' wants to invite ' || (v.payload->>'name') || ' to ' || squad
      when 'remove'   then ' wants ' || squad || ' to remove ' || target
      when 'rename'   then ' wants to rename ' || squad || ' to ' || (v.payload->>'name')
      when 'photo'    then ' wants a new photo for ' || squad
      else ' wants ' || squad || '''s memories '
             || case when (v.payload->>'public')::boolean then 'public' else 'private' end
    end || '. Vote now';
    payload := jsonb_build_object('type', 'votes', 'groupId', v.group_id);
  elsif p_moment = 'passed' and v.kind = 'attend' then
    push_title := '📅 ' || e.title;
    push_body := squad || ' is going · ' || starts || '. Are you in?';
    payload := jsonb_build_object('type', 'event', 'groupId', e.group_id, 'eventId', e.id);
  elsif p_moment = 'passed' and v.kind = 'poll' then
    push_title := '🗳️ ' || squad;
    push_body := (v.payload->>'question') || ' → ' || (v.payload->>'winner');
    payload := jsonb_build_object('type', 'votes', 'groupId', v.group_id);
  elsif p_moment = 'passed' and v.kind = 'invite' then
    push_title := '🗳️ ' || squad;
    push_body := squad || ' said yes to ' || (v.payload->>'name') || '. Send them the invite';
    payload := jsonb_build_object('type', 'votes', 'groupId', v.group_id);
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
     and (p_moment <> 'opened' or m.user_id is distinct from v.proposed_by)
     -- A member up for removal is not asked to vote on it.
     and m.user_id is distinct from v.target_user_id;

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
  v_voted integer;
  v_top_id uuid;
  v_top_label text;
  v_top integer;
  v_second integer;
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

  -- A member up for removal does not vote on it, and is not counted. If they
  -- have left already, there is nothing left to decide.
  if v.kind = 'remove' then
    if not exists (
      select 1 from public.group_members where group_id = v.group_id and user_id = v.target_user_id
    ) then
      update public.squad_proposals set status = 'cancelled', closed_at = now() where id = p_id;
      return 'cancelled';
    end if;
    v_members := v_members - 1;
  end if;

  -- A question: a choice wins with more than half of the members, or, once
  -- everyone has answered, the choice with the most votes. A tie decides nothing.
  if v.kind = 'poll' then
    select count(*) into v_voted
      from public.squad_ballots b
      join public.group_members m on m.group_id = v.group_id and m.user_id = b.user_id
     where b.proposal_id = p_id;

    with tallies as (
      select o.id, o.label, o.position, count(m.user_id)::int as n
        from public.squad_proposal_options o
        left join public.squad_ballots b on b.option_id = o.id
        left join public.group_members m on m.group_id = v.group_id and m.user_id = b.user_id
       where o.proposal_id = p_id
       group by o.id, o.label, o.position
    )
    select id, label, n into v_top_id, v_top_label, v_top from tallies order by n desc, position limit 1;

    select count(m.user_id)::int into v_second
      from public.squad_proposal_options o
      left join public.squad_ballots b on b.option_id = o.id
      left join public.group_members m on m.group_id = v.group_id and m.user_id = b.user_id
     where o.proposal_id = p_id and o.id <> v_top_id
     group by o.id
     order by 1 desc
     limit 1;

    if v_top * 2 > v_members or (v_voted >= v_members and v_top > coalesce(v_second, 0)) then
      update public.squad_proposals
         set status = 'passed', closed_at = now(),
             payload = payload || jsonb_build_object('winner', v_top_label, 'winnerId', v_top_id)
       where id = p_id;
      perform public.notify_proposal(p_id, 'passed');
      return 'passed';
    end if;

    if v_voted >= v_members then
      update public.squad_proposals set status = 'rejected', closed_at = now() where id = p_id;
      return 'rejected';
    end if;

    return 'open';
  end if;

  select count(*) filter (where b.approve), count(*) filter (where not b.approve)
    into v_yes, v_no
    from public.squad_ballots b
    join public.group_members m on m.group_id = v.group_id and m.user_id = b.user_id
   where b.proposal_id = p_id
     and b.user_id is distinct from v.target_user_id;

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
    elsif v.kind = 'unattend' then
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
    elsif v.kind = 'invite' then
      insert into public.squad_invite_links (code, group_id, proposal_id, invitee_name)
      values (public.new_invite_code(), v.group_id, v.id, v.payload->>'name')
      on conflict (proposal_id) do nothing;
    elsif v.kind = 'remove' then
      delete from public.group_members where group_id = v.group_id and user_id = v.target_user_id;
      -- A removed creator keeps no say over the squad (see lock_voted_squad_fields).
      perform set_config('squaddict.by_vote', 'on', true);
      update public.groups set created_by = null
       where id = v.group_id and created_by = v.target_user_id;
      perform set_config('squaddict.by_vote', 'off', true);
    else
      -- The name, photo and public memories only change here (see lock_voted_squad_fields).
      perform set_config('squaddict.by_vote', 'on', true);
      update public.groups
         set name            = case when v.kind = 'rename'   then v.payload->>'name' else name end,
             avatar_url      = case when v.kind = 'photo'    then v.payload->>'url' else avatar_url end,
             memories_public = case when v.kind = 'memories' then (v.payload->>'public')::boolean else memories_public end
       where id = v.group_id;
      perform set_config('squaddict.by_vote', 'off', true);
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

-- The first version took three arguments; the new ones have defaults, so the
-- old signature would make every call ambiguous.
drop function if exists public.propose(uuid, text, uuid);
drop function if exists public.vote(uuid, boolean);

-- Puts something to the squad's vote. p_target_id is the squad, plan or member
-- it is about; p_payload carries the rest:
--   poll     {question, options: [2-4 texts]}
--   invite   {name}
--   rename   {name}
--   photo    {url}       (uploaded to this squad's folder)
--   memories {public}
create or replace function public.propose(
  p_group_id  uuid,
  p_kind      text,
  p_target_id uuid  default null,
  p_payload   jsonb default null
)
returns public.squad_proposals
language plpgsql security definer set search_path to 'public' as $function$
declare
  v public.squad_proposals%rowtype;
  e public.events%rowtype;
  g public.groups%rowtype;
  v_on boolean;
  v_new boolean := false;
  v_text text;
  v_options jsonb;
  v_option text;
  v_position smallint := 0;
  v_payload jsonb := '{}'::jsonb;
  v_pattern text := '^https://[a-z0-9]+\.supabase\.co/storage/v1/object/public/squads/' || p_group_id::text || '/[A-Za-z0-9_.-]+$';
begin
  if auth.uid() is null or not exists (
    select 1 from public.group_members where group_id = p_group_id and user_id = auth.uid()
  ) then
    raise exception 'Only members can put something to the vote.';
  end if;

  if p_kind is null or p_kind not in
     ('follow', 'unfollow', 'attend', 'unattend', 'poll', 'invite', 'remove', 'rename', 'photo', 'memories') then
    raise exception 'That is not something a squad can vote on.';
  end if;

  perform public.expire_old_votes(p_group_id);
  select * into g from public.groups where id = p_group_id;

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
  elsif p_kind in ('attend', 'unattend') then
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
  elsif p_kind = 'remove' then
    if p_target_id is null or p_target_id = auth.uid() then
      raise exception 'Pick another member. To go yourself, leave the squad.';
    end if;
    if not exists (
      select 1 from public.group_members where group_id = p_group_id and user_id = p_target_id
    ) then
      raise exception 'They are not in this squad.';
    end if;

    select * into v from public.squad_proposals
     where group_id = p_group_id and target_user_id = p_target_id and status = 'open';
  elsif p_kind = 'poll' then
    v_text := btrim(coalesce(p_payload->>'question', ''));
    if char_length(v_text) not between 1 and 120 then
      raise exception 'A question is 1 to 120 characters.';
    end if;
    v_options := p_payload->'options';
    if v_options is null or jsonb_typeof(v_options) <> 'array' or jsonb_array_length(v_options) not between 2 and 4 then
      raise exception 'A question has 2 to 4 choices.';
    end if;
    for v_option in select btrim(value) from jsonb_array_elements_text(v_options) loop
      if char_length(v_option) not between 1 and 60 then
        raise exception 'Each choice is 1 to 60 characters.';
      end if;
    end loop;
    v_payload := jsonb_build_object('question', v_text);
    -- A question is always a new vote.
    v.id := null;
  elsif p_kind = 'invite' then
    v_text := btrim(coalesce(p_payload->>'name', ''));
    if char_length(v_text) not between 1 and 40 then
      raise exception 'Write who you want to invite (up to 40 characters).';
    end if;
    v_payload := jsonb_build_object('name', v_text);
    v.id := null;
  else
    -- A setting: one open vote on each at a time.
    if p_kind = 'rename' then
      v_text := btrim(coalesce(p_payload->>'name', ''));
      if char_length(v_text) not between 1 and 40 then
        raise exception 'A squad name is 1 to 40 characters.';
      end if;
      if v_text = g.name then
        raise exception 'That is the name already.';
      end if;
      v_payload := jsonb_build_object('name', v_text);
    elsif p_kind = 'photo' then
      v_text := coalesce(p_payload->>'url', '');
      if v_text !~ v_pattern or position('..' in v_text) > 0 then
        raise exception 'Squad photos must be uploaded to this squad.';
      end if;
      v_payload := jsonb_build_object('url', v_text);
    else
      if p_payload is null or jsonb_typeof(p_payload->'public') is distinct from 'boolean' then
        raise exception 'Say whether the memories should be public.';
      end if;
      if (p_payload->>'public')::boolean = g.memories_public then
        raise exception 'The memories are like that already.';
      end if;
      v_payload := jsonb_build_object('public', (p_payload->>'public')::boolean);
    end if;

    if exists (
      select 1 from public.squad_proposals where group_id = p_group_id and kind = p_kind and status = 'open'
    ) then
      raise exception 'There is already an open vote on that.';
    end if;
    v.id := null;
  end if;

  -- Proposing again while a vote is open is simply a yes on that vote.
  if v.id is null then
    insert into public.squad_proposals
      (group_id, kind, target_group_id, target_event_id, target_user_id, payload, proposed_by)
    values (
      p_group_id,
      p_kind,
      case when p_kind in ('follow', 'unfollow') then p_target_id end,
      case when p_kind in ('attend', 'unattend') then p_target_id end,
      case when p_kind = 'remove' then p_target_id end,
      v_payload,
      auth.uid()
    )
    returning * into v;
    v_new := true;

    if p_kind = 'poll' then
      for v_option in select btrim(value) from jsonb_array_elements_text(v_options) loop
        insert into public.squad_proposal_options (proposal_id, label, position)
        values (v.id, v_option, v_position);
        v_position := v_position + 1;
      end loop;
    end if;
  end if;

  -- Whoever asks is a yes, except on a question: there they pick like everyone.
  if p_kind <> 'poll' then
    insert into public.squad_ballots (proposal_id, user_id, approve)
    values (v.id, auth.uid(), true)
    on conflict (proposal_id, user_id) do update set approve = true, option_id = null, voted_at = now();
  end if;

  if public.resolve_proposal(v.id) = 'open' and v_new then
    perform public.notify_proposal(v.id, 'opened');
  end if;

  select * into v from public.squad_proposals where id = v.id;
  return v;
end;
$function$;

revoke all on function public.propose(uuid, text, uuid, jsonb) from public;
grant execute on function public.propose(uuid, text, uuid, jsonb) to authenticated;

-- Yes / no (p_approve), or a choice on a question (p_option_id).
create or replace function public.vote(p_proposal_id uuid, p_approve boolean default null, p_option_id uuid default null)
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

  if v.status <> 'open' then
    raise exception 'That vote is closed.';
  end if;

  if v.kind = 'remove' and v.target_user_id = auth.uid() then
    raise exception 'You do not vote on your own removal.';
  end if;

  if v.kind = 'poll' then
    if p_option_id is null or p_approve is not null or not exists (
      select 1 from public.squad_proposal_options where id = p_option_id and proposal_id = v.id
    ) then
      raise exception 'Pick one of the choices.';
    end if;
  elsif p_approve is null or p_option_id is not null then
    raise exception 'A vote is yes or no.';
  end if;

  insert into public.squad_ballots (proposal_id, user_id, approve, option_id)
  values (v.id, auth.uid(), p_approve, p_option_id)
  on conflict (proposal_id, user_id)
    do update set approve = excluded.approve, option_id = excluded.option_id, voted_at = now();

  perform public.resolve_proposal(v.id);

  select * into v from public.squad_proposals where id = v.id;
  return v;
end;
$function$;

revoke all on function public.vote(uuid, boolean, uuid) from public;
grant execute on function public.vote(uuid, boolean, uuid) to authenticated;

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

-- ─── what only a vote changes ───
-- The name, photo and public memories change in resolve_proposal, which turns
-- squaddict.by_vote on for that one update. Anyone else (a member through the
-- API, the creator through "creator updates squad") is stopped here. The SQL
-- editor has no auth.uid() and can still fix things by hand.
create or replace function public.lock_voted_squad_fields()
returns trigger language plpgsql security definer set search_path to 'public' as $function$
declare
  by_vote boolean := coalesce(current_setting('squaddict.by_vote', true), '') = 'on';
begin
  if auth.uid() is null then
    return new;
  end if;

  if not by_vote
     and (new.name is distinct from old.name
          or new.avatar_url is distinct from old.avatar_url
          or new.memories_public is distinct from old.memories_public) then
    raise exception 'The squad''s name, photo and public memories change through a vote.';
  end if;

  -- Who made the squad, when, and how many are in it are not anyone's to
  -- set: a creator who could put member_count back to 0 could join again
  -- without a vote ("join as self"). Depth 1 is an update sent straight from
  -- the app; the member count moves from the group_members trigger (depth 2)
  -- and a removal vote clears the creator under squaddict.by_vote.
  if pg_trigger_depth() = 1
     and (new.member_count is distinct from old.member_count
          or new.created_at is distinct from old.created_at
          or (new.created_by is distinct from old.created_by and not by_vote)) then
    raise exception 'That is not something a squad can change.';
  end if;

  return new;
end $function$;

drop trigger if exists groups_voted_fields_locked on public.groups;
create trigger groups_voted_fields_locked
  before update on public.groups
  for each row execute function public.lock_voted_squad_fields();

-- Same as schema.sql, but it only writes the banner and the wallpaper now:
-- the photo and public memories go through a vote. Taking the old values
-- back in also means a sheet left open while a photo vote passed cannot undo it.
create or replace function public.update_squad_look(
  p_group_id        uuid,
  p_avatar_url      text,
  p_banner_url      text,
  p_wallpaper_url   text,
  p_memories_public boolean
)
returns public.groups language plpgsql security definer set search_path to 'public' as $function$
declare
  pattern text := '^https://[a-z0-9]+\.supabase\.co/storage/v1/object/public/squads/' || p_group_id::text || '/[A-Za-z0-9_.-]+$';
  result public.groups;
begin
  if not exists (
    select 1 from public.group_members
     where group_id = p_group_id and user_id = auth.uid()
  ) then
    raise exception 'Only members can change how the squad looks.';
  end if;

  if (p_banner_url    is not null and p_banner_url    !~ pattern)
  or (p_wallpaper_url is not null and p_wallpaper_url !~ pattern)
  or position('..' in coalesce(p_banner_url,'') || coalesce(p_wallpaper_url,'')) > 0 then
    raise exception 'Squad images must be uploaded to this squad.';
  end if;

  update public.groups
     set banner_url    = p_banner_url,
         wallpaper_url = p_wallpaper_url
   where id = p_group_id
  returning * into result;

  return result;
end;
$function$;

revoke execute on function public.update_squad_look(uuid, text, text, text, boolean) from public, anon;
grant  execute on function public.update_squad_look(uuid, text, text, text, boolean) to authenticated;

-- ─── who is in a squad ───
-- New members only come in with the link of a passed invite vote, and it
-- works once. Members leave on their own, or are removed by a vote.
create or replace function public.join_squad(invite_code text)
returns public.groups language plpgsql security definer set search_path to 'public' as $function$
declare
  target public.groups;
  link public.squad_invite_links%rowtype;
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'Sign in to continue.';
  end if;

  select * into link
    from public.squad_invite_links
   where code = upper(trim(invite_code))
   for update;

  if not found then
    raise exception 'That invite is not valid.';
  end if;

  -- Opening it again once you're in: nothing to spend.
  if exists (select 1 from public.group_members where group_id = link.group_id and user_id = uid) then
    select g.* into target from public.groups g where g.id = link.group_id;
    return target;
  end if;

  -- used_at stays even if the account that used it is deleted.
  if link.used_at is not null then
    raise exception 'That invite was used already. Ask the squad for a new one.';
  end if;

  -- A link lasts a week (the app shows "Expires in N days" from the same rule).
  if link.created_at <= now() - interval '7 days' then
    raise exception 'That invite has expired. Ask the squad for a new one.';
  end if;

  insert into public.group_members (group_id, user_id)
  values (link.group_id, uid)
  on conflict do nothing;

  update public.squad_invite_links
     set used_by = uid, used_at = now()
   where code = link.code;

  select g.* into target from public.groups g where g.id = link.group_id;
  return target;
end $function$;

-- The open squad codes stop working: no codes left, and no way to make one.
delete from public.group_invites;
drop policy if exists "members rotate invite" on public.group_invites;
drop policy if exists "members revoke invite" on public.group_invites;
revoke all on function public.rotate_invite_code(uuid) from public, anon, authenticated;

-- Joining yourself is only for the creator of a brand-new squad (createGroup
-- adds them right after making it). Everyone else comes in through join_squad.
-- The hour also keeps a creator who left out of the empty squad later on.
drop policy if exists "join as self" on public.group_members;
create policy "join as self" on public.group_members
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.groups g
       where g.id = group_members.group_id
         and g.created_by = auth.uid()
         and g.member_count = 0
         and g.created_at > now() - interval '1 hour'
    )
  );

-- Same as schema.sql, plus: only while the creator is still in the squad.
-- created_by is cleared when a vote removes them (resolve_proposal), and
-- that null matches nobody here.
drop policy if exists "creator updates squad" on public.groups;
create policy "creator updates squad" on public.groups
  for update to authenticated
  using (created_by = auth.uid() and id in (select public.my_group_ids()))
  with check (created_by = auth.uid() and id in (select public.my_group_ids()));

drop policy if exists "creator deletes squad" on public.groups;
create policy "creator deletes squad" on public.groups
  for delete to authenticated
  using (created_by = auth.uid() and id in (select public.my_group_ids()));

-- You can only take yourself out. The creator no longer removes people:
-- that is a remove vote now.
drop policy if exists "leave squad" on public.group_members;
create policy "leave squad" on public.group_members
  for delete to authenticated
  using (user_id = auth.uid());

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
