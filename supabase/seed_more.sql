-- A lot more demo data, on top of (or instead of) seed_demo.sql:
-- 30 people, 12 squads with photos and banners, ~190 plans from six weeks ago to
-- five weeks ahead, RSVPs, check-ins, 40 chat messages per squad with replies,
-- reactions and mentions, and squads following squads. All around Thessaloniki.
--
-- Every real account joins the first 5 squads, so the app is full when you sign in.
-- The other 7 are "strangers" for Explore, search and follows.
--
-- Rows use fixed ids, so running it again replaces them instead of duplicating.
-- Night photos (event_photos) are not seeded: they live in Storage, not in SQL.
-- To remove everything it made, run the cleanup at the bottom.

begin;

-- Seeded rows must not send push notifications (see push_notifications.sql).
set local squaddict.skip_push = 'on';

delete from public.groups
where id in (select md5('squaddict-more-squad-' || n)::uuid from generate_series(1, 12) n);

delete from public.profiles
where id in (select md5('squaddict-more-user-' || n)::uuid from generate_series(1, 30) n);

do $$
declare
  people text[] := array[
    'Αλέξης', 'Δανάη', 'Παναγιώτης', 'Ζωή', 'Άρης', 'Μυρτώ', 'Λευτέρης', 'Φωτεινή',
    'Βασίλης', 'Ναταλία', 'Μάριος', 'Δέσποινα', 'Πέτρος', 'Αθηνά', 'Ορέστης', 'Κλειώ',
    'Σπύρος', 'Ευτυχία', 'Τάσος', 'Ραφαέλα', 'Ηλίας', 'Αγγελική', 'Νεφέλη', 'Χάρης',
    'Δήμητρα', 'Φίλιππος', 'Αναστασία', 'Μιχάλης', 'Ευαγγελία', 'Λάμπρος'
  ];

  squad_handles text[] := array[
    'kalamaria_crew', 'ano_poli_nights', 'freddo_fanatics', 'tsimiski_runners',
    'jazz_lovers_skg', 'rooftop_crew', 'green_walkers', 'cine_club_skg',
    'vinyl_sundays', 'sunset_kayak', 'quiz_night_skg', 'street_food_hunters'
  ];
  squad_names text[] := array[
    'Kalamaria Crew', 'Ano Poli Nights', 'Freddo Fanatics', 'Tsimiski Runners',
    'Jazz Lovers', 'Rooftop Crew', 'Green Walkers', 'Cine Club SKG',
    'Vinyl Sundays', 'Sunset Kayak', 'Quiz Night SKG', 'Street Food Hunters'
  ];
  squad_bios text[] := array[
    'Από την παραλία της Καλαμαριάς μέχρι αργά.',
    'Τα καλύτερα μπαλκόνια της πόλης είναι στην Άνω Πόλη.',
    'Δεν περνάει μέρα χωρίς freddo espresso.',
    'Τρέχουμε Τρίτη και Πέμπτη, τρώμε Σάββατο.',
    'Live jazz κάθε Παρασκευή. Ανοιχτά πλάνα, έλα όπως είσαι.',
    'Ταράτσες, cocktails και θέα στον Θερμαϊκό.',
    'Πεζοπορίες γύρω από τη Θεσσαλονίκη, κάθε Κυριακή.',
    'Μία ταινία την εβδομάδα και πολλή κουβέντα μετά.',
    'Δίσκοι βινυλίου και καφές κάθε Κυριακή πρωί.',
    'Καγιάκ στο ηλιοβασίλεμα όταν το επιτρέπει ο καιρός.',
    'Κουίζ στα μπαρ της πόλης, χάνουμε με στιλ.',
    'Ψάχνουμε το καλύτερο σουβλάκι της Θεσσαλονίκης.'
  ];

  titles text[] := array[
    'Καφές στην Αριστοτέλους', 'Βόλτα στη Νέα Παραλία', 'Ποτά στα Λαδάδικα',
    'Ηλιοβασίλεμα στο Επταπύργιο', 'Μεζέδες στο Καπάνι', 'Παγωτό στον Λευκό Πύργο',
    'Ροτόντα και Καμάρα', 'Συναυλία στο Μέγαρο', 'Πεζοπορία στο Σέιχ Σου',
    'Brunch στη Ναυαρίνου', 'Σινεμά στο λιμάνι', 'Board games στο κέντρο',
    'Jazz στο Μπιτ Παζάρ', 'Rooftop cocktails', 'Κουίζ στα Βαλαωρίτου',
    'Καγιάκ στην Περαία', 'Σουβλάκια στη Χαριλάου', 'Τρέξιμο στην παραλία',
    'Δίσκοι και καφές στην Άθωνος', 'Picnic στο Σέιχ Σου'
  ];
  locations text[] := array[
    'Πλατεία Αριστοτέλους', 'Ομπρέλες Ζογγολόπουλου', 'Λαδάδικα',
    'Επταπύργιο', 'Αγορά Καπάνι', 'Λευκός Πύργος',
    'Ροτόντα', 'Μέγαρο Μουσικής', 'Σέιχ Σου',
    'Πλατεία Ναυαρίνου', 'Αποθήκη Α''', 'Αγία Σοφία',
    'Μπιτ Παζάρ', 'Τσιμισκή 43', 'Βαλαωρίτου',
    'Παραλία Περαίας', 'Χαριλάου', 'Νέα Παραλία',
    'Πλατεία Άθωνος', 'Δάσος Σέιχ Σου'
  ];
  labels text[] := array[
    'Κέντρο, Θεσσαλονίκη', 'Νέα Παραλία, Θεσσαλονίκη', 'Λαδάδικα, Θεσσαλονίκη',
    'Άνω Πόλη, Θεσσαλονίκη', 'Κέντρο, Θεσσαλονίκη', 'Λευκός Πύργος, Θεσσαλονίκη',
    'Κέντρο, Θεσσαλονίκη', 'Καλαμαριά, Θεσσαλονίκη', 'Σέιχ Σου, Θεσσαλονίκη',
    'Κέντρο, Θεσσαλονίκη', 'Λιμάνι, Θεσσαλονίκη', 'Κέντρο, Θεσσαλονίκη',
    'Άνω Λαδάδικα, Θεσσαλονίκη', 'Κέντρο, Θεσσαλονίκη', 'Κέντρο, Θεσσαλονίκη',
    'Περαία, Θεσσαλονίκη', 'Χαριλάου, Θεσσαλονίκη', 'Νέα Παραλία, Θεσσαλονίκη',
    'Κέντρο, Θεσσαλονίκη', 'Σέιχ Σου, Θεσσαλονίκη'
  ];
  lats float8[] := array[40.6325, 40.6182, 40.6357, 40.6440, 40.6377, 40.6264, 40.6333, 40.5947, 40.6490, 40.6308,
                         40.6345, 40.6327, 40.6369, 40.6311, 40.6340, 40.5575, 40.6005, 40.6150, 40.6360, 40.6520];
  lngs float8[] := array[22.9410, 22.9530, 22.9372, 22.9617, 22.9408, 22.9484, 22.9527, 22.9519, 22.9760, 22.9490,
                         22.9337, 22.9469, 22.9425, 22.9440, 22.9395, 22.9280, 22.9715, 22.9580, 22.9445, 22.9810];
  tags text[] := array['coffee', 'outdoors', 'drinks', 'outdoors', 'food', 'outdoors', 'culture', 'music', 'sports', 'food',
                       'culture', 'games', 'music', 'drinks', 'games', 'sports', 'food', 'sports', 'music', 'outdoors'];
  starts time[] := array['11:00', '19:00', '21:30', '19:30', '13:30', '18:00', '17:00', '20:30', '10:00', '12:00',
                         '20:00', '18:30', '21:30', '22:00', '21:00', '18:30', '20:30', '08:00', '11:30', '12:30'];
  ends time[] := array['13:00', '21:00', '23:30', '21:00', '15:30', '19:30', '18:30', '22:30', '12:30', '14:00',
                       '22:30', '21:30', '23:59', '23:59', '23:30', '20:30', '22:00', '09:00', '13:30', '16:00'];
  blurbs text[] := array[
    'Έλα κι εσύ, θα περάσουμε ωραία.',
    'Όποιος αργεί κερνάει τον πρώτο γύρο.',
    'Φέρτε νερό και καλή διάθεση.',
    'Κλείνω τραπέζι, πείτε μου μέχρι το μεσημέρι.',
    'Χαλαρά, όποιος μπορεί.',
    'Θα ανεβάσω φωτογραφίες μετά, μην ανησυχείτε.'
  ];

  -- Days relative to today: plenty of past nights and plenty coming up.
  offsets int[] := array[-42, -35, -28, -21, -16, -12, -8, -5, -3, -1, 0, 1, 2, 4, 7, 11, 16, 23];

  chat text[] := array[
    'Καλημέρα παίδες ☀️', 'Ποιος είναι για σήμερα;', 'Εγώ μέσα, αλλά θα αργήσω λίγο',
    'Να κλείσουμε τραπέζι;', 'Ναι, για 6 άτομα λέω', 'Φέρνει κανείς αυτοκίνητο;',
    'Θα έρθω με τα πόδια, είναι 10 λεπτά', 'Τέλεια ιδέα 🔥', 'Ρε σεις βρέχει;',
    'Όχι, 22 βαθμούς έχει', 'Κάτσε να δω τι ώρα σχολάω', 'Ποιος θα πάρει τα εισιτήρια;',
    'Τα παίρνω εγώ, μου στέλνετε μετά', 'Φωτογραφίες από χθες όποιος έχει!', 'Στο προηγούμενο ήταν απίστευτα',
    'Να το ξανακάνουμε την άλλη βδομάδα', 'Είμαι καθ'' οδόν 🏃', 'Είμαστε στο τραπέζι δεξιά',
    'Ευχαριστώ για σήμερα, ήταν τέλεια ❤️', 'Κάποιος να μου στείλει τη διεύθυνση', 'Πάρκαρα, έρχομαι',
    'Παρασκευή ή Σάββατο;', 'Σάββατο μου κάνει καλύτερα', 'Εγώ και τα δύο 😅',
    'Λέω να δοκιμάσουμε κάτι καινούριο', 'Ποιος ξέρει καλό μέρος για φαγητό;', 'Στη Χαριλάου έχει τα καλύτερα',
    'Θα φέρω και μια φίλη, οκ;', 'Φυσικά!', 'Χαχαχα όχι πάλι αυτό 😂',
    'Ποιος κερδίζει στο κουίζ φέτος;', 'Εμείς σίγουρα όχι', 'Βάλτε ξυπνητήρι, 8 το πρωί!',
    'Ποιος το είπε αυτό 😴', 'Καλή ιδέα, μέσα', 'Θα δω και θα σας πω',
    'Είναι ανοιχτό μέχρι αργά;', 'Μέχρι τις 2', 'Ωραία, πάμε!', 'Καληνύχτα παίδες 🌙'
  ];
  emojis text[] := array['❤️', '😂', '🔥', '👍', '🎉', '😍', '🙌'];

  demo_ids uuid[] := array[]::uuid[];
  real_ids uuid[];
  real_names text[];
  member_ids uuid[];
  squad_id uuid;
  event_id uuid;
  message_id uuid;
  previous_id uuid;
  sender uuid;
  person text;
  handle text;
  place int;
  day int;
  starts_at time;
  ends_at time;
  body text;
  roll float8;
  sent_at timestamptz;
  size int;
