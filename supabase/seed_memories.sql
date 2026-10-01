-- Demo memories, on top of seed_more.sql: photos from the past nights of its
-- 12 squads, reactions on them, and the links that bring public nights into
-- other pareas' feeds (feed_nights.sql): your people at other pareas' public
-- nights, followed pareas at them, and matching tags.
--
-- The photos are our own (the photo/ folder, made web-sized and stripped of
-- location and camera data into photo/web/). Before running this, upload
-- photo/web/*.jpg to Storage › squads › memories-demo/ (a public bucket); the
-- app shows those links as they are.
--
-- Run seed_more.sql first. Running this again replaces what it made. To
-- remove it, run the cleanup at the bottom.

begin;

-- Seeded rows must not send push notifications (see push_notifications.sql).
set local squaddict.skip_push = 'on';

-- What an earlier run made (reactions go with their photos).
delete from public.event_photos
 where path like '%/storage/v1/object/public/squads/memories-demo/%'
    or path like 'https://picsum.photos/seed/sqm-%';
delete from public.event_attendees where (event_id, user_id) in (
  select a.event_id, a.user_id
    from public.event_attendees a
   where a.updated_at = '2001-01-01 00:00:00+00'
);

do $$
declare
  squads uuid[] := array(select md5('squaddict-more-squad-' || n)::uuid from generate_series(1, 12) n);
  emojis text[] := array['🔥', '😂', '😍', '🍻'];
  base    text   := 'https://nuigrlrxpbvxpawmzjcx.supabase.co/storage/v1/object/public/squads/memories-demo/';
  files   text[] := array['memory-01.jpg', 'memory-02.jpg', 'memory-03.jpg', 'memory-04.jpg', 'memory-05.jpg', 'memory-06.jpg', 'memory-07.jpg', 'memory-08.jpg', 'memory-09.jpg', 'memory-10.jpg', 'memory-11.jpg', 'memory-12.jpg', 'memory-13.jpg', 'memory-14.jpg', 'memory-15.jpg', 'memory-16.jpg', 'memory-17.jpg', 'memory-18.jpg', 'memory-19.jpg', 'memory-20.jpg', 'memory-21.jpg', 'memory-22.jpg', 'memory-23.jpg', 'memory-24.jpg', 'memory-25.jpg', 'memory-26.jpg', 'memory-27.jpg', 'memory-28.jpg', 'memory-29.jpg', 'memory-30.jpg', 'memory-31.jpg', 'memory-32.jpg', 'memory-33.jpg'];
  widths  int[]  := array[720, 720, 960, 960, 960, 960, 960, 960, 960, 960, 960, 960, 960, 960, 960, 960, 960, 960, 960, 960, 960, 960, 960, 960, 960, 960, 960, 960, 960, 960, 960, 960, 960];
  heights int[]  := array[1280, 1280, 1280, 1280, 1280, 1280, 1280, 1280, 1280, 1280, 1280, 1280, 1280, 1280, 1280, 1280, 1280, 1280, 1280, 1280, 1280, 1280, 1280, 1280, 1280, 1280, 1280, 1280, 1280, 1280, 1280, 616, 1280];
  night record;
  person record;
  photo_id uuid;
  shooters uuid[];
  photos int;
  pick int;
  s int;
begin
  if not exists (select 1 from public.groups where id = squads[1]) then
    raise exception 'Run seed_more.sql first.';
  end if;

  perform setseed(0.42);

  -- Some of your people went to public nights of other pareas
  -- (feed_nights: "Kostas was there"). Marked with a fixed updated_at so a
  -- second run can find and replace them.
  for night in
    select e.id, e.group_id
      from public.events e
     where e.group_id = any(squads[6:12])
       and e.is_public
       and e.date between current_date - 40 and current_date - 1
     order by md5(e.id::text)
     limit 14
  loop
    insert into public.event_attendees (event_id, user_id, status, updated_at)
    select night.id, m.user_id, 'in', '2001-01-01 00:00:00+00'
      from public.group_members m
     where m.group_id = squads[1 + (get_byte(decode(md5(night.id::text), 'hex'), 0) % 5)]
       and m.user_id not in (select user_id from public.group_members where group_id = night.group_id)
     order by md5(m.user_id::text || night.id::text)
     limit 2
    on conflict (event_id, user_id) do nothing;
  end loop;

  -- Squads at each other's public nights, so a parea you follow "went".
  for night in
    select e.id, e.group_id
      from public.events e
     where e.group_id = any(squads)
       and e.is_public
       and e.date between current_date - 40 and current_date - 1
     order by md5(e.id::text || 'x')
     limit 24
  loop
    s := 1 + (get_byte(decode(md5(night.id::text || 'guests'), 'hex'), 0) % 12);
    continue when squads[s] = night.group_id;

    insert into public.event_attendees (event_id, user_id, status, updated_at)
    select night.id, m.user_id, 'in', '2001-01-01 00:00:00+00'
      from public.group_members m
     where m.group_id = squads[s]
       and m.user_id not in (select user_id from public.group_members where group_id = night.group_id)
     order by md5(m.user_id::text || night.id::text)
     limit 3
    on conflict (event_id, user_id) do nothing;
  end loop;

  -- Photos: most past nights of the last six weeks, 2 to 7 each, taken by
  -- people who were in.
  for night in
    select e.id, e.date, coalesce(e.start_time, '21:00') as start_time
      from public.events e
     where e.group_id = any(squads)
       and e.date between current_date - 42 and current_date - 1
  loop
    continue when random() < 0.2;

    select coalesce(array_agg(a.user_id order by md5(a.user_id::text)), array[]::uuid[])
      into shooters
      from public.event_attendees a
     where a.event_id = night.id and a.status = 'in';
    continue when array_length(shooters, 1) is null;

    photos := 2 + floor(random() * 6)::int;
    for n in 1..photos loop
      photo_id := md5('squaddict-memory-' || night.id::text || '-' || n)::uuid;
      pick := 1 + get_byte(decode(md5(photo_id::text), 'hex'), 0) % array_length(files, 1);

      insert into public.event_photos (id, event_id, user_id, path, width, height, created_at)
      values (
        photo_id,
        night.id,
        shooters[1 + (n - 1) % array_length(shooters, 1)],
        base || files[pick],
        widths[pick],
        heights[pick],
        (night.date + night.start_time) + n * interval '17 minutes'
      );

      -- Reactions: from the night's people and the squad's members, as one
      -- of the squads they are in.
      for person in
        select distinct on (u.user_id) u.user_id, gm.group_id
          from (
            select a.user_id from public.event_attendees a where a.event_id = night.id and a.status = 'in'
            union
            select m.user_id
              from public.group_members m
              join public.events e on e.group_id = m.group_id
             where e.id = night.id
          ) u
          join public.group_members gm on gm.user_id = u.user_id
         order by u.user_id, md5(gm.group_id::text)
      loop
        continue when random() < 0.55;
        insert into public.photo_reactions (photo_id, user_id, group_id, emoji, created_at)
        values (
          photo_id,
          person.user_id,
          person.group_id,
          emojis[1 + floor(random() * 4)::int],
          (night.date + night.start_time) + interval '1 day' + random() * interval '2 days'
        )
        on conflict do nothing;
      end loop;
    end loop;
  end loop;
end $$;

-- MVPS at the centre: its feed gets every kind of post. Its own nights with
-- our photos, 7 demo squads followed (their memories public), and its
-- members at public nights of the other 5 ("… was there"). Skipped, with a
-- notice, when there is no squad called MVPS.
do $$
declare
  target text := 'MVPS';
  mvps uuid;
  squads uuid[] := array(select md5('squaddict-more-squad-' || n)::uuid from generate_series(1, 12) n);
  members uuid[];
  emojis text[] := array['🔥', '😂', '😍', '🍻'];
  base    text   := (select substring(min(path) from '^(.*/memories-demo/)')
                       from public.event_photos where path like '%/memories-demo/%');
  files   text[];
  widths  int[];
  heights int[];
  titles  text[] := array['Τσιπουράκια στην Κυψέλη', 'Σπίτι Φουτάκη', 'Μπύρες στο Μπιτ Παζάρ', 'Ηλιοβασίλεμα στην Παραλία',
                          'Πλανόδιο σινεμά', 'Βόλτα στην Άνω Πόλη', 'Γενέθλια στο ταράτσα', 'Μπάσκετ και σουβλάκια'];
  places  text[] := array['Κυψέλη', 'Σπίτι Φουτάκη', 'Μπιτ Παζάρ', 'Νέα Παραλία', 'Αλλατίνη', 'Άνω Πόλη', 'Ταράτσα', 'Καλαμαριά'];
  tags    text[] := array['food', 'drinks', 'drinks', 'outdoors', 'culture', 'outdoors', 'drinks', 'sports'];
  days    int[]  := array[2, 5, 9, 13, 17, 22, 27, 33];
  night_id uuid;
  photo_id uuid;
  pick int;
  night record;
