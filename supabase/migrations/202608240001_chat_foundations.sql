-- Θεμέλια του chat: η Παρέα γίνεται λογαριασμός (δημόσιο προφίλ, κλειστό
-- περιεχόμενο), τα μυστικά φεύγουν από τον δημόσιο πίνακα, και γράφονται τα
-- κανονικά RLS policies.
--
-- ΠΡΟΣΟΧΗ: αυτό το migration ΔΕΝ σβήνει τα "dev all" policies. Όσο υπάρχουν,
-- τα παρακάτω policies είναι ανενεργά (τα permissive policies ενώνονται με OR).
-- Τρέξε πρώτα αυτό, επιβεβαίωσε ότι η εφαρμογή δουλεύει, και μετά το
-- 202608240002_drop_dev_policies.sql που κάνει την πραγματική μετάβαση.

-- ---------------------------------------------------------------------------
-- 0. Σκλήρυνση του υπάρχοντος helper.
--    stable      -> τρέχει μία φορά ανά query αντί για μία ανά γραμμή.
--    search_path -> μια security definer συνάρτηση χωρίς καρφωμένο search_path
--                   είναι δρόμος ανόδου δικαιωμάτων.
-- ---------------------------------------------------------------------------

alter function public.my_group_ids() stable security definer set search_path = public;

-- ---------------------------------------------------------------------------
-- 1. Ασφαλιστική δικλείδα: σταματάμε ΠΡΙΝ αγγίξουμε δεδομένα, αν κάτι δεν είναι
--    όπως το περιμένουμε. Καμία σιωπηλή διαγραφή.
-- ---------------------------------------------------------------------------

do $$
declare orphan_messages int;
begin
  select count(*) into orphan_messages
  from public.messages
  where group_id is null or sender_id is null;

  if orphan_messages > 0 then
    raise exception
      'Βρέθηκαν % μηνύματα με NULL group_id ή sender_id. Δες τα και διόρθωσέ τα πριν ξανατρέξεις το migration.',
      orphan_messages;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 2. profiles: το id οφείλει να ΕΙΝΑΙ το auth.users.id, όχι τυχαίο uuid.
--    Το email είναι διπλότυπο του auth.users και δεν το διαβάζει κανείς.
-- ---------------------------------------------------------------------------

alter table public.profiles alter column id drop default;
alter table public.profiles drop column if exists email;

do $$
declare ghosts int;
begin
  select count(*) into ghosts
  from public.profiles p
  left join auth.users u on u.id = p.id
  where u.id is null;

  if ghosts > 0 then
    raise notice
      'Παραλείπω το foreign key profiles -> auth.users: % προφίλ δεν αντιστοιχούν σε χρήστη.',
      ghosts;
  else
    alter table public.profiles drop constraint if exists profiles_id_fkey;
    alter table public.profiles
      add constraint profiles_id_fkey
      foreign key (id) references auth.users(id) on delete cascade;
  end if;
end $$;

-- Το προφίλ φτιάχνεται πλέον μέσα στην ίδια συναλλαγή με τον χρήστη. Ο client
-- δεν το αγγίζει: αν το έκανε, ένα email confirmation ή μια διακοπή δικτύου
-- άφηνε λογαριασμό χωρίς προφίλ — και τα foreign keys του group_members και του
-- messages δείχνουν στο profiles, άρα ο λογαριασμός θα ήταν μόνιμα άχρηστος.
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(
      nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''),
      split_part(new.email, '@', 1)
    )
  )
  on conflict (id) do nothing;

  return new; 
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- 3. Η Παρέα γίνεται λογαριασμός: handle μοναδικό + εμφανιζόμενο όνομα.
-- ---------------------------------------------------------------------------

alter table public.groups add column if not exists handle       text;
alter table public.groups add column if not exists bio          text;
alter table public.groups add column if not exists avatar_url   text;
alter table public.groups add column if not exists member_count integer not null default 0;

