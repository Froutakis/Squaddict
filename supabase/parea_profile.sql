-- What a squad's public profile shows to people outside it.
-- Run once in the Supabase SQL editor, after event_covers.sql and explore_photos.sql.
--
-- Security definer so strangers get a squad's numbers without reading its
-- private plans row by row. It only ever returns:
--   nights_out  how many plans the squad has had (a count, nothing more)
--   places      its most frequent spots, from PUBLIC plans only
--   covers      cover photos of its PUBLIC plans, newest first
--   photos      photos its members chose to show in Explore
create or replace function public.parea_profile(target uuid)
returns table (
  nights_out int,
  places     text[],
  covers     text[],
  photos     jsonb
)
language sql stable security definer set search_path to 'public' as $function$
  select
    (select count(*)::int
       from public.events e
      where e.group_id = target and e.date < current_date),

    (select coalesce(array_agg(spot order by uses desc, spot), '{}')
       from (
         select coalesce(nullif(e.location, ''), e.place_label) as spot, count(*) as uses
           from public.events e
          where e.group_id = target
            and e.is_public
            and coalesce(nullif(e.location, ''), e.place_label) is not null
          group by 1
          order by uses desc, spot
          limit 3
       ) top),

    (select coalesce(array_agg(url), '{}')
       from (
         select e.cover_url as url
           from public.events e
          where e.group_id = target
            and e.is_public
            and e.cover_url is not null
          order by e.date desc
          limit 3
       ) recent),

    (select coalesce(jsonb_agg(jsonb_build_object(
              'id', p.id, 'eventId', p.event_id, 'userId', p.user_id, 'path', p.path,
              'width', p.width, 'height', p.height, 'createdAt', p.created_at
            ) order by p.created_at desc), '[]'::jsonb)
       from (
         select p.*
           from public.event_photos p
           join public.events e on e.id = p.event_id
          where e.group_id = target
            and e.is_public
            and p.in_explore
          order by p.created_at desc
          limit 9
       ) p);
$function$;
