-- Φωτογραφίες σε μηνύματα.
--
-- Το bucket είναι ΚΛΕΙΣΤΟ. Σε δημόσιο, ο σύνδεσμος ενός αρχείου δουλεύει για
-- πάντα και για οποιονδήποτε — ανεξάρτητα από RLS, ανεξάρτητα από το αν το
-- μήνυμα σβήστηκε ή αν ο κάτοχος του συνδέσμου έφυγε από την Παρέα. Ο πελάτης
-- ζητά υπογεγραμμένο σύνδεσμο με λήξη, κάθε φορά.
--
-- Γι' αυτό το μήνυμα κρατά ΔΙΑΔΡΟΜΗ και όχι URL: το URL λήγει.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('chat', 'chat', false, 5242880,
        array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public             = false,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- ---------------------------------------------------------------------------
-- Policies αποθήκευσης.
--
-- Η διαδρομή είναι '<group_id>/<message_id>.jpg'. Ο πρώτος φάκελος ΕΙΝΑΙ ο
-- έλεγχος πρόσβασης: αν δεν είσαι μέλος της Παρέας, δεν διαβάζεις και δεν
-- γράφεις μέσα του.
-- ---------------------------------------------------------------------------

drop policy if exists "read chat media of my groups" on storage.objects;
drop policy if exists "upload chat media to my groups" on storage.objects;
drop policy if exists "replace own chat media" on storage.objects;
drop policy if exists "remove own chat media" on storage.objects;

create policy "read chat media of my groups" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'chat'
    and (storage.foldername(name))[1] in (
      select g::text from public.my_group_ids() g
    )
  );

create policy "upload chat media to my groups" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'chat'
    and (storage.foldername(name))[1] in (
      select g::text from public.my_group_ids() g
    )
  );

-- Το update χρειάζεται για την επανάληψη αποστολής: το ίδιο id δίνει το ίδιο
-- όνομα αρχείου, και το upsert γράφει από πάνω αντί να δημιουργήσει διπλό.
create policy "replace own chat media" on storage.objects
  for update to authenticated
  using (bucket_id = 'chat' and owner = auth.uid())
  with check (bucket_id = 'chat' and owner = auth.uid());

create policy "remove own chat media" on storage.objects
  for delete to authenticated
  using (bucket_id = 'chat' and owner = auth.uid());

-- ---------------------------------------------------------------------------
-- Οι στήλες.
--
-- Στον ίδιο πίνακα και όχι σε ξεχωριστό: ένας πίνακας συνημμένων με foreign key
-- προς messages θα έδινε στο PostgREST τρίτη διαδρομή προς τα profiles, δηλαδή
-- ακριβώς το PGRST201 που μας κόστισε στα reactions.
--
-- Το width/height δεν είναι μεταδεδομένα πολυτελείας: χωρίς αυτά η φυσαλίδα
-- ξεκινά μηδενική και πηδάει μόλις φορτώσει η εικόνα, σπρώχνοντας τη συζήτηση.
-- ---------------------------------------------------------------------------

alter table public.messages
  add column if not exists attachment_path   text,
  add column if not exists attachment_type   text,
  add column if not exists attachment_width  integer,
  add column if not exists attachment_height integer;

-- ---------------------------------------------------------------------------
-- Ο φύλακας του update, ξαναγραμμένος.
--
-- Οι νέες στήλες είναι αμετάβλητες όσο ζει το μήνυμα: χωρίς αυτό, ένα "edit"
-- θα μπορούσε να αλλάξει σε ΠΟΙΑ εικόνα δείχνει ένα μήνυμα που έχουν ήδη δει
-- οι άλλοι. Στη διαγραφή μηδενίζονται μαζί με το κείμενο — το αρχείο φεύγει
-- από την αποθήκη και η γραμμή δεν πρέπει να δείχνει σε νεκρή διαδρομή.
-- ---------------------------------------------------------------------------

create or replace function public.guard_message_update()
returns trigger
language plpgsql
as $$
begin
  if new.id         is distinct from old.id
  or new.group_id   is distinct from old.group_id
  or new.sender_id  is distinct from old.sender_id
  or new.created_at is distinct from old.created_at then
    raise exception 'Only the text of a message can change.';
  end if;

  if old.deleted_at is not null then
    raise exception 'That message was deleted.';
  end if;

  if new.deleted_at is not null then
    new.content := '';
    new.attachment_path   := null;
    new.attachment_type   := null;
    new.attachment_width  := null;
    new.attachment_height := null;
    new.edited_at := old.edited_at;
    return new;
  end if;

  if new.attachment_path   is distinct from old.attachment_path
  or new.attachment_type   is distinct from old.attachment_type
  or new.attachment_width  is distinct from old.attachment_width
  or new.attachment_height is distinct from old.attachment_height then
    raise exception 'The photo of a message cannot change.';
  end if;

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
-- Ένα μήνυμα πρέπει να λέει κάτι: κείμενο, εικόνα, ή και τα δύο.
--
-- Τελευταίο στο αρχείο επίτηδες. Αν κάποια υπάρχουσα γραμμή το παραβιάζει, όλα
-- τα προηγούμενα έχουν ήδη εφαρμοστεί και το migration σταματά εδώ, με μήνυμα
-- που λέει τι φταίει — αντί να μείνει μισοτελειωμένο.
--
-- Τα σβησμένα εξαιρούνται: εκεί το άδειο περιεχόμενο ΕΙΝΑΙ το ζητούμενο.
-- ---------------------------------------------------------------------------

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'messages_say_something'
  ) then
    alter table public.messages
      add constraint messages_say_something check (
        deleted_at is not null
        or content <> ''
        or attachment_path is not null
      );
  end if;
end $$;
