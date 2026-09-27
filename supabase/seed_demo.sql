-- Demo data for the whole app: people, squads, members, invites, events, RSVPs,
-- chat messages with replies, reactions and mentions — all around Thessaloniki.
--
-- Every real account that already exists joins the first 4 demo squads, so you see
-- everything when you sign in. The last 2 squads stay "strangers" for Explore.
--
-- Demo rows use fixed ids, so running this again replaces them instead of duplicating.
-- To remove everything it created, run the cleanup block at the bottom.

begin;

-- Seeded rows must not send push notifications (see push_notifications.sql).
set local squaddict.skip_push = 'on';

delete from public.groups
where id in (select md5('squaddict-demo-squad-' || n)::uuid from generate_series(1, 6) n);

delete from public.profiles
where id in (select md5('squaddict-demo-user-' || n)::uuid from generate_series(1, 12) n);

do $$
declare
  people text[] := array[
    'Μαρία', 'Νίκος', 'Ελένη', 'Γιώργος', 'Κατερίνα', 'Κώστας',
    'Σοφία', 'Γιάννης', 'Χριστίνα', 'Στέλιος', 'Ιωάννα', 'Θοδωρής'
  ];

  squad_handles text[] := array[
    'thess_coffee_club', 'ladadika_nights', 'seich_sou_hikers',
    'board_game_bros', 'sunday_brunch_skg', 'auth_uni_crew'
  ];
  squad_names text[] := array[
    'Thess Coffee Club', 'Ladadika Nights', 'Seich Sou Hikers',
    'Board Game Bros', 'Sunday Brunch SKG', 'AUTH Uni Crew'
  ];
  squad_bios text[] := array[
    'Freddo, κουβέντα και θέα στη θάλασσα.',
    'Τα βράδια μας στα Λαδάδικα.',
    'Κάθε Κυριακή στο δάσος, βρέξει χιονίσει.',
    'Catan, Codenames και πολύ τσάι.',
    'Αργά πρωινά, πολλά αυγά.',
    'Από το αμφιθέατρο στην Αριστοτέλους.'
  ];

  place_titles text[] := array[
    'Καφές στην Αριστοτέλους', 'Βόλτα στη Νέα Παραλία', 'Ποτά στα Λαδάδικα',
    'Ηλιοβασίλεμα στο Επταπύργιο', 'Μεζέδες στο Καπάνι', 'Παγωτό στον Λευκό Πύργο',
    'Ροτόντα και Καμάρα', 'Συναυλία στο Μέγαρο', 'Πεζοπορία στο Σέιχ Σου',
    'Brunch στη Ναυαρίνου', 'Σινεμά στο λιμάνι', 'Board games στο κέντρο'
  ];
  place_names text[] := array[
    'Πλατεία Αριστοτέλους', 'Ομπρέλες Ζογγολόπουλου', 'Λαδάδικα',
    'Επταπύργιο', 'Αγορά Καπάνι', 'Λευκός Πύργος',
    'Ροτόντα', 'Μέγαρο Μουσικής', 'Σέιχ Σου',
    'Πλατεία Ναυαρίνου', 'Αποθήκη Α''', 'Αγία Σοφία'
  ];
  place_labels text[] := array[
    'Πλατεία Αριστοτέλους, Θεσσαλονίκη', 'Νέα Παραλία, Θεσσαλονίκη', 'Λαδάδικα, Θεσσαλονίκη',
    'Άνω Πόλη, Θεσσαλονίκη', 'Αγορά Καπάνι, Θεσσαλονίκη', 'Λευκός Πύργος, Θεσσαλονίκη',
    'Ροτόντα, Θεσσαλονίκη', 'Μέγαρο Μουσικής Θεσσαλονίκης', 'Δάσος Σέιχ Σου, Θεσσαλονίκη',
    'Πλατεία Ναυαρίνου, Θεσσαλονίκη', 'Λιμάνι Θεσσαλονίκης', 'Πλατεία Αγίας Σοφίας, Θεσσαλονίκη'
  ];
  place_lats float8[] := array[40.6325, 40.6182, 40.6357, 40.6440, 40.6377, 40.6264,
                               40.6333, 40.5947, 40.6490, 40.6308, 40.6345, 40.6327];
  place_lngs float8[] := array[22.9410, 22.9530, 22.9372, 22.9617, 22.9408, 22.9484,
                               22.9527, 22.9519, 22.9760, 22.9490, 22.9337, 22.9469];
  place_tags text[] := array['coffee', 'outdoors', 'drinks', 'outdoors', 'food', 'outdoors',
                             'culture', 'music', 'sports', 'food', 'culture', 'games'];
  place_starts time[] := array['11:00', '19:00', '21:30', '19:30', '13:30', '18:00',
                               '17:00', '20:30', '10:00', '12:00', '20:00', '18:30'];
  place_ends time[] := array['13:00', '21:00', '23:30', '21:00', '15:30', '19:30',
                             '18:30', '22:30', '12:30', '14:00', '22:30', '21:30'];

  day_offsets int[] := array[-21, -9, -3, 0, 1, 3, 6, 10, 15];

  chat text[] := array[
    'Καλημέρα παίδες ☀️',
    'Ποιος είναι για σήμερα;',
    'Εγώ μέσα, αλλά θα αργήσω λίγο',
    'Να κλείσουμε τραπέζι;',
    'Ναι, για 6 άτομα λέω',
    'Φέρνει κανείς αυτοκίνητο;',
    'Θα έρθω με τα πόδια, είναι 10 λεπτά',
    'Το έστειλα και στο group της σχολής',
    'Τέλεια ιδέα 🔥',
    'Ρε σεις βρέχει;',
    'Όχι, 22 βαθμούς έχει',
    'Κάτσε να δω τι ώρα σχολάω',
    'Ποιος θα πάρει τα εισιτήρια;',
    'Τα παίρνω εγώ, μου στέλνετε μετά',
    'Φωτογραφίες από χθες όποιος έχει!',
    'Στο προηγούμενο ήταν απίστευτα',
    'Να το ξανακάνουμε την άλλη βδομάδα',
    'Είμαι καθ'' οδόν 🏃',
    'Είμαστε στο τραπέζι δεξιά',
    'Ευχαριστώ για σήμερα, ήταν τέλεια ❤️'
  ];
  emojis text[] := array['❤️', '😂', '🔥', '👍', '🎉', '😍'];

  demo_ids uuid[] := array[]::uuid[];
  real_ids uuid[];
  real_names text[];
  member_ids uuid[];
  squad_id uuid;
  event_id uuid;
  message_id uuid;
  previous_id uuid;
  sender uuid;
  place int;
  day int;
  starts time;
  ends time;
  body text;
  roll float8;
  sent_at timestamptz;
  person text;
