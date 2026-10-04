-- "Your parea is going": when someone says they're in on a public plan of
-- another squad, the people they hang out with hear about it.
-- Run once in the Supabase SQL editor, after schema.sql and push_notifications.sql.

-- Who already got a "Nikos is going to X" push, so each person hears about
-- each plan once, however many friends join it.
create table if not exists public.parea_going_pushes (
  event_id uuid        not null references public.events(id)   on delete cascade,
  user_id  uuid        not null references public.profiles(id) on delete cascade,
  sent_at  timestamptz not null default now(),
  primary key (event_id, user_id)
);

alter table public.parea_going_pushes enable row level security;
-- No policies: only the security definer trigger below touches it.

-- Upcoming public plans of other squads that people from your squads are in
-- on, and that you have not answered yet. Security definer because the
-- friends' squads and profiles are not all readable to you row by row; it only
-- returns people who share a squad with you.
-- squad_votes.sql replaces this function with one that also leaves out plans
-- a squad of yours already goes to.
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
   order by e.date, e.start_time nulls first
   limit 20;
$function$;

create or replace function public.notify_parea_going()
returns trigger language plpgsql security definer set search_path to 'public' as $function$
declare
  plan record;
  friend text;
  notifications jsonb;
begin
  if new.status <> 'in'
     or (tg_op = 'UPDATE' and old.status = 'in')
     or public.push_is_quiet(coalesce(new.updated_at, now())) then
    return null;
  end if;

  select e.id, e.title, e.date, e.start_time, e.group_id, g.name as squad
    into plan
  from public.events e
  join public.groups g on g.id = e.group_id
  where e.id = new.event_id
    and e.is_public
    and e.date >= current_date;

  if not found then
    return null;
  end if;

  select display_name into friend from public.profiles where id = new.user_id;

  -- Friends of the person, outside the plan's own squad (they already know),
  -- who have not answered and have not been told about this plan yet.
  with told as (
    insert into public.parea_going_pushes (event_id, user_id)
    select distinct new.event_id, m.user_id
      from public.group_members mine
      join public.group_members m on m.group_id = mine.group_id
     where mine.user_id = new.user_id
       and m.user_id <> new.user_id
       and not exists (
         select 1 from public.group_members same
          where same.group_id = plan.group_id and same.user_id = m.user_id
       )
       and not exists (
         select 1 from public.event_attendees x
          where x.event_id = new.event_id and x.user_id = m.user_id
       )
    on conflict do nothing
    returning user_id
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'to', t.token,
           'sound', 'default',
           'channelId', 'default',
           'title', '📍 ' || friend || ' is going to ' || plan.title,
           'body', plan.squad || ' · ' || to_char(plan.date, 'Dy DD Mon')
                   || coalesce(' · ' || to_char(plan.start_time, 'HH24:MI'), '') || '. In?',
           'data', jsonb_build_object('type', 'event', 'groupId', plan.group_id, 'eventId', plan.id)
         )), '[]'::jsonb)
    into notifications
  from told
  join public.push_tokens t on t.user_id = told.user_id;

  if jsonb_array_length(notifications) > 0 then
    perform public.send_pushes(notifications);
  end if;

  return null;
end $function$;

drop trigger if exists event_attendees_parea_going on public.event_attendees;
create trigger event_attendees_parea_going
  after insert or update of status on public.event_attendees
  for each row execute function public.notify_parea_going();
