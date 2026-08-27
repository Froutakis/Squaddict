-- Οι policies του messages — υπήρχαν στη βάση, δεν υπήρχαν στα migrations.
--
-- Το 202608240001 ενεργοποίησε RLS στον messages και έγραψε policies για κάθε
-- άλλον πίνακα, αλλά για αυτόν καμία. Στη ζωντανή βάση οι σωστές policies
-- υπήρχαν ήδη, φτιαγμένες με το χέρι νωρίτερα — γι' αυτό δεν το πρόσεξε κανείς.
-- Ένα φρέσκο στήσιμο όμως από αυτά τα αρχεία έβγαζε πίνακα με RLS και μηδέν
-- policies, δηλαδή chat που δεν διαβάζεται και δεν γράφεται από κανέναν.
--
-- Εδώ γράφονται όπως ακριβώς είναι, ώστε τα αρχεία να λένε την αλήθεια. Κρατάμε
-- τα ονόματα που έχουν ήδη στη βάση ("my groups", όχι "my squads") — αλλιώς το
-- migration θα πρόσθετε δεύτερο ζευγάρι δίπλα στο πρώτο αντί να το αντικαταστήσει.
--
-- Δεν γράφουμε policy για update ή delete: η επεξεργασία και η διαγραφή
-- μηνύματος είναι εκτός φάσης 1, και χωρίς policy απαγορεύονται από μόνες τους.

drop policy if exists "read messages of my groups" on public.messages;
drop policy if exists "send messages to my groups" on public.messages;

-- Διαβάζεις τα μηνύματα των Παρεών σου, καμίας άλλης. Η my_group_ids() είναι
-- security definer, ώστε ο έλεγχος συμμετοχής να μην περάσει ο ίδιος από το RLS
-- του group_members και γυρίσει σε ατέρμονη αναδρομή.
create policy "read messages of my groups" on public.messages
  for select to authenticated
  using (group_id in (select public.my_group_ids()));

-- Στέλνεις μόνο ως ο εαυτός σου, και μόνο σε Παρέα όπου είσαι μέλος. Ο έλεγχος
-- του sender_id είναι που εμποδίζει να γράψει κάποιος μήνυμα με ξένο όνομα.
create policy "send messages to my groups" on public.messages
  for insert to authenticated
  with check (
    sender_id = auth.uid()
    and group_id in (select public.my_group_ids())
  );

-- ---------------------------------------------------------------------------
-- Ασφαλιστική δικλείδα, στο ύφος των προηγούμενων migrations.
--
-- Το 202608240002 ελέγχει ότι δεν έμεινε καμία ΟΡΘΑΝΟΙΧΤΗ policy. Λείπει ο
-- συμπληρωματικός έλεγχος, αυτός που θα είχε πιάσει το κενό: πίνακας με RLS
-- ενεργό και ΚΑΜΙΑ policy δεν είναι ανοιχτός — είναι κλειδωμένος για όλους.
-- ---------------------------------------------------------------------------

do $$
declare locked_out text;
begin
  select string_agg(c.relname::text, ', ')
  into locked_out
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relkind = 'r'
    and c.relrowsecurity
    and c.relname in ('profiles', 'groups', 'group_members', 'group_invites', 'messages', 'events')
    and not exists (
      select 1 from pg_policy p where p.polrelid = c.oid
    );

  if locked_out is not null then
    raise exception 'Πίνακες με RLS και καμία policy (κανείς δεν τους αγγίζει): %', locked_out;
  end if;
end $$;
