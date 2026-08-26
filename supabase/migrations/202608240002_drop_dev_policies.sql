-- Η πραγματική μετάβαση: πέφτουν τα "dev all" policies.
--
-- Μέχρι τώρα η βάση ήταν ορθάνοιχτη. Τα permissive policies στην Postgres
-- ενώνονται με OR, οπότε ένα `using (true)` δεν προστίθεται στα υπόλοιπα — τα
-- καταπίνει. Όσο υπάρχουν αυτά τα πέντε, κάθε συνδεδεμένος χρήστης διαβάζει και
-- γράφει τα πάντα, σε κάθε Παρέα.
--
-- ΤΡΕΞΕ ΤΟ ΜΟΝΟ ΑΦΟΥ:
--   1. έχει τρέξει το 202608240001_chat_foundations.sql, και
--   2. έχεις επιβεβαιώσει ότι η εφαρμογή δουλεύει (chat, events, εγγραφή).
--
-- Η επιστροφή πίσω είναι ένα `create policy` — δες το τέλος του αρχείου.

drop policy if exists "dev all profiles"      on public.profiles;
drop policy if exists "dev all groups"        on public.groups;
drop policy if exists "dev all group_members" on public.group_members;
drop policy if exists "dev all messages"      on public.messages;
drop policy if exists "dev all events"        on public.events;

-- Έλεγχος ότι δεν έμεινε κανένα ορθάνοιχτο policy πίσω μας.
do $$
declare wide_open text;
begin
  select string_agg(tablename || '.' || policyname, ', ')
  into wide_open
  from pg_policies
  where schemaname = 'public'
    and cmd = 'ALL'
    and coalesce(qual, 'true') = 'true';

  if wide_open is not null then
    raise warning 'Υπάρχουν ακόμα ορθάνοιχτα policies: %', wide_open;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- ROLLBACK (αν κάτι σπάσει, τρέξε αυτό και ξαναδές το με την ησυχία σου):
--
--   create policy "dev all profiles"      on public.profiles      for all using (true) with check (true);
--   create policy "dev all groups"        on public.groups        for all using (true) with check (true);
--   create policy "dev all group_members" on public.group_members for all using (true) with check (true);
--   create policy "dev all messages"      on public.messages      for all using (true) with check (true);
--   create policy "dev all events"        on public.events        for all using (true) with check (true);
-- ---------------------------------------------------------------------------