begin
  perform setseed(0.31);

  select coalesce(array_agg(id order by created_at), array[]::uuid[]),
         coalesce(array_agg(display_name order by created_at), array[]::text[])
    into real_ids, real_names
  from public.profiles;

  -- People (names are unique in the app, so a clash gets a suffix).
  for i in 1..array_length(people, 1) loop
    person := people[i];
    if exists (select 1 from public.profiles where display_name = person) then
      person := person || ' ' || i;
    end if;

    demo_ids := demo_ids || md5('squaddict-more-user-' || i)::uuid;
    insert into public.profiles (id, display_name, avatar_url, created_at)
    values (demo_ids[i], person,
            case when i % 4 <> 0 then 'https://picsum.photos/seed/sqd-person-' || i || '/300/300' end,
            now() - (120 - i) * interval '1 day');
  end loop;

  for s in 1..12 loop
    squad_id := md5('squaddict-more-squad-' || s)::uuid;

    -- 5 to 9 members each, overlapping with the neighbouring squads.
    size := 5 + (s % 5);
    member_ids := array[]::uuid[];
    for k in 0..size - 1 loop
      member_ids := member_ids || demo_ids[((s - 1) * 3 + k) % 30 + 1];
    end loop;

    handle := squad_handles[s];
    if exists (select 1 from public.groups where groups.handle = squad_handles[s]) then
      handle := left(squad_handles[s], 26) || '_' || s;
    end if;

    insert into public.groups (id, name, created_by, handle, bio, avatar_url, created_at)
    values (squad_id, squad_names[s], member_ids[1], handle, squad_bios[s],
            'https://picsum.photos/seed/sqd-squad-' || s || '/300/300',
            now() - (100 - s * 3) * interval '1 day');

    insert into public.group_members (group_id, user_id, joined_at, last_read_at)
    select squad_id, t.uid, now() - interval '90 days' + (t.ord * interval '2 days'), now()
    from unnest(member_ids) with ordinality as t(uid, ord);

    if s <= 5 then
      insert into public.group_members (group_id, user_id, joined_at, last_read_at)
      select squad_id, r, now() - interval '45 days', now() - interval '6 hours'
      from unnest(real_ids) as r
      on conflict do nothing;
    end if;

    insert into public.group_invites (group_id, code) values (squad_id, public.new_invite_code());

    -- Plans.
    for e in 1..array_length(offsets, 1) loop
      day := offsets[e];
      -- Squads skip a few dates so their calendars don't all look the same.
      continue when (s + e) % 4 = 0 and day <> 0;

      place := ((s - 1) * 5 + e * 3) % 20 + 1;
      starts_at := starts[place];
      ends_at := ends[place];

      -- A few plans are happening right now.
      if day = 0 and s in (1, 3, 6, 9) then
        starts_at := (now() - interval '1 hour')::time;
        ends_at := case when (now() + interval '3 hours')::date = current_date
                        then (now() + interval '3 hours')::time else '23:59' end;
      end if;

      insert into public.events
        (group_id, created_by, title, date, start_time, end_time, location,
         description, lat, lng, tags, is_public, created_at)
      values
        (squad_id, member_ids[(e - 1) % size + 1], titles[place], current_date + day,
         starts_at, ends_at, locations[place],
         blurbs[(s + e) % 6 + 1],
         lats[place] + (random() - 0.5) * 0.004, lngs[place] + (random() - 0.5) * 0.004,
         array[tags[place]], s > 5 or e % 3 = 0,
         now() - interval '50 days' + (e * interval '2 days'))
      returning id into event_id;

      foreach sender in array member_ids loop
        roll := random();
        if roll < 0.6 then
          insert into public.event_attendees (event_id, user_id, status) values (event_id, sender, 'in');
        elsif roll < 0.8 then
          insert into public.event_attendees (event_id, user_id, status) values (event_id, sender, 'out');
        end if;
      end loop;

      -- Real accounts: in on most past nights, some upcoming ones left for them to answer.
      if s <= 5 and (day < 0 or e % 2 = 0) then
        insert into public.event_attendees (event_id, user_id, status)
        select event_id, r, 'in' from unnest(real_ids) as r
        on conflict do nothing;
      end if;
    end loop;

    -- Chat: 40 messages over the last two days, the newest ones unread.
    previous_id := null;
    for m in 1..40 loop
      sender := member_ids[(m * 7 + s) % size + 1];
      sent_at := now() - ((40 - m) * interval '70 minutes') - (s * interval '9 minutes');
      body := chat[((s - 1) * 5 + m - 1) % array_length(chat, 1) + 1];

      if m = 37 and s <= 5 and array_length(real_ids, 1) > 0 then
        body := '@' || real_names[1] || ' έρχεσαι;';
      end if;

      insert into public.messages (group_id, sender_id, content, created_at, edited_at, reply_to)
      values (squad_id, sender, body, sent_at,
              case when m % 11 = 0 then sent_at + interval '3 minutes' end,
              case when m % 6 = 0 then previous_id end)
      returning id into message_id;

      if m = 37 and s <= 5 and array_length(real_ids, 1) > 0 then
        insert into public.message_mentions (message_id, user_id) values (message_id, real_ids[1]);
      end if;

      insert into public.message_reactions (message_id, user_id, emoji)
      select message_id, reactor, emojis[1 + floor(random() * array_length(emojis, 1))::int]
      from unnest(member_ids) as reactor
      where reactor <> sender and random() < 0.25;

      previous_id := message_id;
    end loop;
  end loop;