begin
  perform setseed(0.42);

  select coalesce(array_agg(id order by created_at), array[]::uuid[]),
         coalesce(array_agg(display_name order by created_at), array[]::text[])
    into real_ids, real_names
  from public.profiles;

  for i in 1..array_length(people, 1) loop
    person := people[i];
    if exists (select 1 from public.profiles where display_name = person) then
      person := person || ' (demo)';
    end if;

    demo_ids := demo_ids || md5('squaddict-demo-user-' || i)::uuid;
    insert into public.profiles (id, display_name, created_at)
    values (demo_ids[i], person, now() - interval '90 days');
  end loop;

  for s in 1..6 loop
    squad_id := md5('squaddict-demo-squad-' || s)::uuid;

    member_ids := array[]::uuid[];
    for k in 0..5 loop
      member_ids := member_ids || demo_ids[((s - 1) * 2 + k) % 12 + 1];
    end loop;

    insert into public.groups (id, name, created_by, handle, bio, created_at)
    values (squad_id, squad_names[s], member_ids[1], squad_handles[s], squad_bios[s],
            now() - interval '60 days');

    insert into public.group_members (group_id, user_id, joined_at, last_read_at)
    select squad_id, t.uid, now() - interval '55 days' + (t.ord * interval '1 day'), now()
    from unnest(member_ids) with ordinality as t(uid, ord);

    if s <= 4 then
      insert into public.group_members (group_id, user_id, joined_at, last_read_at)
      select squad_id, r, now() - interval '30 days', now() - interval '5 hours'
      from unnest(real_ids) as r;
    end if;

    insert into public.group_invites (group_id, code) values (squad_id, public.new_invite_code());

    -- Events: 3 past, 1 today, 5 upcoming.
    for e in 1..array_length(day_offsets, 1) loop
      place := ((s - 1) * 3 + e - 1) % 12 + 1;
      day := day_offsets[e];
      starts := place_starts[place];
      ends := place_ends[place];

      if day = 0 and s in (1, 5) then
        place := (s * 5) % 12 + 1;
        starts := '00:00';
        ends := '23:59';
      end if;

      insert into public.events
        (group_id, created_by, title, date, start_time, end_time, location, place_label,
         description, lat, lng, tags, is_public, created_at)
      values
        (squad_id, member_ids[(e - 1) % 6 + 1], place_titles[place], current_date + day,
         starts, ends, place_names[place], place_labels[place],
         'Έλα κι εσύ, θα περάσουμε ωραία.', place_lats[place], place_lngs[place],
         array[place_tags[place]], e % 3 = 0 or (day = 0 and s in (1, 5)),
         now() - interval '40 days' + (e * interval '2 days'))
      returning id into event_id;

      foreach sender in array member_ids loop
        roll := random();
        if roll < 0.55 then
          insert into public.event_attendees (event_id, user_id, status) values (event_id, sender, 'in');
        elsif roll < 0.75 then
          insert into public.event_attendees (event_id, user_id, status) values (event_id, sender, 'out');
        end if;
      end loop;

      if s <= 4 and (day <= 0 or e % 2 = 0) then
        insert into public.event_attendees (event_id, user_id, status)
        select event_id, r, 'in' from unnest(real_ids) as r;
      end if;
    end loop;

    -- Chat: 18 messages over the last day, the last few unread for real accounts.
    previous_id := null;
    for m in 1..18 loop
      sender := member_ids[(m * 5 + s) % 6 + 1];
      sent_at := now() - ((18 - m) * interval '55 minutes') - interval '90 minutes' - (s * interval '7 minutes');
      body := chat[((s - 1) * 3 + m - 1) % array_length(chat, 1) + 1];

      if m = 16 and s <= 4 and array_length(real_ids, 1) > 0 then
        body := '@' || real_names[1] || ' έρχεσαι απόψε;';
      elsif m = 6 then
        body := '@' || (select display_name from public.profiles where id = member_ids[1]) || ' ' || body;
      end if;

      insert into public.messages (group_id, sender_id, content, created_at, edited_at, reply_to)
      values (squad_id, sender, body, sent_at,
              case when m = 4 then sent_at + interval '2 minutes' end,
              case when m % 5 = 0 then previous_id end)
      returning id into message_id;

      if m = 16 and s <= 4 and array_length(real_ids, 1) > 0 then
        insert into public.message_mentions (message_id, user_id) values (message_id, real_ids[1]);
      elsif m = 6 and sender <> member_ids[1] then
        insert into public.message_mentions (message_id, user_id) values (message_id, member_ids[1]);
      end if;

      insert into public.message_reactions (message_id, user_id, emoji)
      select message_id, reactor, emojis[1 + floor(random() * array_length(emojis, 1))::int]
      from unnest(member_ids) as reactor
      where reactor <> sender and random() < 0.3;

      previous_id := message_id;
    end loop;
  end loop;
