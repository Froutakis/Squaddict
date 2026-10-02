-- Demo plans for MVPS for the rest of the month: two tonight (the wallet on
-- Home), then a plan every few days until the month ends. Some everyone is in,
-- some half, some only the one who threw it out (those wait on your answer).
-- A few are public, with tags, so other pareas see them too.
--
-- Covers use the demo photos in Storage › squads › memories-demo/ (run
-- seed_memories.sql first for those; without them the plans have no cover).
--
-- Running this again replaces what it made. To remove it, run the cleanup at
-- the bottom.

begin;

-- Seeded rows must not send push notifications (see push_notifications.sql).
set local squaddict.skip_push = 'on';

do $$
declare
  target  text := 'MVPS';
  mvps    uuid;
  members uuid[];
  size    int;
  last_day date := (date_trunc('month', current_date) + interval '1 month - 1 day')::date;
  base    text := (select substring(min(path) from '^(.*/memories-demo/)')
                     from public.event_photos where path like '%/memories-demo/%');
  plan_id uuid;
  plan_day date;
  going   int;
  made    int := 0;
  p record;
begin
  select g.id into mvps from public.groups g where lower(g.name) = lower(target) order by g.created_at limit 1;
  if mvps is null then
    raise exception 'No squad called %.', target;
  end if;

  select array_agg(m.user_id order by m.joined_at) into members from public.group_members m where m.group_id = mvps;
  size := array_length(members, 1);

  -- What an earlier run made (RSVPs go with the plans).
  delete from public.events where id in (select md5('squaddict-mvps-plan-' || n)::uuid from generate_series(1, 20) n);

  for p in
    select * from (values
      -- n, days from today, title, place, lat, lng, start, end, tag, public, who is in (all / half / one), cover
      ( 1,  0, 'Καφές και τάβλι στην Άνω Πόλη', 'Άνω Πόλη',          40.6418, 22.9530, '18:30', '21:00', 'food',     false, 'all',  'memory-05.jpg'),
      ( 2,  0, 'Ποτά στα Λαδάδικα',              'Λαδάδικα',          40.6352, 22.9365, '22:30', '23:59', 'drinks',   true,  'one',  'memory-12.jpg'),
      ( 3,  1, 'Πρωινό τρέξιμο στην Παραλία',    'Νέα Παραλία',       40.6195, 22.9520, '09:00', '10:30', 'sports',   false, 'half', 'memory-08.jpg'),
      ( 4,  3, 'Σουβλάκια στον Τσίκο',           'Τσίκο, Βαλαωρίτου', 40.6370, 22.9410, '21:00', '23:00', 'food',     false, 'all',  'memory-14.jpg'),
      ( 5,  4, 'Jazz στο Μπιτ Παζάρ',            'Μπιτ Παζάρ',        40.6385, 22.9440, '21:30', '23:59', 'culture',  true,  'half', 'memory-21.jpg'),
      ( 6,  6, 'Ηλιοβασίλεμα στο Επταπύργιο',    'Επταπύργιο',        40.6440, 22.9610, '18:45', '20:30', 'outdoors', false, 'one',  'memory-03.jpg'),
      ( 7,  8, 'Μπάσκετ στο γήπεδο της Καλαμαριάς', 'Καλαμαριά',      40.5830, 22.9500, '19:00', '21:00', 'sports',   false, 'all',  'memory-17.jpg'),
      ( 8, 10, 'Πλανόδιο σινεμά στην Αλλατίνη',  'Αλλατίνη',          40.6060, 22.9600, '20:30', '22:45', 'culture',  true,  'half', 'memory-24.jpg'),
      ( 9, 11, 'Μεζέδες στο Καπάνι',             'Καπάνι',            40.6378, 22.9395, '14:00', '16:30', 'food',     false, 'one',  'memory-09.jpg'),
      (10, 13, 'Ταράτσα με θέα τον Θερμαϊκό',    'Ταράτσα, Τσιμισκή', 40.6320, 22.9430, '21:00', '23:59', 'drinks',   false, 'all',  'memory-27.jpg'),
      (11, 15, 'Ποδήλατο ως το Μέγαρο',          'Μέγαρο Μουσικής',   40.5960, 22.9520, '17:30', '19:30', 'outdoors', true,  'half', 'memory-06.jpg'),
      (12, 17, 'Board games στο σπίτι Φουτάκη',  'Σπίτι Φουτάκη',     40.6010, 22.9580, '20:00', '23:59', 'food',     false, 'one',  'memory-30.jpg'),
      (13, 20, 'Εκδρομή στον Χορτιάτη',          'Χορτιάτης',         40.6000, 23.0990, '10:00', '17:00', 'outdoors', false, 'half', 'memory-01.jpg'),
      (14, 22, 'Τσιπουράκια στην Κυψέλη',        'Κυψέλη',            40.6345, 22.9450, '21:00', '23:30', 'drinks',   false, 'all',  'memory-19.jpg'),
      (15, 24, 'Live στο Block 33',              'Block 33',          40.6010, 22.9670, '22:00', '23:59', 'culture',  true,  'one',  'memory-25.jpg'),
      (16, 27, 'Βόλτα στο λιμάνι και κρέπες',    'Λιμάνι',            40.6330, 22.9340, '19:30', '21:30', 'outdoors', false, 'half', 'memory-11.jpg'),
      (17, 29, 'Halloween στα Λαδάδικα',         'Λαδάδικα',          40.6352, 22.9365, '22:00', '23:59', 'drinks',   true,  'all',  'memory-32.jpg')
    ) as t(n, days, title, place, lat, lng, start_time, end_time, tag, is_public, who, cover)
  loop
    plan_day := current_date + p.days;
    continue when plan_day > last_day;

    plan_id := md5('squaddict-mvps-plan-' || p.n)::uuid;

    insert into public.events
      (id, group_id, created_by, title, date, start_time, end_time, location, place_label,
       description, lat, lng, tags, is_public, created_at)
    values
      (plan_id, mvps, members[1 + (p.n - 1) % size], p.title, plan_day,
       p.start_time::time, p.end_time::time, p.place, 'Θεσσαλονίκη',
       'Ποιος είναι μέσα;', p.lat, p.lng, array[p.tag], p.is_public,
       now() - interval '2 days' + p.n * interval '1 hour');

    -- Who said they're in: everyone, about half, or just the one who threw it out.
    going := case p.who when 'all' then size when 'half' then greatest(1, size / 2) else 1 end;
    insert into public.event_attendees (event_id, user_id, status)
    select plan_id, u, 'in'
      from unnest(members) u
     order by (u = members[1 + (p.n - 1) % size]) desc, md5(u::text || plan_id::text)
     limit going
    on conflict do nothing;

    -- One no on the "half" plans, so the ticket shows a pass too.
    if p.who = 'half' and size > going then
      insert into public.event_attendees (event_id, user_id, status)
      select plan_id, u, 'out'
        from unnest(members) u
       where not exists (select 1 from public.event_attendees a where a.event_id = plan_id and a.user_id = u)
       order by md5(u::text || plan_id::text || 'out')
       limit 1
      on conflict do nothing;
    end if;

    if base is not null and exists (select 1 from information_schema.columns
                where table_schema = 'public' and table_name = 'events' and column_name = 'cover_url') then
      execute 'update public.events set cover_url = $1 where id = $2' using base || p.cover, plan_id;
    end if;

    made := made + 1;
  end loop;

  raise notice 'MVPS: % plans from today to %.', made, last_day;
end $$;

-- What it made.
select e.date, e.start_time, e.title, e.is_public,
       count(*) filter (where a.status = 'in')  as going,
       count(*) filter (where a.status = 'out') as passed
  from public.events e
  left join public.event_attendees a on a.event_id = e.id
 where e.id in (select md5('squaddict-mvps-plan-' || n)::uuid from generate_series(1, 20) n)
 group by e.id
 order by e.date, e.start_time;

commit;

-- Cleanup: removes these plans (their RSVPs go with them).
-- delete from public.events where id in (select md5('squaddict-mvps-plan-' || n)::uuid from generate_series(1, 20) n);
