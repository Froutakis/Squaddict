create table if not exists public.events (
  id          uuid        primary key default gen_random_uuid(),
  group_id    uuid        not null references public.groups(id)   on delete cascade,
  created_by  uuid        not null references public.profiles(id) on delete cascade,
  title       text        not null check (length(trim(title)) > 0),
  date        date        not null,
  start_time  time,
  end_time    time,
  location    text,
  description text,
  created_at  timestamptz not null default now(),
  check (end_time is null or start_time is null or end_time > start_time)
);

create index if not exists events_group_date_idx
  on public.events (group_id, date);

create index if not exists group_members_user_idx
  on public.group_members (user_id);
