-- Αντιδράσεις σε μηνύματα.
--
-- Μία ανά άτομο ανά μήνυμα: το primary key είναι (message_id, user_id) και το
-- πάτημα άλλου emoji αντικαθιστά. Γι' αυτό δεν χρειάζεται το emoji μέσα στο
-- κλειδί — και γι' αυτό η αλλαγή αντίδρασης φτάνει στους άλλους σαν UPDATE και
-- όχι σαν delete + insert.

create table if not exists public.message_reactions (
  message_id uuid        not null references public.messages(id) on delete cascade,
  user_id    uuid        not null references public.profiles(id) on delete cascade,
  emoji      text        not null,
  -- Αντιγραμμένο από το μήνυμα. Δες παρακάτω γιατί δεν αρκεί το join.
  group_id   uuid        not null references public.groups(id)   on delete cascade,
  created_at timestamptz not null default now(),

  primary key (message_id, user_id),

  -- Η στήλη λέγεται emoji και πρέπει να περιέχει emoji, όχι κείμενο.
  --
  -- Δεν υπάρχει λίστα επιτρεπτών — η επιλογή είναι ελεύθερη — οπότε ο έλεγχος
  -- είναι σχήματος: κοντό, χωρίς κενά, και ΜΕ τουλάχιστον έναν χαρακτήρα εκτός
  -- ASCII. Το τελευταίο το πιάνει η σύγκριση octet_length με char_length: σε
  -- UTF-8 διαφέρουν μόνο όταν υπάρχει πολυβύτης χαρακτήρας. Έτσι περνάει κάθε
  -- emoji, ακόμα και σύνθετο με ZWJ, και κόβεται το «lol» και το «:)».
  constraint message_reactions_emoji_shape check (
    char_length(emoji) between 1 and 16
    and octet_length(emoji) > char_length(emoji)
    and emoji !~ '\s'
  )
);

-- Οι αντιδράσεις ενός μηνύματος διαβάζονται πάντα μαζί.
create index if not exists message_reactions_message_idx
  on public.message_reactions (message_id);

-- ---------------------------------------------------------------------------
-- Γιατί υπάρχει το group_id, ενώ προκύπτει από το μήνυμα.
--
-- Το κανάλι της συνομιλίας φιλτράρει τα postgres_changes με `group_id=eq.<id>`.
-- Το φίλτρο δέχεται ΜΙΑ στήλη του ίδιου του πίνακα — δεν κάνει join. Χωρίς
-- αντιγραμμένο group_id θα έπρεπε να ακούμε χωρίς φίλτρο και να λαμβάνουμε κάθε
-- αντίδραση από κάθε Παρέα όπου ανήκουμε.
--
-- Ο πελάτης ΔΕΝ το στέλνει· το γράφει ο trigger από το ίδιο το μήνυμα. Και
-- επειδή ο trigger δεν είναι security definer, το select του βλέπει μόνο όσα
-- μηνύματα επιτρέπει το RLS — οπότε αντίδραση σε μήνυμα ξένης Παρέας σκάει εδώ,
-- ανεξάρτητα από το πότε αξιολογείται το with check του policy.
-- ---------------------------------------------------------------------------

create or replace function public.set_reaction_group()
returns trigger
language plpgsql
as $$
declare owner_group uuid;
begin
  select m.group_id into owner_group
  from public.messages m
  where m.id = new.message_id;

  if owner_group is null then
    raise exception 'That message does not exist.';
  end if;

  new.group_id := owner_group;
  return new;
end $$;

drop trigger if exists message_reactions_set_group on public.message_reactions;
create trigger message_reactions_set_group
  before insert on public.message_reactions
  for each row execute function public.set_reaction_group();

-- Στο update αλλάζει ΜΟΝΟ το emoji. Ίδιο πνεύμα με τον guard_message_update:
-- το policy κρίνει ποιανού είναι η γραμμή, ο trigger ποιες στήλες αλλάζουν.
create or replace function public.guard_reaction_update()
returns trigger
language plpgsql
as $$
begin
  if new.message_id is distinct from old.message_id
  or new.user_id    is distinct from old.user_id
  or new.group_id   is distinct from old.group_id then
    raise exception 'Only the emoji of a reaction can change.';
  end if;
  return new;
end $$;

drop trigger if exists message_reactions_guard_update on public.message_reactions;
create trigger message_reactions_guard_update
  before update on public.message_reactions
  for each row execute function public.guard_reaction_update();

-- ---------------------------------------------------------------------------
-- Χωρίς αυτό, η αφαίρεση αντίδρασης δεν φτάνει ΠΟΤΕ στους άλλους.
--
-- Σε DELETE το postgres_changes στέλνει την παλιά γραμμή, και με τις προεπιλογές
-- αυτή περιέχει μόνο τις στήλες του primary key. Το group_id δεν θα ήταν εκεί,
-- άρα το φίλτρο `group_id=eq.<id>` δεν θα ταίριαζε και το γεγονός θα πεταγόταν.
--
-- Το κόστος είναι μεγαλύτερο WAL σε κάθε update/delete· σε πίνακα αντιδράσεων
-- είναι αμελητέο.
-- ---------------------------------------------------------------------------
alter table public.message_reactions replica identity full;

-- ---------------------------------------------------------------------------
-- Policies. Διαβάζεις τις αντιδράσεις των Παρεών σου· γράφεις μόνο τη δική σου.
-- ---------------------------------------------------------------------------

alter table public.message_reactions enable row level security;

drop policy if exists "read reactions of my groups" on public.message_reactions;
drop policy if exists "react as self"               on public.message_reactions;
drop policy if exists "change own reaction"         on public.message_reactions;
drop policy if exists "remove own reaction"         on public.message_reactions;

create policy "read reactions of my groups" on public.message_reactions
  for select to authenticated
  using (group_id in (select public.my_group_ids()));

create policy "react as self" on public.message_reactions
  for insert to authenticated
  with check (user_id = auth.uid() and group_id in (select public.my_group_ids()));

create policy "change own reaction" on public.message_reactions
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "remove own reaction" on public.message_reactions
  for delete to authenticated
  using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Έλεγχος: φτάνουν οι αλλαγές στο realtime;
--
-- Ο πίνακας είναι καινούργιος, οπότε ΔΕΝ είναι στο publication. Χωρίς αυτό όλα
-- δουλεύουν για σένα και τίποτα για τους άλλους — το χειρότερο είδος σφάλματος,
-- γιατί δοκιμάζοντας μόνος σου δεν το βλέπεις ποτέ.
--
-- Η προσθήκη θέλει δικαιώματα στο publication· αν δεν τα έχει ο ρόλος που τρέχει
-- το migration, βγαίνει προειδοποίηση με το τι πρέπει να πατηθεί στο dashboard.
-- ---------------------------------------------------------------------------

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public' and tablename = 'message_reactions'
  ) then
    alter publication supabase_realtime add table public.message_reactions;
    raise notice 'Ο message_reactions προστέθηκε στο publication supabase_realtime.';
  end if;
exception when others then
  raise warning 'Δεν μπήκε ο message_reactions στο publication (%). Οι αντιδράσεις ΔΕΝ θα φαίνονται ζωντανά στους άλλους. Πρόσθεσέ τον από Database → Replication.', sqlerrm;
end $$;
