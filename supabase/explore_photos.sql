-- Explore highlights: photos from public events that their owner chose to show
-- in Explore. Run once in the Supabase SQL editor, after schema.sql.
--
-- A photo reaches strangers only when BOTH hold: its owner switched on
-- "Show in Explore" (event_photos.in_explore) and the event is public.
-- Making the event private again hides every photo of it at once.

alter table public.event_photos
  add column if not exists in_explore boolean not null default false;

-- Strangers can read the rows of shared photos...
drop policy if exists "read explore photos" on public.event_photos;
create policy "read explore photos" on public.event_photos
  for select to authenticated
  using (
    in_explore
    and exists (
      select 1 from public.events e
       where e.id = event_photos.event_id
         and e.is_public
    )
  );

-- ...and sign the files behind them (the chat bucket is private).
drop policy if exists "read explore photo files" on storage.objects;
create policy "read explore photo files" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'chat'
    and exists (
      select 1
        from public.event_photos p
        join public.events e on e.id = p.event_id
       where p.path = storage.objects.name
         and p.in_explore
         and e.is_public
    )
  );

-- Only the owner flips the switch, and only that column changes.
create or replace function public.set_photo_in_explore(photo_id uuid, shown boolean)
returns void language plpgsql security definer set search_path to 'public' as $function$
begin
  update public.event_photos
     set in_explore = shown
   where id = photo_id
     and user_id = auth.uid();

  if not found then
    raise exception 'You can only share your own photos.';
  end if;
end $function$;

-- Top public nights of the last 7 days with at least 2 shared photos,
-- from squads you are not in. Near first when a center is given.
-- Security definer so strangers get the going count of past public events,
-- which event_attendees does not let them read row by row.
create or replace function public.explore_highlights(
  center_lat float8 default null,
  center_lng float8 default null,
  radius_km  float8 default null,
  max_count  int    default 10
)
returns table (
  event_id      uuid,
  title         text,
  date          date,
  start_time    time,
  end_time      time,
  location      text,
  place_label   text,
  description   text,
  lat           float8,
  lng           float8,
  is_public     boolean,
  group_id      uuid,
  group_name    text,
  group_handle  text,
  group_bio     text,
  member_count  int,
  going_count   int,
  photo_count   int,
  cover_id      uuid,
  cover_user_id uuid,
  cover_path    text,
  cover_width   int,
  cover_height  int,
  cover_created timestamptz
)
language sql stable security definer set search_path to 'public' as $function$
  with shared as (
    select p.event_id,
           count(*)::int as photo_count,
           (array_agg(p.id order by p.created_at))[1] as cover_id
      from public.event_photos p
     where p.in_explore
     group by p.event_id
    having count(*) >= 2
  ),
  nights as (
    select e.*, g.name as group_name, g.handle as group_handle, g.bio as group_bio,
           g.member_count, s.photo_count, s.cover_id,
           (select count(*)::int from public.event_attendees a
             where a.event_id = e.id and a.status = 'in') as going_count
      from public.events e
      join shared s on s.event_id = e.id
      join public.groups g on g.id = e.group_id
     where e.is_public
       and e.date between current_date - 7 and current_date
       and e.group_id not in (select public.my_group_ids())
       and (
         center_lat is null or center_lng is null or radius_km is null
         or (
           e.lat between center_lat - radius_km / 111.0 and center_lat + radius_km / 111.0
           and e.lng between center_lng - radius_km / (111.0 * greatest(0.01, cos(radians(center_lat))))
                         and center_lng + radius_km / (111.0 * greatest(0.01, cos(radians(center_lat))))
         )
       )
  )
  select n.id, n.title, n.date, n.start_time, n.end_time, n.location, n.place_label,
         n.description, n.lat, n.lng, n.is_public,
         n.group_id, n.group_name, n.group_handle, n.group_bio, n.member_count,
         n.going_count, n.photo_count,
         c.id, c.user_id, c.path, c.width, c.height, c.created_at
    from nights n
    join public.event_photos c on c.id = n.cover_id
   order by n.going_count
          + n.photo_count * 0.5
          - (current_date - n.date) * 1.5 desc,
            n.date desc
   limit greatest(1, least(max_count, 30));
$function$;