-- Προσωρινό slugify για το backfill: πρώτα τα δίψηφα (θ/χ/ψ), μετά 1:1 με
-- translate. Πέφτει στο τέλος του migration.
create or replace function public.__slugify(txt text)
returns text language sql immutable as $$
  select trim(both '_' from
    regexp_replace(
      regexp_replace(
        translate(
          replace(replace(replace(lower(txt), 'θ', 'th'), 'χ', 'ch'), 'ψ', 'ps'),
          'άέήίόύώϊϋΐΰαβγδεζηικλμνξοπρσςτυφω',
          'aeiioyoiyiyavgdeziiklmnxoprsstyfo'
        ),
      '[^a-z0-9]+', '_', 'g'),
    '_+', '_', 'g')
  )
$$;

with slugged as (
  select
    id,
    left(coalesce(nullif(public.__slugify(name), ''), 'squad'), 24) as base
  from public.groups
  where handle is null
),
numbered as (
  select
    id,
    case when length(base) < 3 then base || 'squad' else base end as base,
    row_number() over (partition by base order by id) as rn
  from slugged
)
update public.groups g
set handle = case when n.rn = 1 then n.base else n.base || '_' || n.rn end
from numbered n
where g.id = n.id;

alter table public.groups alter column handle set not null;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'groups_handle_key') then
    alter table public.groups add constraint groups_handle_key unique (handle);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'groups_handle_format') then
    alter table public.groups add constraint groups_handle_format
      check (handle ~ '^[a-z0-9_]{3,30}$');
  end if;

  if not exists (select 1 from pg_constraint where conname = 'groups_bio_length') then
    alter table public.groups add constraint groups_bio_length
      check (bio is null or length(bio) <= 160);
  end if;
end $$;

-- Αν ο δημιουργός σβήσει τον λογαριασμό του, η Παρέα και το ιστορικό της δεν
-- έχουν λόγο να πεθάνουν μαζί του.
alter table public.groups drop constraint if exists groups_created_by_fkey;
alter table public.groups
  add constraint groups_created_by_fkey
  foreign key (created_by) references public.profiles(id) on delete set null;

-- Το handle είναι ταυτότητα. Η αλλαγή του θέλει ιστορικό παλιών handles ώστε να
-- μην τα αρπάξει αμέσως κάποιος άλλος — δουλειά επόμενης φάσης. Ο έλεγχος του
-- auth.uid() αφήνει τον ιδιοκτήτη της βάσης να διορθώσει handle από το
-- dashboard· η εφαρμογή δεν μπορεί.
create or replace function public.lock_group_handle()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if new.handle is distinct from old.handle and auth.uid() is not null then
    raise exception 'A squad handle cannot be changed.';
  end if;

  return new;
end $$;

drop trigger if exists groups_handle_locked on public.groups;
create trigger groups_handle_locked
  before update on public.groups
  for each row execute function public.lock_group_handle();

-- ---------------------------------------------------------------------------
-- 4. member_count: το πλήθος μελών είναι δημόσιο, ο πίνακας group_members όχι.
--    Χωρίς αυτή τη στήλη ένας μη-μέλος δεν θα μπορούσε να το μετρήσει.
-- ---------------------------------------------------------------------------

create or replace function public.sync_group_member_count()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    update public.groups
      set member_count = member_count + 1
      where id = new.group_id;
  elsif tg_op = 'DELETE' then
    update public.groups
      set member_count = greatest(member_count - 1, 0)
      where id = old.group_id;
  end if;

  return null;
end $$;

drop trigger if exists group_members_count on public.group_members;
create trigger group_members_count
  after insert or delete on public.group_members
  for each row execute function public.sync_group_member_count();

-- ---------------------------------------------------------------------------
-- 5. group_members: χωρίς primary key ο ίδιος χρήστης μπαίνει δύο φορές στην
--    ίδια Παρέα και το member_count βγαίνει λάθος.
-- ---------------------------------------------------------------------------

delete from public.group_members a
using public.group_members b
where a.ctid > b.ctid
  and a.group_id = b.group_id
  and a.user_id = b.user_id;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'group_members_pkey') then
    alter table public.group_members add constraint group_members_pkey
      primary key (group_id, user_id);
  end if;
end $$;

-- Για τα unread της επόμενης φάσης. Τα υπάρχοντα μέλη ξεκινούν "διαβασμένα".
alter table public.group_members
  add column if not exists last_read_at timestamptz not null default now();

