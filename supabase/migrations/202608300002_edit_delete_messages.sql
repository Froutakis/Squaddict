-- Επεξεργασία και διαγραφή μηνύματος.
--
-- Μέχρι τώρα ο messages είχε μόνο select και insert policies: ένα μήνυμα που
-- έφευγε δεν ξαναπειραζόταν από κανέναν, ούτε από αυτόν που το έγραψε.

-- Η διαγραφή είναι soft: η γραμμή μένει, το κείμενο φεύγει. Έτσι το ιστορικό
-- δεν αποκτά τρύπες — το pagination δουλεύει με κέρσορα πάνω στο created_at —
-- και, κυρίως, το σβήσιμο γίνεται update. Ένα και μόνο realtime subscription σε
-- UPDATE καλύπτει τότε και τη διόρθωση και τη διαγραφή· με hard delete θα
-- χρειαζόταν δεύτερο σε DELETE, που απαιτεί replica identity full.
alter table public.messages add column if not exists edited_at  timestamptz;
alter table public.messages add column if not exists deleted_at timestamptz;

-- ---------------------------------------------------------------------------
-- Το policy λέει ΠΟΙΟΣ, ο trigger λέει ΤΙ.
--
-- Σκέτο `using (sender_id = auth.uid())` δεν αρκεί, για τον ίδιο λόγο που δεν
-- άρκεσε στο group_members: η γραμμή περιέχει και το group_id. Ελέγχοντας μόνο
-- ποιος είσαι, αφήνεις τον καθένα να μεταφέρει το ΔΙΚΟ του μήνυμα σε άλλη
-- Παρέα — και το `with check` δεν βοηθάει, γιατί κι εκεί ο ίδιος παραμένει ο
-- αποστολέας.
--
-- Ο διαχωρισμός: το policy κρίνει ποιανού είναι η γραμμή, ο trigger παρακάτω
-- κρίνει ποιες στήλες επιτρέπεται να αλλάξουν. Καμία από τις δύο πλευρές δεν
-- μπορεί να παρακαμφθεί χωρίς την άλλη.
-- ---------------------------------------------------------------------------

drop policy if exists "edit own messages" on public.messages;

create policy "edit own messages" on public.messages
  for update to authenticated
  using (sender_id = auth.uid() and group_id in (select public.my_group_ids()))
  with check (sender_id = auth.uid());

create or replace function public.guard_message_update()
returns trigger
language plpgsql
as $$
begin
  -- Ταυτότητα, παραλήπτης και χρόνος είναι αμετάβλητα. Το created_at ειδικά
  -- είναι ο κέρσορας του pagination: αν μετακινηθεί, σελίδες αρχίζουν να
  -- προσπερνούν ή να επαναλαμβάνουν μηνύματα.
  if new.id         is distinct from old.id
  or new.group_id   is distinct from old.group_id
  or new.sender_id  is distinct from old.sender_id
  or new.created_at is distinct from old.created_at then
    raise exception 'Only the text of a message can change.';
  end if;

  -- Ένα σβησμένο μήνυμα δεν ξαναγράφεται και δεν ξαναζωντανεύει. Χωρίς αυτό, το
  -- «σβήσιμο» θα ήταν αναστρέψιμο από όποιον στείλει update με deleted_at = null.
  if old.deleted_at is not null then
    raise exception 'That message was deleted.';
  end if;

  if new.deleted_at is not null then
    -- Το κείμενο φεύγει εδώ, στη βάση, όχι στην εφαρμογή: αλλιώς ένας πελάτης
    -- που στέλνει μόνο deleted_at θα άφηνε το περιεχόμενο ζωντανό στον πίνακα.
    new.content := '';
    new.edited_at := old.edited_at;
    return new;
  end if;

  -- Το edited_at το βάζει η βάση, ώστε η σήμανση "edited" να μη γίνεται να
  -- παραλειφθεί από τον πελάτη.
  if new.content is distinct from old.content then
    new.edited_at := now();
  else
    new.edited_at := old.edited_at;
  end if;

  return new;
end $$;

drop trigger if exists messages_guard_update on public.messages;
create trigger messages_guard_update
  before update on public.messages
  for each row execute function public.guard_message_update();

-- ---------------------------------------------------------------------------
-- Έλεγχος: ο messages ΔΕΝ πρέπει να αποκτήσει delete policy.
--
-- Ίδιο πνεύμα με τον έλεγχο του 202608300001. Η διαγραφή εδώ είναι εξ ορισμού
-- soft· ένα delete policy δεν θα πρόσθετε δυνατότητα, θα άνοιγε δεύτερο δρόμο
-- που παρακάμπτει τον trigger και αφήνει τρύπες στο ιστορικό.
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
    and c.relname = 'messages'
    and p.polcmd in ('d', '*');

  if offending is not null then
    raise exception
      'Ο messages έχει delete policy (%). Η διαγραφή είναι soft — γίνεται με update του deleted_at, ώστε να περνάει από τον guard_message_update.',
      offending;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Έλεγχος: φτάνουν τα UPDATE στο realtime;
--
-- Όλα τα παραπάνω μπορεί να δουλεύουν τέλεια και η διόρθωση να μη φαίνεται ποτέ
-- στον άλλον, αν ο messages δεν είναι στο publication ή αν αυτό δεν δημοσιεύει
-- updates. Το σφάλμα τότε είναι αόρατο: δουλεύει για σένα, όχι για τους άλλους.
--
-- Προειδοποίηση και όχι exception — το publication είναι ρύθμιση του project και
-- μπορεί να μην ανήκει στον ρόλο που τρέχει το migration.
-- ---------------------------------------------------------------------------

do $$
declare published boolean;
begin
  select p.pubupdate
  into published
  from pg_publication p
  join pg_publication_tables t
    on t.pubname = p.pubname
  where p.pubname = 'supabase_realtime'
    and t.schemaname = 'public'
    and t.tablename = 'messages';

  if published is null then
    raise warning 'Ο public.messages δεν είναι στο publication supabase_realtime — καμία αλλαγή δεν φτάνει σε άλλους χρήστες ζωντανά.';
  elsif not published then
    raise warning 'Το publication supabase_realtime δεν δημοσιεύει updates — οι διορθώσεις και οι διαγραφές δεν θα φαίνονται στους άλλους μέχρι να ξανανοίξουν τη συνομιλία.';
  end if;
end $$;