end $$;

-- Extras for the newer features. Each part runs only if its SQL has been applied.
do $$
declare
  squads uuid[] := array(select md5('squaddict-more-squad-' || n)::uuid from generate_series(1, 12) n);
  people uuid[] := array(select md5('squaddict-more-user-' || n)::uuid from generate_series(1, 30) n);
begin
  perform setseed(0.77);

  -- Place names under the title (parea_going.sql / explore).
  if exists (select 1 from information_schema.columns
              where table_schema = 'public' and table_name = 'events' and column_name = 'place_label') then
    execute $sql$
      update public.events e
         set place_label = coalesce(e.place_label, 'Θεσσαλονίκη')
       where e.group_id = any($1)
    $sql$ using squads;
  end if;

  -- Covers: a photo behind most tickets.
  if exists (select 1 from information_schema.columns
              where table_schema = 'public' and table_name = 'events' and column_name = 'cover_url') then
    execute $sql$
      update public.events e
         set cover_url = 'https://picsum.photos/seed/sqd-' || left(md5(e.id::text), 10) || '/1280/720'
       where e.group_id = any($1)
         and random() < 0.75
    $sql$ using squads;
  end if;

  -- Squad look: banners, and public memories for half of them.
  if exists (select 1 from information_schema.columns
              where table_schema = 'public' and table_name = 'groups' and column_name = 'banner_url') then
    execute $sql$
      update public.groups g
         set banner_url = 'https://picsum.photos/seed/sqd-banner-' || left(md5(g.id::text), 8) || '/1200/600',
             memories_public = (get_byte(decode(md5(g.id::text), 'hex'), 0) % 2 = 0)
       where g.id = any($1)
    $sql$ using squads;
  end if;

  -- Check-ins: people who are in on a plan happening now are already there.
  if to_regclass('public.event_checkins') is not null then
    execute $sql$
      insert into public.event_checkins (event_id, user_id, checked_in_at)
      select a.event_id, a.user_id, now() - (random() * interval '50 minutes')
        from public.event_attendees a
        join public.events e on e.id = a.event_id
       where e.group_id = any($1)
         and a.user_id = any($2)
         and a.status = 'in'
         and e.date = current_date
         and e.start_time <= now()::time
         and random() < 0.7
      on conflict do nothing
    $sql$ using squads, people;
  end if;

  -- Squads following squads (about a third of all pairs).
  if to_regclass('public.squad_follows') is not null then
    execute $sql$
      insert into public.squad_follows (follower_group_id, followed_group_id, created_by, created_at)
      select a, b,
             (select m.user_id from public.group_members m where m.group_id = a order by m.joined_at limit 1),
             now() - (random() * interval '40 days')
        from unnest($1) a
        cross join unnest($1) b
       where a <> b and random() < 0.33
      on conflict do nothing
    $sql$ using squads;
  end if;

  -- People following squads they are not in (older follows.sql).
  if to_regclass('public.parea_follows') is not null then
    execute $sql$
      insert into public.parea_follows (group_id, user_id)
      select g, p
        from unnest($1) g
        cross join unnest($2) p
       where not exists (select 1 from public.group_members m where m.group_id = g and m.user_id = p)
         and random() < 0.3
      on conflict do nothing
    $sql$ using squads, people;
  end if;
end $$;

commit;

select g.name as squad,
       g.member_count as members,
       (select count(*) from public.events e where e.group_id = g.id) as plans,
       (select count(*) from public.events e where e.group_id = g.id and e.date < current_date) as past,
       (select count(*) from public.events e where e.group_id = g.id and e.is_public) as public_plans,
       (select count(*) from public.messages m where m.group_id = g.id) as messages
from public.groups g
where g.id in (select md5('squaddict-more-squad-' || n)::uuid from generate_series(1, 12) n)
order by g.name;

-- Cleanup: removes every squad (with its plans, chat and members) and every person this made.
-- delete from public.groups   where id in (select md5('squaddict-more-squad-' || n)::uuid from generate_series(1, 12) n);
-- delete from public.profiles where id in (select md5('squaddict-more-user-'  || n)::uuid from generate_series(1, 30) n);
