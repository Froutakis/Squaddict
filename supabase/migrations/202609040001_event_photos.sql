create table if not exists public.event_photos (
  id         uuid        not null,
  event_id   uuid        not null,
  user_id    uuid        not null,
  path       text        not null,
  width      integer     not null,
  height     integer     not null,
  created_at timestamptz not null default now()
);

do $$
begin
  if not exists (
    select 1 from pg_constraint
     where conrelid = 'public.event_photos'::regclass and contype = 'p'
  ) then
    alter table public.event_photos add primary key (id);
  end if;

  if not exists (
    select 1 from pg_constraint
     where conrelid = 'public.event_photos'::regclass
       and contype = 'f' and conname = 'event_photos_event_id_fkey'
  ) then
    alter table public.event_photos
      add constraint event_photos_event_id_fkey
      foreign key (event_id) references public.events(id) on delete cascade;
  end if;

  if not exists (
    select 1 from pg_constraint
     where conrelid = 'public.event_photos'::regclass
       and contype = 'f' and conname = 'event_photos_user_id_fkey'
  ) then
    alter table public.event_photos
      add constraint event_photos_user_id_fkey
      foreign key (user_id) references public.profiles(id) on delete cascade;
  end if;
end $$;

create index if not exists event_photos_event_idx
  on public.event_photos (event_id, created_at desc);

alter table public.event_photos enable row level security;

drop policy if exists "read photos of my squads events" on public.event_photos;
drop policy if exists "add photo when i was in"         on public.event_photos;
drop policy if exists "remove own photo"                on public.event_photos;

create policy "read photos of my squads events" on public.event_photos
  for select to authenticated
  using (
    exists (
      select 1 from public.events e
       where e.id = event_photos.event_id
         and e.group_id in (select public.my_group_ids())
    )
  );

create policy "add photo when i was in" on public.event_photos
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1
        from public.events e
        join public.event_attendees a
          on a.event_id = e.id
         and a.user_id  = auth.uid()
         and a.status   = 'in'
       where e.id = event_photos.event_id
         and e.date <= current_date
         and event_photos.path like e.group_id::text || '/%'
    )
  );

create policy "remove own photo" on public.event_photos
  for delete to authenticated
  using (user_id = auth.uid());

do $$
declare loose text;
begin
  select string_agg(p.polname, ', ')
  into loose
  from pg_policy p
  join pg_class c on c.oid = p.polrelid
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname = 'event_photos'
    and p.polcmd in ('a', '*')
    and (p.polwithcheck is null
         or pg_get_expr(p.polwithcheck, p.polrelid) not like '%status%');

  if loose is not null then
    raise exception
      'Το event_photos έχει insert policy χωρίς έλεγχο συμμετοχής (%).', loose;
  end if;
end $$;
