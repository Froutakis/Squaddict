-- Η select policy του group_members — που έλειπε, όπως έλειπαν και του messages.
--
-- Το 202608240001 έγραψε για τον group_members μόνο insert ("join as self") και
-- delete ("leave squad"). Το διάβασμα το κάλυπτε το "dev all group_members", και
-- μια χειροποίητη policy στη ζωντανή βάση — εκτός migrations. Ένα φρέσκο
-- στήσιμο από τα αρχεία έβγαζε πίνακα που δεν διαβάζεται.
--
-- Χωρίς αυτήν, η getMembers δεν γυρίζει τίποτα: ο μετρητής μελών δείχνει 1 σε
-- κάθε Παρέα και τα μηνύματα των άλλων φτάνουν από το realtime χωρίς όνομα
-- αποστολέα. Καμία ένδειξη σφάλματος — απλώς λάθος δεδομένα στην οθόνη.
--
-- Το όνομα κρατιέται όπως είναι ήδη στη βάση ("read own memberships"), ώστε το
-- migration να αντικαθιστά την υπάρχουσα αντί να προσθέτει δεύτερη δίπλα της.
-- Ό,τι κι αν λέει το όνομα, δεν διαβάζεις μόνο τις δικές σου γραμμές: διαβάζεις
-- τα μέλη των Παρεών όπου ανήκεις — αλλιώς δεν θα ήξερες ποιος σου μιλάει.

drop policy if exists "read own memberships" on public.group_members;

create policy "read own memberships" on public.group_members
  for select to authenticated
  using (group_id in (select public.my_group_ids()));

-- ---------------------------------------------------------------------------
-- Ο έλεγχος που θα είχε πιάσει και τα δύο κενά.
--
-- Το 202608240002 ελέγχει ότι δεν έμεινε ορθάνοιχτο policy, και το 202608270001
-- ότι κανένας πίνακας δεν έμεινε με RLS και μηδέν policies. Κανένα από τα δύο
-- δεν πιάνει το ενδιάμεσο: πίνακα που ΕΧΕΙ policies, αλλά του λείπει ακριβώς η
-- εντολή που χρειάζεται η εφαρμογή. Έτσι ξέφυγαν και το messages.SELECT και
-- αυτό εδώ.
-- ---------------------------------------------------------------------------

do $$
declare missing text;
begin
  select string_agg(required.table_name || '.' || required.command, ', ')
  into missing
  from (values
    ('profiles',      'SELECT', 'r'),
    ('profiles',      'UPDATE', 'w'),
    ('groups',        'SELECT', 'r'),
    ('groups',        'INSERT', 'a'),
    ('groups',        'UPDATE', 'w'),
    ('groups',        'DELETE', 'd'),
    ('group_members', 'SELECT', 'r'),
    ('group_members', 'INSERT', 'a'),
    ('group_members', 'DELETE', 'd'),
    ('group_invites', 'SELECT', 'r'),
    ('group_invites', 'INSERT', 'a'),
    ('group_invites', 'DELETE', 'd'),
    ('messages',      'SELECT', 'r'),
    ('messages',      'INSERT', 'a'),
    ('events',        'SELECT', 'r'),
    ('events',        'INSERT', 'a'),
    ('events',        'UPDATE', 'w'),
    ('events',        'DELETE', 'd')
  ) as required(table_name, command, cmd_char)
  where not exists (
    select 1
    from pg_policy p
    join pg_class c on c.oid = p.polrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = required.table_name
      -- Το '*' είναι policy "for all": καλύπτει κάθε εντολή.
      and (p.polcmd = required.cmd_char::"char" or p.polcmd = '*')
  );

  if missing is not null then
    raise exception 'Λείπουν policies για εντολές που χρησιμοποιεί η εφαρμογή: %', missing;
  end if;
end $$;
