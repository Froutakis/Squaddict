-- Following pareas from Explore, stored per account instead of on the phone.
-- Run once in the Supabase SQL editor, after schema.sql.
--
-- Who follows whom stays private: you only ever read your own follows.
-- Squads show how many followers they have through groups.follower_count.

create table if not exists public.group_follows (
  group_id   uuid        not null references public.groups(id)   on delete cascade,
  user_id    uuid        not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (group_id, user_id)
);

create index if not exists group_follows_user_idx on public.group_follows (user_id);

alter table public.groups
  add column if not exists follower_count integer not null default 0;

alter table public.group_follows enable row level security;

drop policy if exists "read own follows"   on public.group_follows;
drop policy if exists "follow as yourself" on public.group_follows;
drop policy if exists "unfollow yourself"  on public.group_follows;

create policy "read own follows" on public.group_follows
  for select to authenticated
  using (user_id = auth.uid());

create policy "follow as yourself" on public.group_follows
  for insert to authenticated
  with check (user_id = auth.uid());

create policy "unfollow yourself" on public.group_follows
  for delete to authenticated
  using (user_id = auth.uid());

create or replace function public.sync_group_follower_count()
returns trigger language plpgsql security definer set search_path to 'public' as $function$
begin
  if tg_op = 'INSERT' then
    update public.groups
      set follower_count = follower_count + 1
      where id = new.group_id;
  elsif tg_op = 'DELETE' then
    update public.groups
      set follower_count = greatest(follower_count - 1, 0)
      where id = old.group_id;
  end if;

  return null;
end $function$;

drop trigger if exists group_follows_count on public.group_follows;
create trigger group_follows_count
  after insert or delete on public.group_follows
  for each row execute function public.sync_group_follower_count();

-- Bring the counter in line with any rows that existed before the trigger.
update public.groups g
   set follower_count = (select count(*) from public.group_follows f where f.group_id = g.id);
