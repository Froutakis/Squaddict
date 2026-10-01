-- Memories from other pareas in a parea's Home feed. Run once in the Supabase
-- SQL editor, after schema.sql, follows.sql and explore_photos.sql.
--
-- A public plan is public all the way: once it has happened, its photos can
-- reach the feeds of other pareas. Private plans stay inside their parea.

-- Anyone signed in reads the photos of public nights that already happened...
drop policy if exists "read public night photos" on public.event_photos;
create policy "read public night photos" on public.event_photos
  for select to authenticated
  using (
    exists (
      select 1 from public.events e
       where e.id = event_photos.event_id
         and e.is_public
         and e.date <= current_date
    )
  );

-- ...and signs the files behind them (the chat bucket is private).
drop policy if exists "read public night photo files" on storage.objects;
create policy "read public night photo files" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'chat'
    and exists (
      select 1
        from public.event_photos p
        join public.events e on e.id = p.event_id
       where p.path = storage.objects.name
         and e.is_public
         and e.date <= current_date
    )
  );

-- The nights a parea's feed shows, each with why it is there. Each night shows
-- once, under the closest reason:
--   yours          a night of this parea
--   following      a night of a parea it follows (public, or memories_public)
--   member_went    a public night of another parea that one of you went to
--   followed_went  a public night that a parea you follow went to
--   similar        a public night with the same tags as your recent nights
--   public         any other public night
-- Only nights that have photos. Other pareas' nights reach back 60 days.
-- `via` names who links you to it: the member, the parea, or the tag.
create or replace function public.feed_nights(p_group uuid, p_limit int default 60)
returns table (event_id uuid, reason text, via text, night date)
language sql stable security definer set search_path to 'public' as $function$
  with me as (
    select p_group as gid
     where exists (
       select 1 from group_members m where m.group_id = p_group and m.user_id = auth.uid()
     )
  ),
  members as (
    select m.user_id from group_members m join me on m.group_id = me.gid
  ),
  followed as (
    select f.followed_group_id as gid
      from squad_follows f join me on f.follower_group_id = me.gid
  ),
  my_tags as (
    select distinct unnest(e.tags) as tag
      from events e join me on e.group_id = me.gid
     where e.date between current_date - 90 and current_date
  ),
  with_photos as (
    select e.*
      from events e
     where e.date <= current_date
       and exists (select 1 from event_photos p where p.event_id = e.id)
  ),
  candidates as (
    select e.id, 'yours'::text as reason, null::text as via, e.date, 1 as rank
      from with_photos e join me on e.group_id = me.gid

    union all
    select e.id, 'following', g.name, e.date, 2
      from with_photos e
      join followed f on f.gid = e.group_id
      join groups g on g.id = e.group_id
     where e.is_public or g.memories_public

    union all
    select e.id, 'member_went', min(pr.display_name), e.date, 3
      from with_photos e
      join event_attendees a on a.event_id = e.id and a.status = 'in'
      join members m on m.user_id = a.user_id
      join profiles pr on pr.id = a.user_id
     where e.is_public
       and e.date >= current_date - 60
       and e.group_id not in (select gid from me)
     group by e.id, e.date

    union all
    select e.id, 'followed_went', min(g.name), e.date, 4
      from with_photos e
      join event_attendees a on a.event_id = e.id and a.status = 'in'
      join group_members gm on gm.user_id = a.user_id
      join followed f on f.gid = gm.group_id
      join groups g on g.id = gm.group_id
     where e.is_public
       and e.date >= current_date - 60
       and e.group_id not in (select gid from me)
     group by e.id, e.date

    union all
    select e.id, 'similar', min(t.tag), e.date, 5
      from with_photos e
      cross join lateral unnest(e.tags) as t(tag)
      join my_tags mt on mt.tag = t.tag
     where e.is_public
       and e.date >= current_date - 60
       and e.group_id not in (select gid from me)
     group by e.id, e.date

    union all
    select e.id, 'public', null, e.date, 6
      from with_photos e
     where e.is_public
       and e.date >= current_date - 60
       and e.group_id not in (select gid from me)
       and exists (select 1 from me)
  ),
  closest as (
    select distinct on (c.id) c.id, c.reason, c.via, c.date
      from candidates c
     order by c.id, c.rank
  )
  select c.id, c.reason, c.via, c.date
    from closest c
   order by c.date desc
   limit greatest(1, least(p_limit, 200));
$function$;

grant execute on function public.feed_nights(uuid, int) to authenticated;
