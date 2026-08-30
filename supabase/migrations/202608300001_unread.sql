-- Αδιάβαστα μηνύματα ανά Παρέα.
--
-- Η στήλη υπάρχει ήδη από το 202608240001 (βήμα 5). Την ξαναγράφουμε με
-- `if not exists` ώστε το αρχείο να στέκει μόνο του αν κάποιος το τρέξει σε
-- βάση που δεν πέρασε από εκεί — δεν πειράζει τίποτα αν είναι ήδη εκεί.
alter table public.group_members
  add column if not exists last_read_at timestamptz not null default now();

-- ---------------------------------------------------------------------------
-- Γιατί RPC και όχι policy.
--
-- Το προφανές θα ήταν ένα update policy στο group_members με
-- `with check (user_id = auth.uid())`. Είναι τρύπα: η γραμμή περιέχει και το
-- group_id. Ο έλεγχος κοιτάει μόνο ποιος είσαι, όχι πού ανήκεις — οπότε ένα
-- μέλος θα μπορούσε να κάνει update το ΔΙΚΟ του group_id και να μπει σε
-- οποιαδήποτε Παρέα, παρακάμπτοντας εντελώς το invite-only.
--
-- Οι δύο συναρτήσεις παρακάτω είναι security definer, δηλαδή τρέχουν πάνω από
-- το RLS. Γι' αυτό το `where` τους δεν είναι ευκολία αλλά ο ίδιος ο έλεγχος
-- ασφαλείας: πιάνεται πάντα στο `user_id = auth.uid()`, και το group_id δεν
-- γράφεται ποτέ. Έτσι το μόνο που μπορείς να αλλάξεις είναι η ώρα ανάγνωσης
-- της δικής σου γραμμής.
-- ---------------------------------------------------------------------------

create or replace function public.mark_group_read(target_group uuid)
returns void
language plpgsql security definer set search_path = public
as $$
declare uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'Sign in to continue.';
  end if;

  -- Αν δεν είσαι μέλος, δεν υπάρχει γραμμή να πειραχτεί: το update απλώς δεν
  -- βρίσκει τίποτα. Καμία ανάγκη για ξεχωριστό έλεγχο, και κανένα μήνυμα
  -- σφάλματος που να προδίδει αν η Παρέα υπάρχει.
  update public.group_members
  set last_read_at = now()
  where group_id = target_group and user_id = uid;
end $$;

revoke all on function public.mark_group_read(uuid) from public;
grant execute on function public.mark_group_read(uuid) to authenticated;

-- Οι μετρητές όλων των Παρεών μου σε ένα ερώτημα.
--
-- Τα ονόματα των στηλών εξόδου είναι επίτηδες `squad` και `unread`, όχι
-- `group_id`: σε συνάρτηση language sql τα ονόματα του returns table γίνονται
-- ορατά μέσα στο σώμα, και το `group_id` θα σύγκρουε με τις πραγματικές στήλες
-- ("column reference is ambiguous").
--
-- Δεν μετράμε τα δικά μας μηνύματα — το να σου βγάζει badge ό,τι μόλις έγραψες
-- είναι λάθος. Το index messages_group_created_idx (group_id, created_at)
-- εξυπηρετεί ακριβώς αυτό το join.
create or replace function public.unread_counts()
returns table (squad uuid, unread integer)
language sql stable security definer set search_path = public
as $$
  select m.group_id, count(msg.id)::integer
  from public.group_members m
  join public.messages msg
    on msg.group_id = m.group_id
   and msg.created_at > m.last_read_at
   and msg.sender_id <> m.user_id
  where m.user_id = auth.uid()
  group by m.group_id
$$;

revoke all on function public.unread_counts() from public;
grant execute on function public.unread_counts() to authenticated;

-- ---------------------------------------------------------------------------
-- Έλεγχος: το group_members ΔΕΝ πρέπει να αποκτήσει update policy.
--
-- Ο έλεγχος του 202608280001 λέει τι πρέπει να υπάρχει. Αυτός λέει τι δεν
-- πρέπει — γιατί εδώ το κενό δεν είναι που λείπει κάτι, αλλά που κάποιος
-- μελλοντικά θα προσθέσει το «προφανές» update και θα ανοίξει την τρύπα που
-- περιγράφεται παραπάνω.
-- ---------------------------------------------------------------------------

do $$
declare offending text;
begin
  select string_agg(p.polname, ', ')
  into offending
  from pg_policy p
  join pg_class c on c.oid = p.polrelid
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname = 'group_members'
    and p.polcmd in ('w', '*');

  if offending is not null then
    raise exception
      'Το group_members έχει update policy (%). Η ενημέρωση του last_read_at γίνεται μόνο μέσω mark_group_read — ένα update policy επιτρέπει σε μέλος να αλλάξει το group_id του.',
      offending;
  end if;
end $$;