update public.groups g
set member_count = (
  select count(*) from public.group_members m where m.group_id = g.id
);

-- ---------------------------------------------------------------------------
-- 6. Ο κωδικός πρόσκλησης φεύγει από τον δημόσιο πίνακα.
--    Το RLS κρύβει γραμμές, όχι στήλες: αν το groups γίνει δημόσια αναγνώσιμο
--    ενώ ο κωδικός κάθεται μέσα του, το invite-only καταρρέει σιωπηλά.
--
--    Οι παλιοί κωδικοί (6 δεκαεξαδικά από md5(random)) ΔΕΝ μεταφέρονται: ~16
--    εκατομμύρια συνδυασμοί σπάνε με script. Παράγονται καινούργιοι, άρα οι
--    παλιές προσκλήσεις παύουν να ισχύουν.
-- ---------------------------------------------------------------------------

create or replace function public.new_invite_code()
returns text language sql volatile as $$
  select upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10))
$$;

create table if not exists public.group_invites (
  group_id   uuid        primary key references public.groups(id) on delete cascade,
  code       text        not null unique check (code ~ '^[A-Z0-9]{10}$'),
  created_at timestamptz not null default now()
);

-- Ακύρωση παλιού + νέος κωδικός, σε μία συναλλαγή: αλλιώς μια διακοπή ανάμεσα
-- στο delete και το insert αφήνει Παρέα χωρίς κανέναν κωδικό πρόσκλησης.
-- ΔΕΝ είναι security definer επίτηδες — έτσι το RLS επιβάλλει ότι μόνο μέλος
-- μπορεί να αλλάξει τον κωδικό.
create or replace function public.rotate_invite_code(target_group uuid)
returns text
language plpgsql
set search_path = public
as $$
declare fresh text;
begin
  delete from public.group_invites where group_id = target_group;

  fresh := public.new_invite_code();
  insert into public.group_invites (group_id, code) values (target_group, fresh);

  return fresh;
end $$;

revoke all on function public.rotate_invite_code(uuid) from public;
grant execute on function public.rotate_invite_code(uuid) to authenticated;

insert into public.group_invites (group_id, code)
select id, public.new_invite_code() from public.groups
on conflict (group_id) do nothing;

alter table public.groups drop column if exists invite_code;

-- ---------------------------------------------------------------------------
-- 7. messages: ένα μήνυμα χωρίς παρέα ή αποστολέα δεν έχει νόημα — και το RLS
--    `group_id in (...)` αφήνει το NULL να γλιστρήσει.
-- ---------------------------------------------------------------------------

alter table public.messages alter column group_id  set not null;
alter table public.messages alter column sender_id set not null;

create index if not exists messages_group_created_idx
  on public.messages (group_id, created_at);

-- ---------------------------------------------------------------------------
-- 8. Το join: ένας μη-μέλος δεν βλέπει το group_invites, άρα δεν μπορεί να βρει
--    την Παρέα από τον κωδικό μόνος του. Ίδιο σφάλμα σε κάθε αποτυχία, ώστε να
--    μη γίνεται μαντεψιά κωδικών.
-- ---------------------------------------------------------------------------

create or replace function public.join_squad(invite_code text)
returns public.groups
language plpgsql security definer set search_path = public
as $$
declare
  target public.groups;
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'Sign in to continue.';
  end if;

  select g.* into target
  from public.groups g
  join public.group_invites i on i.group_id = g.id
  where i.code = upper(trim(invite_code));

  if not found then
    raise exception 'That invite code is not valid.';
  end if;

  insert into public.group_members (group_id, user_id)
  values (target.id, uid)
  on conflict do nothing;

  -- Ξαναδιαβάζουμε: το member_count μόλις άλλαξε από τον trigger.
  select g.* into target from public.groups g where g.id = target.id;

  return target;
end $$;

revoke all on function public.join_squad(text) from public;
grant execute on function public.join_squad(text) to authenticated;

-- ---------------------------------------------------------------------------
-- 9. Τα κανονικά policies.
-- ---------------------------------------------------------------------------