begin
  select g.id into mvps from public.groups g where lower(g.name) = lower(target) order by g.created_at limit 1;
  if mvps is null then
    raise notice 'No squad called %: skipped the MVPS part.', target;
    return;
  end if;
  if base is null then
    raise notice 'No demo photos yet: skipped the MVPS part.';
    return;
  end if;

  select array_agg(m.user_id order by m.joined_at) into members from public.group_members m where m.group_id = mvps;

  -- The photo list, taken from what the part above already used.
  select array_agg(f order by f), array_agg(w order by f), array_agg(h order by f)
    into files, widths, heights
    from (select distinct substring(path from '/memories-demo/(.*)$') f, width w, height h
            from public.event_photos where path like '%/memories-demo/%') x;

  -- What an earlier run made for MVPS (photos, RSVPs and reactions go with the nights).
  delete from public.events where id in (select md5('squaddict-mvps-night-' || n)::uuid from generate_series(1, 8) n);
  delete from public.squad_follows where follower_group_id = mvps and created_at = '2001-01-01 00:00:00+00';

  -- Its own nights, half of them public, each with photos and reactions.
  for n in 1..8 loop
    night_id := md5('squaddict-mvps-night-' || n)::uuid;

    insert into public.events
      (id, group_id, created_by, title, date, start_time, end_time, location, place_label,
       lat, lng, tags, is_public, created_at)
    values
      (night_id, mvps, members[1 + (n - 1) % array_length(members, 1)], titles[n], current_date - days[n],
       '21:00', '23:59', places[n], places[n],
       40.62 + (n % 4) * 0.006, 22.94 + (n % 3) * 0.008, array[tags[n]], n % 2 = 0,
       now() - (days[n] + 3) * interval '1 day');

    insert into public.event_attendees (event_id, user_id, status)
    select night_id, u, 'in' from unnest(members) u
    on conflict do nothing;

    for p in 1..(3 + n % 4) loop
      photo_id := md5('squaddict-mvps-photo-' || n || '-' || p)::uuid;
      pick := 1 + ((n * 7 + p * 3) % array_length(files, 1));

      insert into public.event_photos (id, event_id, user_id, path, width, height, created_at)
      values (photo_id, night_id, members[1 + (p - 1) % array_length(members, 1)],
              base || files[pick], widths[pick], heights[pick],
              (current_date - days[n]) + time '21:30' + p * interval '19 minutes');

      insert into public.photo_reactions (photo_id, user_id, group_id, emoji, created_at)
      select photo_id, u, mvps, emojis[1 + (get_byte(decode(md5(photo_id::text || u::text), 'hex'), 0) % 4)],
             (current_date - days[n]) + interval '1 day'
        from unnest(members) u
       where get_byte(decode(md5(photo_id::text || u::text), 'hex'), 1) % 3 <> 0
      on conflict do nothing;
    end loop;
  end loop;

  -- MVPS follows 7 demo squads, and their memories are open to followers.
  insert into public.squad_follows (follower_group_id, followed_group_id, created_by, created_at)
  select mvps, g, members[1], '2001-01-01 00:00:00+00' from unnest(squads[1:7]) g
   where g <> mvps
  on conflict do nothing;
  update public.groups set memories_public = true where id = any(squads);

  -- MVPS people at public nights of the squads it doesn't follow ("… was there").
  for night in
    select e.id
      from public.events e
     where e.group_id = any(squads[8:12])
       and e.is_public
       and e.date between current_date - 40 and current_date - 1
       and exists (select 1 from public.event_photos p where p.event_id = e.id)
     order by md5(e.id::text || 'mvps')
     limit 10
  loop
    insert into public.event_attendees (event_id, user_id, status, updated_at)
    select night.id, u, 'in', '2001-01-01 00:00:00+00'
      from unnest(members) u
     order by md5(u::text || night.id::text)
     limit 2
    on conflict (event_id, user_id) do nothing;
  end loop;

  raise notice 'MVPS: 8 nights with photos, follows 7 squads, at 10 public nights of others.';
end $$;

-- What it made.
select
  (select count(*) from public.event_photos where path like '%/memories-demo/%')        as photos,
  (select count(distinct event_id) from public.event_photos where path like '%/memories-demo/%') as nights_with_photos,
  (select count(*) from public.photo_reactions r
     join public.event_photos p on p.id = r.photo_id
    where p.path like '%/memories-demo/%')                                               as reactions,
  (select count(*) from public.event_attendees where updated_at = '2001-01-01 00:00:00+00')           as guests_at_other_pareas;

commit;

-- Cleanup: removes the photos (with their reactions), the guest RSVPs, and
-- the MVPS nights and follows this made.
-- delete from public.event_photos    where path like '%/storage/v1/object/public/squads/memories-demo/%';
-- delete from public.event_attendees where updated_at = '2001-01-01 00:00:00+00';
-- delete from public.events         where id in (select md5('squaddict-mvps-night-' || n)::uuid from generate_series(1, 8) n);
-- delete from public.squad_follows  where created_at = '2001-01-01 00:00:00+00';
