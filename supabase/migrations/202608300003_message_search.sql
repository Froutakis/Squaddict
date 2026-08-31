-- Αναζήτηση μηνυμάτων μέσα σε μια Παρέα.
--
-- ΓΙΑΤΙ ΟΧΙ full-text search:
-- Το FTS κερδίζει όταν θέλεις stemming — «τρέχω» να βρίσκει «έτρεξα». Σε chat
-- αυτό δεν είναι το πρόβλημα. Εδώ γράφονται ανάμεικτα ελληνικά, greeklish και
-- αγγλικά, και κανένας stemmer δεν συνδέει το «kalimera» με το «καλημέρα».
-- Επίσης σε chat ψάχνεις κομμάτι λέξης, όχι λέξη: το «παρ» πρέπει να βρίσκει
-- και το «παραλία». Το FTS δεν το κάνει αυτό, το ilike το κάνει.

-- ---------------------------------------------------------------------------
-- Ισοπέδωση τόνων — και ο λόγος που δεν αρκεί το ilike.
--
-- Στα ελληνικά ΤΑ ΚΕΦΑΛΑΙΑ ΔΕΝ ΕΧΟΥΝ ΤΟΝΟ. Το lower('ΚΑΛΗΜΕΡΑ') δίνει
-- 'καλημερα', άτονο — που δεν ταιριάζει με το 'καλημέρα' που πληκτρολογεί ο
-- χρήστης. Ένα σκέτο ilike χάνει κάθε μήνυμα γραμμένο με κεφαλαία, και κάθε
-- χρήστη που δεν βάζει τόνους. Δεν είναι ακραία περίπτωση· είναι ο κανόνας.
--
-- translate() και όχι unaccent: δεν θέλει extension, και ελέγχουμε ακριβώς
-- ποιοι χαρακτήρες ισοπεδώνονται. Το τελικό σίγμα μπαίνει κι αυτό — είναι ο
-- ίδιος ήχος με το μεσαίο και κανείς δεν το σκέφτεται όταν ψάχνει.
--
-- Πρέπει να είναι immutable για να χτιστεί δείκτης πάνω της.
-- ---------------------------------------------------------------------------

create or replace function public.fold_text(t text)
returns text
language sql immutable
as $$
  select translate(lower(coalesce(t, '')),
                   'άέήίόύώΐΰϊϋς',
                   'αεηιουωιυιυσ')
$$;

-- Ο δείκτης είναι επιτάχυνση, όχι προϋπόθεση: η αναζήτηση δουλεύει και χωρίς
-- αυτόν, απλώς σαρώνει. Γι' αυτό μια αποτυχία εδώ δεν ρίχνει το migration —
-- το pg_trgm μπορεί να μην επιτρέπεται σε κάθε ρόλο.
do $$
begin
  create extension if not exists pg_trgm;

  -- Ο δείκτης πρέπει να είναι πάνω στην ΙΔΙΑ έκφραση με το where του ερωτήματος,
  -- αλλιώς δεν χρησιμοποιείται ποτέ. Μερικός: τα σβησμένα δεν ψάχνονται.
  create index if not exists messages_content_trgm_idx
    on public.messages using gin (public.fold_text(content) gin_trgm_ops)
    where deleted_at is null;
exception when others then
  raise warning 'Δεν μπήκε ο trigram δείκτης (%). Η αναζήτηση δουλεύει, αλλά θα γίνεται πιο αργή όσο μεγαλώνει το ιστορικό.', sqlerrm;
end $$;

-- ---------------------------------------------------------------------------
-- ΔΕΝ είναι security definer, επίτηδες — όπως και η rotate_invite_code.
--
-- Έτσι το ερώτημα τρέχει με τα δικαιώματα του καλούντος και το policy
-- "read messages of my groups" επιβάλλει από μόνο του ότι ψάχνεις μόνο σε
-- Παρέες όπου ανήκεις. Δεν χρειάζεται δικός μας έλεγχος μέλους: αν δεν είσαι
-- μέλος, το ερώτημα απλώς δεν βλέπει γραμμές.
--
-- Ο λόγος που είναι RPC και όχι απευθείας ερώτημα: το ilike του PostgREST
-- μεταφράζει το `*` σε wildcard, οπότε ο όρος του χρήστη θα έπρεπε να καθαριστεί
-- στον πελάτη — σε κάθε πελάτη, σωστά, για πάντα. Εδώ ο καθαρισμός γίνεται μία
-- φορά, στο ίδιο σημείο με το ερώτημα.
--
-- Τα ονόματα εξόδου έχουν πρόθεμα msg_: σε returns table τα ονόματα γίνονται
-- ορατά μέσα στο σώμα, και σκέτο `id` ή `content` θα σύγκρουε με τις στήλες.
-- ---------------------------------------------------------------------------

create or replace function public.search_messages(
  target_group uuid,
  term text,
  max_rows integer default 30
)
returns table (
  msg_id uuid,
  msg_content text,
  msg_sender_id uuid,
  msg_created_at timestamptz,
  msg_sender_name text
)
language plpgsql stable
as $$
declare
  needle text;
begin
  if term is null or length(btrim(term)) < 2 then
    return;
  end if;

  -- Τα %, _ και \ είναι σύμβολα του LIKE. Χωρίς αυτό, κάποιος που ψάχνει «100%»
  -- θα έπαιρνε κάθε μήνυμα που περιέχει «100», και ένα σκέτο «_» τα πάντα.
  needle := replace(btrim(term), '\', '\\');
  needle := replace(needle, '%', '\%');
  needle := replace(needle, '_', '\_');

  return query
    select m.id, m.content, m.sender_id, m.created_at,
           coalesce(p.display_name, '')
    from public.messages m
    left join public.profiles p on p.id = m.sender_id
    where m.group_id = target_group
      and m.deleted_at is null
      -- like, όχι ilike: και οι δύο πλευρές είναι ήδη πεζές και άτονες. Το
      -- ilike εδώ θα εμπόδιζε τη χρήση του δείκτη χωρίς να προσθέτει τίποτα.
      and public.fold_text(m.content) like '%' || public.fold_text(needle) || '%' escape '\'
    order by m.created_at desc
    limit least(coalesce(max_rows, 30), 100);
end $$;

revoke all on function public.search_messages(uuid, text, integer) from public;
grant execute on function public.search_messages(uuid, text, integer) to authenticated;
