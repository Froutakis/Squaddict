-- Meeting other pareas: the pareas you crossed, waves between pareas, and the
-- month's board. Run once in the Supabase SQL editor, after schema.sql and
-- feed_nights.sql. Running it again is safe.
--
-- Everything here only counts PUBLIC nights. A private night never tells
-- anyone that its parea was somewhere.

-- A parea can stay off the board.
alter table public.groups add column if not exists on_board boolean not null default true;

-- How close two nights must be (km) to count as crossing.
create or replace function public.crossed_distance_km(lat1 double precision, lng1 double precision, lat2 double precision, lng2 double precision)
returns double precision language sql immutable as $$
  select sqrt(power((lat2 - lat1) * 111.0, 2) + power((lng2 - lng1) * 111.0 * cos(radians(lat1)), 2))
$$;

-- For a parea you are in: the other pareas that had a public night on the same
-- date as one of its public nights, within 300 m, in the last p_days days.
-- One row per pair of nights; `times` is how often you crossed that parea.
create or replace function public.crossed_pareas(p_group uuid, p_days int default 60)
returns table (
  my_event_id uuid, night date, place text,
  other_group_id uuid, other_name text, other_avatar_url text,
  other_event_id uuid, other_title text, times int
)
language sql stable security definer set search_path to 'public' as $function$
  with me as (
    select p_group as gid
     where exists (select 1 from group_members m where m.group_id = p_group and m.user_id = auth.uid())
  ),
  pairs as (
    select mine.id as my_event_id, mine.date as night,
           coalesce(o.place_label, o.location, mine.place_label, mine.location) as place,
           o.group_id as other_group_id, o.id as other_event_id, o.title as other_title
      from events mine
      join me on mine.group_id = me.gid
      join events o on o.date = mine.date and o.group_id <> mine.group_id and o.is_public
     where mine.is_public
       and mine.date between current_date - p_days and current_date
       and mine.lat is not null and mine.lng is not null
       and o.lat is not null and o.lng is not null
       and crossed_distance_km(mine.lat, mine.lng, o.lat, o.lng) <= 0.3
       -- a parea you are in yourself is not someone you crossed
       and not exists (select 1 from group_members x where x.group_id = o.group_id and x.user_id = auth.uid())
  ),
  -- How many different nights you crossed each parea.
  times as (
    select other_group_id, count(distinct night)::int as n from pairs group by other_group_id
  )
  select p.my_event_id, p.night, p.place,
         p.other_group_id, g.name, g.avatar_url,
         p.other_event_id, p.other_title,
         t.n as times
    from pairs p
    join times t on t.other_group_id = p.other_group_id
    join groups g on g.id = p.other_group_id
   order by p.night desc;
$function$;

-- Waves: a light hello from one parea to another it crossed. One a week per pair.
create table if not exists public.squad_waves (
  id            uuid        primary key default gen_random_uuid(),
  from_group_id uuid        not null references public.groups(id) on delete cascade,
  to_group_id   uuid        not null references public.groups(id) on delete cascade,
  -- The receiving parea's night where you crossed; the wave shows on it.
  event_id      uuid        references public.events(id) on delete set null,
  sent_by       uuid        not null references public.profiles(id) on delete cascade,
  week          date        not null default (date_trunc('week', now()))::date,
  created_at    timestamptz not null default now(),
  constraint squad_waves_not_self check (from_group_id <> to_group_id),
  constraint squad_waves_once_a_week unique (from_group_id, to_group_id, week)
);
create index if not exists squad_waves_to_idx on public.squad_waves (to_group_id, created_at desc);

alter table public.squad_waves enable row level security;
grant select on public.squad_waves to authenticated;

-- Members of either parea can see a wave; nobody writes to the table directly.
drop policy if exists "read waves of my pareas" on public.squad_waves;
create policy "read waves of my pareas" on public.squad_waves
  for select to authenticated
  using (
    exists (
      select 1 from public.group_members m
       where m.user_id = auth.uid()
         and m.group_id in (squad_waves.from_group_id, squad_waves.to_group_id)
    )
  );