alter table public.profiles      enable row level security;
alter table public.groups        enable row level security;
alter table public.group_members enable row level security;
alter table public.group_invites enable row level security;
alter table public.messages      enable row level security;
alter table public.events        enable row level security;

-- groups: δημόσιο προφίλ. Το "read my groups" ήταν σωστό για κλειστό μοντέλο,
-- αλλά η Παρέα είναι πλέον λογαριασμός με μοναδικό handle — και ο έλεγχος
-- "είναι πιασμένο;" απαιτεί να τη βλέπει και ο μη-μέλος.
drop policy if exists "read my groups"            on public.groups;
drop policy if exists "squad profiles are public" on public.groups;
drop policy if exists "create own squad"          on public.groups;
drop policy if exists "creator updates squad"     on public.groups;
drop policy if exists "creator deletes squad"     on public.groups;

create policy "squad profiles are public" on public.groups
  for select using (true);

create policy "create own squad" on public.groups
  for insert to authenticated with check (created_by = auth.uid());

create policy "creator updates squad" on public.groups
  for update to authenticated
  using (created_by = auth.uid()) with check (created_by = auth.uid());

create policy "creator deletes squad" on public.groups
  for delete to authenticated using (created_by = auth.uid());

-- group_invites: ο κωδικός είναι ορατός μόνο σε όσους είναι ήδη μέσα.
drop policy if exists "members read invite"   on public.group_invites;
drop policy if exists "members rotate invite" on public.group_invites;
drop policy if exists "members revoke invite" on public.group_invites;

create policy "members read invite" on public.group_invites
  for select to authenticated
  using (group_id in (select public.my_group_ids()));

create policy "members rotate invite" on public.group_invites
  for insert to authenticated
  with check (group_id in (select public.my_group_ids()));

create policy "members revoke invite" on public.group_invites
  for delete to authenticated
  using (group_id in (select public.my_group_ids()));

-- group_members: μπαίνεις μόνο ως ο εαυτός σου· φεύγεις μόνος σου, ή σε βγάζει
-- ο δημιουργός.
drop policy if exists "join as self" on public.group_members;
drop policy if exists "leave squad"  on public.group_members;

create policy "join as self" on public.group_members
  for insert to authenticated with check (user_id = auth.uid());

create policy "leave squad" on public.group_members
  for delete to authenticated
  using (
    user_id = auth.uid()
    or exists (
      select 1 from public.groups g
      where g.id = group_members.group_id and g.created_by = auth.uid()
    )
  );

-- profiles: ο εαυτός σου, ή όποιος μοιράζεται Παρέα μαζί σου.
drop policy if exists "read own profile"        on public.profiles;
drop policy if exists "read squadmate profiles" on public.profiles;
drop policy if exists "update own profile"      on public.profiles;

create policy "read own profile" on public.profiles
  for select to authenticated using (id = auth.uid());

create policy "read squadmate profiles" on public.profiles
  for select to authenticated
  using (
    exists (
      select 1 from public.group_members m
      where m.user_id = profiles.id
        and m.group_id in (select public.my_group_ids())
    )
  );

create policy "update own profile" on public.profiles
  for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- events: ο πίνακας είχε ΜΟΝΟ το "dev all events". Χωρίς αυτά εδώ, η οθόνη των
-- events σταματά να δουλεύει τη στιγμή που πέφτουν τα dev policies.
drop policy if exists "read events of my squads" on public.events;
drop policy if exists "members create events"    on public.events;
drop policy if exists "creator updates event"    on public.events;
drop policy if exists "creator deletes event"    on public.events;

create policy "read events of my squads" on public.events
  for select to authenticated
  using (group_id in (select public.my_group_ids()));

create policy "members create events" on public.events
  for insert to authenticated
  with check (created_by = auth.uid() and group_id in (select public.my_group_ids()));

create policy "creator updates event" on public.events
  for update to authenticated
  using (created_by = auth.uid()) with check (created_by = auth.uid());

create policy "creator deletes event" on public.events
  for delete to authenticated using (created_by = auth.uid());

-- ---------------------------------------------------------------------------
-- 10. Καθάρισμα.
-- ---------------------------------------------------------------------------

drop function if exists public.__slugify(text);
