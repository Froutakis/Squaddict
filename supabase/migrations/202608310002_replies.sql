-- Απαντήσεις σε μήνυμα.
--
-- Μόνο ένας δείκτης προς το πρωτότυπο. Δεν κρατάμε αντίγραφο του κειμένου:
-- θα επιβίωνε μέσα στις παραθέσεις αφού ο συντάκτης το είχε σβήσει, και το soft
-- delete υπάρχει ακριβώς για να φεύγει το κείμενο από τη βάση.
--
-- on delete set null: αν το πρωτότυπο διαγραφεί οριστικά κάποτε, η απάντηση
-- μένει — απλώς χωρίς παράθεση. Cascade θα έσβηνε ολόκληρες συζητήσεις.

alter table public.messages
  add column if not exists reply_to uuid;

-- Ρητό όνομα, γιατί το επικαλούμαστε στο ερώτημα ως
-- `messages!messages_reply_to_fkey(...)`. Αν το άφηνε η Postgres να το ονομάσει
-- μόνη της θα ήταν το ίδιο, αλλά τότε ο κώδικας θα εξαρτιόταν από σύμβαση.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'messages_reply_to_fkey'
  ) then
    alter table public.messages
      add constraint messages_reply_to_fkey
      foreign key (reply_to) references public.messages(id) on delete set null;
  end if;
end $$;

-- Για το on delete set null: χωρίς αυτόν, η διαγραφή ενός μηνύματος σαρώνει
-- ολόκληρο τον πίνακα ψάχνοντας ποιος το παραθέτει.
create index if not exists messages_reply_to_idx
  on public.messages (reply_to)
  where reply_to is not null;

-- ---------------------------------------------------------------------------
-- Απαντάς μόνο σε μήνυμα της ΙΔΙΑΣ Παρέας.
--
-- Ο trigger δεν είναι security definer, οπότε το select του βλέπει μόνο όσα
-- μηνύματα επιτρέπει το RLS. Άρα καλύπτει και τα δύο με έναν έλεγχο: δεν
-- παραθέτεις μήνυμα ξένης Παρέας, και δεν παραθέτεις μήνυμα που δεν σου
-- επιτρέπεται να δεις.
-- ---------------------------------------------------------------------------

create or replace function public.guard_message_reply()
returns trigger
language plpgsql
as $$
declare target_group uuid;
begin
  if new.reply_to is null then
    return new;
  end if;

  if new.reply_to = new.id then
    raise exception 'A message cannot reply to itself.';
  end if;

  select m.group_id into target_group
  from public.messages m
  where m.id = new.reply_to;

  if target_group is null then
    raise exception 'That message does not exist.';
  end if;

  if target_group <> new.group_id then
    raise exception 'You can only reply to a message in the same squad.';
  end if;

  return new;
end $$;

drop trigger if exists messages_guard_reply on public.messages;
create trigger messages_guard_reply
  before insert on public.messages
  for each row execute function public.guard_message_reply();

-- ---------------------------------------------------------------------------
-- Το reply_to είναι αμετάβλητο, όπως το group_id και το created_at.
--
-- Ξαναγράφουμε ολόκληρη τη guard_message_update του 202608300002 με μία στήλη
-- παραπάνω. Αν έμενε έξω, ένα update θα μπορούσε να μετακινήσει την απάντηση
-- κάτω από άλλο μήνυμα — και μάλιστα άλλης Παρέας, αφού ο έλεγχος παραπάνω
-- τρέχει μόνο στο insert.
-- ---------------------------------------------------------------------------

create or replace function public.guard_message_update()
returns trigger
language plpgsql
as $$
begin
  if new.id         is distinct from old.id
  or new.group_id   is distinct from old.group_id
  or new.sender_id  is distinct from old.sender_id
  or new.created_at is distinct from old.created_at
  or new.reply_to   is distinct from old.reply_to then
    raise exception 'Only the text of a message can change.';
  end if;

  if old.deleted_at is not null then
    raise exception 'That message was deleted.';
  end if;

  if new.deleted_at is not null then
    new.content := '';
    new.edited_at := old.edited_at;
    return new;
  end if;

  if new.content is distinct from old.content then
    new.edited_at := now();
  else
    new.edited_at := old.edited_at;
  end if;

  return new;
end $$;

-- ---------------------------------------------------------------------------
-- Υπενθύμιση για το PGRST201.
--
-- Ο messages απέκτησε τρίτο foreign key, και μάλιστα προς τον εαυτό του. Το
-- ερώτημα των μηνυμάτων ΠΡΕΠΕΙ να ονομάζει ρητά και τις δύο σχέσεις:
--
--   profiles!messages_sender_id_fkey(display_name)
--   messages!messages_reply_to_fkey(...)
--
-- Χωρίς αυτά το PostgREST βρίσκει παραπάνω από μία διαδρομή και απορρίπτει κάθε
-- ερώτημα μηνυμάτων με HTTP 300 — που φαίνεται σαν πρόβλημα δικτύου, όχι σαν
-- πρόβλημα σχήματος.
-- ---------------------------------------------------------------------------