-- Wave from a parea you are in to one you crossed. Returns the wave, or nothing
-- when you already waved this week.
create or replace function public.send_wave(p_from uuid, p_to uuid)
returns setof public.squad_waves
language plpgsql volatile security definer set search_path to 'public' as $function$
declare
  v_event uuid;
begin
  if not exists (select 1 from group_members m where m.group_id = p_from and m.user_id = auth.uid()) then
    raise exception 'not a member of this parea' using errcode = '42501';
  end if;

  -- The latest night of theirs where the two pareas crossed.
  select c.other_event_id into v_event
    from crossed_pareas(p_from) c
   where c.other_group_id = p_to
   order by c.night desc
   limit 1;
  if v_event is null then
    raise exception 'these pareas have not crossed' using errcode = '42501';
  end if;

  return query
    insert into squad_waves (from_group_id, to_group_id, event_id, sent_by)
    values (p_from, p_to, v_event, auth.uid())
    on conflict on constraint squad_waves_once_a_week do nothing
    returning *;
end;
$function$;

-- Waves a parea received in the last p_days days, with who sent them and
-- whether it already waved back this week.
create or replace function public.waves_for(p_group uuid, p_days int default 30)
returns table (
  id uuid, event_id uuid, created_at timestamptz,
  from_group_id uuid, from_name text, from_avatar_url text, waved_back boolean
)
language sql stable security definer set search_path to 'public' as $function$
  select w.id, w.event_id, w.created_at,
         w.from_group_id, g.name, g.avatar_url,
         exists (
           select 1 from squad_waves b
            where b.from_group_id = w.to_group_id
              and b.to_group_id = w.from_group_id
              and b.week = (date_trunc('week', now()))::date
         )
    from squad_waves w
    join groups g on g.id = w.from_group_id
   where w.to_group_id = p_group
     and w.created_at > now() - make_interval(days => p_days)
     and exists (select 1 from group_members m where m.group_id = p_group and m.user_id = auth.uid())
   order by w.created_at desc;
$function$;

-- The month's board: pareas by public nights out in that month (only nights
-- that already happened), top p_limit plus your parea wherever it stands.
create or replace function public.city_board(p_group uuid, p_month date, p_limit int default 10)
returns table (group_id uuid, name text, avatar_url text, nights int, place int, is_mine boolean)
language sql stable security definer set search_path to 'public' as $function$
  with me as (
    select p_group as gid
     where exists (select 1 from group_members m where m.group_id = p_group and m.user_id = auth.uid())
  ),
  counts as (
    select e.group_id, count(*)::int as nights
      from events e
      join groups g on g.id = e.group_id
     where e.is_public
       and g.on_board
       and e.date >= date_trunc('month', p_month)::date
       and e.date < (date_trunc('month', p_month) + interval '1 month')::date
       and e.date <= current_date
     group by e.group_id
  ),
  ranked as (
    select c.group_id, c.nights, (rank() over (order by c.nights desc))::int as place
      from counts c
  )
  select r.group_id, g.name, g.avatar_url, r.nights, r.place, r.group_id = me.gid
    from ranked r
    join groups g on g.id = r.group_id
    cross join me
   where r.place <= p_limit or r.group_id = me.gid
   order by r.place, g.name;
$function$;

revoke execute on function public.crossed_pareas(uuid, int) from public;
revoke execute on function public.send_wave(uuid, uuid) from public;
revoke execute on function public.waves_for(uuid, int) from public;
revoke execute on function public.city_board(uuid, date, int) from public;
grant execute on function public.crossed_pareas(uuid, int) to authenticated;
grant execute on function public.send_wave(uuid, uuid) to authenticated;
grant execute on function public.waves_for(uuid, int) to authenticated;
grant execute on function public.city_board(uuid, date, int) to authenticated;
