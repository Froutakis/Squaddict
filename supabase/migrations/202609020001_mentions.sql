-- Αναφορές σε άτομα (@mentions).
--
-- Ο πίνακας κρατά την πρόθεση τη στιγμή της αποστολής. Ο τονισμός στην οθόνη
-- παράγεται ξεχωριστά, από το ίδιο το κείμενο (components/chat/mentions.ts).

create table if not exists public.message_mentions (
  message_id uuid        not null references public.messages(id) on delete cascade,
  user_id    uuid        not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),

  primary key (message_id, user_id)
);

create index if not exists message_mentions_user_idx
  on public.message_mentions (user_id);

alter table public.message_mentions enable row level security;

drop policy if exists "read mentions of my groups" on public.message_mentions;
drop policy if exists "mention from own message"   on public.message_mentions;
drop policy if exists "clear own mentions"         on public.message_mentions;

create policy "read mentions of my groups" on public.message_mentions
  for select to authenticated
  using (
    exists (
      select 1 from public.messages m
      where m.id = message_mentions.message_id
        and m.group_id in (select public.my_group_ids())
    )
  );

-- Το μήνυμα πρέπει να είναι δικό σου, και ο αναφερόμενος μέλος της ίδιας Παρέας.
-- Χωρίς αυτό, ο καθένας καταγράφει αναφορά σε οποιονδήποτε, σε μήνυμα οποιουδήποτε.
create policy "mention from own message" on public.message_mentions
  for insert to authenticated
  with check (
    exists (
      select 1 from public.messages m
      where m.id = message_mentions.message_id
        and m.sender_id = auth.uid()
        and exists (
          select 1 from public.group_members gm
          where gm.group_id = m.group_id
            and gm.user_id  = message_mentions.user_id
        )
    )
  );

create policy "clear own mentions" on public.message_mentions
  for delete to authenticated
  using (
    exists (
      select 1 from public.messages m
      where m.id = message_mentions.message_id
        and m.sender_id = auth.uid()
    )
  );

-- Πόσες αδιάβαστες αναφορές σε εμένα έχει κάθε Παρέα.
-- Τα ονόματα squad/mentions αντί για group_id: σε συνάρτηση sql τα ονόματα του
-- returns table συγκρούονται με τις πραγματικές στήλες.
create or replace function public.mention_counts()
returns table (squad uuid, mentions integer)
language sql stable security definer set search_path = public
as $$
  select msg.group_id, count(*)::integer
  from public.message_mentions mm
  join public.messages msg
    on msg.id = mm.message_id
   and msg.sender_id <> auth.uid()
   and msg.deleted_at is null
  join public.group_members gm
    on gm.group_id = msg.group_id
   and gm.user_id  = auth.uid()
   and msg.created_at > gm.last_read_at
  where mm.user_id = auth.uid()
  group by msg.group_id
$$;

revoke all on function public.mention_counts() from public;
grant execute on function public.mention_counts() to authenticated;

-- Φρουρός: το insert policy δεν πρέπει ποτέ να χάσει τον έλεγχο αποστολέα.
do $$
declare loose text;
begin
  select string_agg(p.polname, ', ')
  into loose
  from pg_policy p
  join pg_class c on c.oid = p.polrelid
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname = 'message_mentions'
    and p.polcmd in ('a', '*')
    and (p.polwithcheck is null or pg_get_expr(p.polwithcheck, p.polrelid) not like '%sender_id%');

  if loose is not null then
    raise exception
      'Το message_mentions έχει insert policy χωρίς έλεγχο αποστολέα (%).', loose;
  end if;
end $$;