end $$;

-- Extras for the newer features. Each part runs only if its SQL file has been
-- applied (memories.sql, event_covers.sql, follows.sql).
do $$
declare
  demo_squads uuid[] := array(select md5('squaddict-demo-squad-' || n)::uuid from generate_series(1, 6) n);
  demo_people uuid[] := array(select md5('squaddict-demo-user-' || n)::uuid from generate_series(1, 12) n);
begin
  perform setseed(0.7);

  -- Covers: a photo behind most demo tickets.
  if exists (select 1 from information_schema.columns
              where table_schema = 'public' and table_name = 'events' and column_name = 'cover_url') then
    execute $sql$
      update public.events e
         set cover_url = 'https://picsum.photos/seed/' || left(md5(e.title), 10) || '/1280/720'
       where e.group_id = any($1)
         and random() < 0.7
    $sql$ using demo_squads;
  end if;

  -- Check-ins: most demo people who are in on tonight's plans are already there.
  if to_regclass('public.event_checkins') is not null then
    execute $sql$
      insert into public.event_checkins (event_id, user_id, checked_in_at)
      select a.event_id, a.user_id, now() - (random() * interval '2 hours')
        from public.event_attendees a
        join public.events e on e.id = a.event_id
       where e.group_id = any($1)
         and a.user_id = any($2)
         and a.status = 'in'
         and e.date = current_date
         and random() < 0.6
      on conflict do nothing
    $sql$ using demo_squads, demo_people;
  end if;

  -- Follows: every real account follows the two "stranger" squads,
  -- and demo people follow squads they are not in.
  if to_regclass('public.group_follows') is not null then
    execute $sql$
      insert into public.group_follows (group_id, user_id)
      select g, p.id
        from unnest($1[5:6]) g
        cross join public.profiles p
       where p.id <> all($2)
      on conflict do nothing
    $sql$ using demo_squads, demo_people;

    execute $sql$
      insert into public.group_follows (group_id, user_id)
      select g, p
        from unnest($1) g
        cross join unnest($2) p
       where not exists (select 1 from public.group_members m where m.group_id = g and m.user_id = p)
         and random() < 0.35
      on conflict do nothing
    $sql$ using demo_squads, demo_people;
  end if;
end $$;

commit;

select g.name as squad,
       g.member_count as members,
       (select count(*) from public.events e where e.group_id = g.id) as events,
       (select count(*) from public.events e where e.group_id = g.id and e.is_public) as public_events,
       (select count(*) from public.messages m where m.group_id = g.id) as messages
from public.groups g
where g.id in (select md5('squaddict-demo-squad-' || n)::uuid from generate_series(1, 6) n)
order by g.name;

-- Cleanup: removes every demo squad (with its events, chat and members) and every demo person.
-- delete from public.groups   where id in (select md5('squaddict-demo-squad-' || n)::uuid from generate_series(1, 6) n);
-- delete from public.profiles where id in (select md5('squaddict-demo-user-'  || n)::uuid from generate_series(1, 12) n);
