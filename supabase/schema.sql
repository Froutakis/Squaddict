create extension if not exists pg_trgm with schema public;

create table if not exists public.profiles (
  id           uuid        not null primary key,
  display_name text        not null unique,
  avatar_url   text,
  created_at   timestamptz default now()
);

create table if not exists public.groups (
  id           uuid        not null primary key default gen_random_uuid(),
  name         text        not null,
  created_by   uuid        references public.profiles(id) on delete set null,
  created_at   timestamptz default now(),
  handle       text        not null unique,
  bio          text,
  avatar_url   text,
  member_count integer     not null default 0,
  constraint groups_handle_format check (handle ~ '^[a-z0-9_]{3,30}$'),
  constraint groups_bio_length    check (bio is null or length(bio) <= 160)
);

create table if not exists public.group_members (
  group_id     uuid        not null references public.groups(id)   on delete cascade,
  user_id      uuid        not null references public.profiles(id) on delete cascade,
  joined_at    timestamptz default now(),
  last_read_at timestamptz not null default now(),
  primary key (group_id, user_id)
);

create table if not exists public.group_invites (
  group_id   uuid        not null primary key references public.groups(id) on delete cascade,
  code       text        not null unique,
  created_at timestamptz not null default now(),
  constraint group_invites_code_check check (code ~ '^[A-Z0-9]{10}$')
);

create table if not exists public.events (
  id          uuid        not null primary key default gen_random_uuid(),
  group_id    uuid        not null references public.groups(id)   on delete cascade,
  created_by  uuid        not null references public.profiles(id) on delete cascade,
  title       text        not null,
  date        date        not null,
  start_time  time,
  end_time    time,
  location    text,
  description text,
  created_at  timestamptz not null default now(),
  is_public   boolean     not null default false,
  tags        text[]      not null default '{}'::text[],
  lat         double precision,
  lng         double precision,
  place_label text,
  constraint events_title_check check (length(trim(title)) > 0),
  constraint events_check check (end_time is null or start_time is null or end_time > start_time),
  constraint events_public_needs_place check (
    not is_public or (lat is not null and lng is not null and place_label is not null)
  )
);

create table if not exists public.event_attendees (
  event_id   uuid        not null references public.events(id)   on delete cascade,
  user_id    uuid        not null references public.profiles(id) on delete cascade,
  status     text        not null,
  updated_at timestamptz not null default now(),
  primary key (event_id, user_id),
  constraint event_attendees_status_check check (status in ('invited', 'in', 'out'))
);

create table if not exists public.event_photos (
  id         uuid        not null primary key,
  event_id   uuid        not null references public.events(id)   on delete cascade,
  user_id    uuid        not null references public.profiles(id) on delete cascade,
  path       text        not null,
  width      integer     not null,
  height     integer     not null,
  created_at timestamptz not null default now()
);

create table if not exists public.messages (
  id                uuid        not null primary key default gen_random_uuid(),
  group_id          uuid        not null references public.groups(id)   on delete cascade,
  sender_id         uuid        not null references public.profiles(id) on delete cascade,
  content           text        not null,
  created_at        timestamptz default now(),
  edited_at         timestamptz,
  deleted_at        timestamptz,
  reply_to          uuid        references public.messages(id) on delete set null,
  attachment_path   text,
  attachment_type   text,
  attachment_width  integer,
  attachment_height integer,
  constraint messages_say_something check (
    deleted_at is not null or content <> '' or attachment_path is not null
  )
);

create table if not exists public.message_reactions (
  message_id uuid        not null references public.messages(id) on delete cascade,
  user_id    uuid        not null references public.profiles(id) on delete cascade,
  emoji      text        not null,
  group_id   uuid        not null references public.groups(id)   on delete cascade,
  created_at timestamptz not null default now(),
  primary key (message_id, user_id),
  constraint message_reactions_emoji_shape check (
    char_length(emoji) between 1 and 16
    and octet_length(emoji) > char_length(emoji)
    and emoji !~ '\s'
  )
);

create table if not exists public.message_mentions (
  message_id uuid        not null references public.messages(id) on delete cascade,
  user_id    uuid        not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (message_id, user_id)
);

create index if not exists events_group_date_idx   on public.events (group_id, date);
create index if not exists events_public_geo_idx   on public.events (date, lat, lng) where is_public;
create index if not exists event_attendees_event_idx on public.event_attendees (event_id);
create index if not exists event_photos_event_idx  on public.event_photos (event_id, created_at desc);
create index if not exists event_photos_path_idx   on public.event_photos (path);
create index if not exists message_mentions_user_idx on public.message_mentions (user_id);
create index if not exists message_reactions_message_idx on public.message_reactions (message_id);
create index if not exists messages_group_created_idx on public.messages (group_id, created_at);
create index if not exists messages_reply_to_idx    on public.messages (reply_to) where reply_to is not null;

create or replace function public.fold_text(t text)
returns text language sql immutable as $function$
  select translate(lower(coalesce(t, '')),
                   'άέήίόύώΐΰϊϋς',
                   'αεηιουωιυιυσ')
$function$;

create or replace function public.my_group_ids()
returns setof uuid language sql stable security definer set search_path to 'public' as $function$
  select group_id from public.group_members where user_id = auth.uid();
$function$;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path to 'public' as $function$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(
      nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''),
      split_part(new.email, '@', 1)
    )
  )
  on conflict (id) do nothing;

  return new;
end $function$;

create or replace function public.lock_group_handle()
returns trigger language plpgsql security definer set search_path to 'public' as $function$
begin
  if new.handle is distinct from old.handle and auth.uid() is not null then
    raise exception 'A squad handle cannot be changed.';
  end if;

  return new;
end $function$;

create or replace function public.sync_group_member_count()
returns trigger language plpgsql security definer set search_path to 'public' as $function$
begin
  if tg_op = 'INSERT' then
    update public.groups
      set member_count = member_count + 1
      where id = new.group_id;
  elsif tg_op = 'DELETE' then
    update public.groups
      set member_count = greatest(member_count - 1, 0)
      where id = old.group_id;
  end if;

  return null;
end $function$;

create or replace function public.new_invite_code()
returns text language sql as $function$
  select upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10))
$function$;

create or replace function public.rotate_invite_code(target_group uuid)
returns text language plpgsql set search_path to 'public' as $function$
declare fresh text;
begin
  delete from public.group_invites where group_id = target_group;

  fresh := public.new_invite_code();
  insert into public.group_invites (group_id, code) values (target_group, fresh);

  return fresh;
end $function$;

create or replace function public.join_squad(invite_code text)
returns public.groups language plpgsql security definer set search_path to 'public' as $function$
declare
  target public.groups;
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'Sign in to continue.';
  end if;

  select g.* into target
  from public.groups g
  join public.group_invites i on i.group_id = g.id
  where i.code = upper(trim(invite_code));

  if not found then
    raise exception 'That invite code is not valid.';
  end if;

  insert into public.group_members (group_id, user_id)
  values (target.id, uid)
  on conflict do nothing;

  select g.* into target from public.groups g where g.id = target.id;

  return target;
end $function$;

create or replace function public.mark_group_read(target_group uuid)
returns void language plpgsql security definer set search_path to 'public' as $function$
declare uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'Sign in to continue.';
  end if;

  update public.group_members
  set last_read_at = now()
  where group_id = target_group and user_id = uid;
end $function$;

create or replace function public.unread_counts()
returns table(squad uuid, unread integer)
language sql stable security definer set search_path to 'public' as $function$
  select m.group_id, count(msg.id)::integer
  from public.group_members m
  join public.messages msg
    on msg.group_id = m.group_id
   and msg.created_at > m.last_read_at
   and msg.sender_id <> m.user_id
  where m.user_id = auth.uid()
  group by m.group_id
$function$;

create or replace function public.mention_counts()
returns table(squad uuid, mentions integer)
language sql stable security definer set search_path to 'public' as $function$
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
$function$;

create or replace function public.search_messages(target_group uuid, term text, max_rows integer default 30)
returns table(msg_id uuid, msg_content text, msg_sender_id uuid,
              msg_created_at timestamptz, msg_sender_name text)
language plpgsql stable as $function$
declare
  needle text;
begin
  if term is null or length(btrim(term)) < 2 then
    return;
  end if;

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
      and public.fold_text(m.content) like '%' || public.fold_text(needle) || '%' escape '\'
    order by m.created_at desc
    limit least(coalesce(max_rows, 30), 100);
end $function$;

create or replace function public.set_reaction_group()
returns trigger language plpgsql as $function$
declare owner_group uuid;
begin
  select m.group_id into owner_group
  from public.messages m
  where m.id = new.message_id;

  if owner_group is null then
    raise exception 'That message does not exist.';
  end if;

  new.group_id := owner_group;
  return new;
end $function$;

create or replace function public.guard_reaction_update()
returns trigger language plpgsql as $function$
begin
  if new.message_id is distinct from old.message_id
  or new.user_id    is distinct from old.user_id
  or new.group_id   is distinct from old.group_id then
    raise exception 'Only the emoji of a reaction can change.';
  end if;
  return new;
end $function$;

create or replace function public.guard_message_update()
returns trigger language plpgsql as $function$
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
end $function$;

create index if not exists messages_content_trgm_idx
  on public.messages using gin (public.fold_text(content) public.gin_trgm_ops)
  where deleted_at is null;

drop trigger if exists groups_handle_locked on public.groups;
create trigger groups_handle_locked
  before update on public.groups
  for each row execute function public.lock_group_handle();

drop trigger if exists group_members_count on public.group_members;
create trigger group_members_count
  after insert or delete on public.group_members
  for each row execute function public.sync_group_member_count();

drop trigger if exists messages_guard_update on public.messages;
create trigger messages_guard_update
  before update on public.messages
  for each row execute function public.guard_message_update();

drop trigger if exists message_reactions_set_group on public.message_reactions;
create trigger message_reactions_set_group
  before insert on public.message_reactions
  for each row execute function public.set_reaction_group();

drop trigger if exists message_reactions_guard_update on public.message_reactions;
create trigger message_reactions_guard_update
  before update on public.message_reactions
  for each row execute function public.guard_reaction_update();

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

alter table public.profiles          enable row level security;
alter table public.groups            enable row level security;
alter table public.group_members     enable row level security;
alter table public.group_invites     enable row level security;
alter table public.events            enable row level security;
alter table public.event_attendees   enable row level security;
alter table public.event_photos      enable row level security;
alter table public.messages          enable row level security;
alter table public.message_reactions enable row level security;
alter table public.message_mentions  enable row level security;

drop policy if exists "read own profile"       on public.profiles;
drop policy if exists "read squadmate profiles" on public.profiles;
drop policy if exists "update own profile"     on public.profiles;

create policy "read own profile" on public.profiles
  for select to authenticated
  using (id = auth.uid());

create policy "read squadmate profiles" on public.profiles
  for select to authenticated
  using (
    exists (
      select 1 from public.group_members m
       where m.user_id = profiles.id
         and m.group_id in (select public.my_group_ids())
    )
  );

create policy "update own profile" on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

drop policy if exists "squad profiles are public" on public.groups;
drop policy if exists "create own squad"          on public.groups;
drop policy if exists "creator updates squad"     on public.groups;
drop policy if exists "creator deletes squad"     on public.groups;

create policy "squad profiles are public" on public.groups
  for select
  using (true);

create policy "create own squad" on public.groups
  for insert to authenticated
  with check (created_by = auth.uid());

create policy "creator updates squad" on public.groups
  for update to authenticated
  using (created_by = auth.uid())
  with check (created_by = auth.uid());

create policy "creator deletes squad" on public.groups
  for delete to authenticated
  using (created_by = auth.uid());

drop policy if exists "read own memberships" on public.group_members;
drop policy if exists "join as self"         on public.group_members;
drop policy if exists "leave squad"          on public.group_members;

create policy "read own memberships" on public.group_members
  for select to authenticated
  using (group_id in (select public.my_group_ids()));

create policy "join as self" on public.group_members
  for insert to authenticated
  with check (user_id = auth.uid());

create policy "leave squad" on public.group_members
  for delete to authenticated
  using (
    user_id = auth.uid()
    or exists (
      select 1 from public.groups g
       where g.id = group_members.group_id
         and g.created_by = auth.uid()
    )
  );

drop policy if exists "members read invite"   on public.group_invites;
drop policy if exists "members rotate invite" on public.group_invites;
drop policy if exists "members revoke invite" on public.group_invites;

create policy "members read invite" on public.group_invites
  for select to authenticated
  using (group_id in (select public.my_group_ids()));

create policy "members rotate invite" on public.group_invites
  for insert to authenticated
  with check (group_id in (select public.my_group_ids()));

create policy "members revoke invite" on public.group_invites
  for delete to authenticated
  using (group_id in (select public.my_group_ids()));

drop policy if exists "read events of my squads"     on public.events;
drop policy if exists "read public upcoming events"  on public.events;
drop policy if exists "members create events"        on public.events;
drop policy if exists "creator updates event"        on public.events;
drop policy if exists "creator deletes event"        on public.events;

create policy "read events of my squads" on public.events
  for select to authenticated
  using (is_public or group_id in (select public.my_group_ids()));

create policy "read public upcoming events" on public.events
  for select to authenticated
  using (is_public and date >= current_date);

create policy "members create events" on public.events
  for insert to authenticated
  with check (
    created_by = auth.uid()
    and group_id in (select public.my_group_ids())
  );

create policy "creator updates event" on public.events
  for update to authenticated
  using (created_by = auth.uid())
  with check (created_by = auth.uid());

create policy "creator deletes event" on public.events
  for delete to authenticated
  using (created_by = auth.uid());

drop policy if exists "read attendees of my squads events" on public.event_attendees;
drop policy if exists "read rsvps of public events"        on public.event_attendees;
drop policy if exists "write only my own answer"           on public.event_attendees;

create policy "read attendees of my squads events" on public.event_attendees
  for select
  using (
    exists (
      select 1
        from public.events e
        join public.group_members gm on gm.group_id = e.group_id
       where e.id = event_attendees.event_id
         and gm.user_id = auth.uid()
    )
  );

create policy "read rsvps of public events" on public.event_attendees
  for select to authenticated
  using (
    exists (
      select 1 from public.events e
       where e.id = event_attendees.event_id
         and e.is_public
         and e.date >= current_date
    )
  );

create policy "write only my own answer" on public.event_attendees
  for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

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
         and event_photos.path like e.group_id::text || '/%'
    )
  );

create policy "remove own photo" on public.event_photos
  for delete to authenticated
  using (user_id = auth.uid());

drop policy if exists "read messages of my groups"  on public.messages;
drop policy if exists "send messages to my groups"  on public.messages;
drop policy if exists "edit own messages"           on public.messages;

create policy "read messages of my groups" on public.messages
  for select to authenticated
  using (group_id in (select public.my_group_ids()));

create policy "send messages to my groups" on public.messages
  for insert to authenticated
  with check (
    sender_id = auth.uid()
    and group_id in (select public.my_group_ids())
  );

create policy "edit own messages" on public.messages
  for update to authenticated
  using (
    sender_id = auth.uid()
    and group_id in (select public.my_group_ids())
  )
  with check (sender_id = auth.uid());

drop policy if exists "read reactions of my groups" on public.message_reactions;
drop policy if exists "react as self"               on public.message_reactions;
drop policy if exists "change own reaction"         on public.message_reactions;
drop policy if exists "remove own reaction"         on public.message_reactions;

create policy "read reactions of my groups" on public.message_reactions
  for select to authenticated
  using (group_id in (select public.my_group_ids()));

create policy "react as self" on public.message_reactions
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and group_id in (select public.my_group_ids())
  );

create policy "change own reaction" on public.message_reactions
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "remove own reaction" on public.message_reactions
  for delete to authenticated
  using (user_id = auth.uid());

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

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('chat', 'chat', false, 5242880,
        array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public             = excluded.public,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "read chat media of my groups"   on storage.objects;
drop policy if exists "upload chat media to my groups" on storage.objects;
drop policy if exists "replace own chat media"         on storage.objects;
drop policy if exists "remove own chat media"          on storage.objects;

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

create policy "replace own chat media" on storage.objects
  for update to authenticated
  using (bucket_id = 'chat' and owner = auth.uid())
  with check (bucket_id = 'chat' and owner = auth.uid());

create policy "remove own chat media" on storage.objects
  for delete to authenticated
  using (bucket_id = 'chat' and owner = auth.uid());

-- ─── squad profile: look & public memories ────────────────────────────

alter table public.groups add column if not exists banner_url      text;
alter table public.groups add column if not exists wallpaper_url   text;
alter table public.groups add column if not exists memories_public boolean not null default false;

create or replace function public.update_squad_look(
  p_group_id        uuid,
  p_avatar_url      text,
  p_banner_url      text,
  p_wallpaper_url   text,
  p_memories_public boolean
)
returns public.groups language plpgsql security definer set search_path to 'public' as $function$
declare
  pattern text := '^https://[a-z0-9]+\.supabase\.co/storage/v1/object/public/squads/' || p_group_id::text || '/[A-Za-z0-9_.-]+$';
  result public.groups;
begin
  if not exists (
    select 1 from public.group_members
     where group_id = p_group_id and user_id = auth.uid()
  ) then
    raise exception 'Only members can change how the squad looks.';
  end if;

  if (p_avatar_url    is not null and p_avatar_url    !~ pattern)
  or (p_banner_url    is not null and p_banner_url    !~ pattern)
  or (p_wallpaper_url is not null and p_wallpaper_url !~ pattern)
  or position('..' in coalesce(p_avatar_url,'') || coalesce(p_banner_url,'') || coalesce(p_wallpaper_url,'')) > 0 then
    raise exception 'Squad images must be uploaded to this squad.';
  end if;

  update public.groups
     set avatar_url      = p_avatar_url,
         banner_url      = p_banner_url,
         wallpaper_url   = p_wallpaper_url,
         memories_public = coalesce(p_memories_public, false)
   where id = p_group_id
  returning * into result;

  return result;
end;
$function$;

revoke execute on function public.update_squad_look(uuid, text, text, text, boolean) from public, anon;
grant  execute on function public.update_squad_look(uuid, text, text, text, boolean) to authenticated;

create or replace function public.squad_nights_kept(p_group_id uuid)
returns integer language sql stable security definer set search_path to 'public' as $function$
  select count(*)::integer
    from public.events e
   where e.group_id = p_group_id
     and e.date < current_date
     and exists (select 1 from public.event_photos p where p.event_id = e.id);
$function$;

revoke execute on function public.squad_nights_kept(uuid) from public, anon;
grant  execute on function public.squad_nights_kept(uuid) to authenticated;

create or replace function public.event_has_photo(p_event_id uuid)
returns boolean language sql stable security definer set search_path to 'public' as $function$
  select exists (select 1 from public.event_photos p where p.event_id = p_event_id);
$function$;

revoke execute on function public.event_has_photo(uuid) from public, anon;
grant  execute on function public.event_has_photo(uuid) to authenticated;

drop policy if exists "read past events of squads with public memories" on public.events;

create policy "read past events of squads with public memories" on public.events
  for select to authenticated
  using (
    date < current_date
    and public.event_has_photo(events.id)
    and exists (
      select 1 from public.groups g
       where g.id = events.group_id
         and g.memories_public
    )
  );

drop policy if exists "read public memory photos" on public.event_photos;

create policy "read public memory photos" on public.event_photos
  for select to authenticated
  using (
    exists (
      select 1
        from public.events e
        join public.groups g on g.id = e.group_id
       where e.id = event_photos.event_id
         and e.date < current_date
         and g.memories_public
    )
  );

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('squads', 'squads', true, 5242880,
        array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public             = excluded.public,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "read public memory media"     on storage.objects;
drop policy if exists "read squad look"              on storage.objects;
drop policy if exists "upload squad look"            on storage.objects;
drop policy if exists "replace squad look"           on storage.objects;
drop policy if exists "remove squad look"            on storage.objects;

create policy "read public memory media" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'chat'
    and exists (
      select 1
        from public.event_photos p
        join public.events e on e.id = p.event_id
        join public.groups g on g.id = e.group_id
       where p.path = storage.objects.name
         and p.user_id = storage.objects.owner
         and p.path like e.group_id::text || '/events/' || e.id::text || '/%'
         and e.date < current_date
         and g.memories_public
    )
  );

create policy "read squad look" on storage.objects
  for select to authenticated
  using (bucket_id = 'squads');

create policy "upload squad look" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'squads'
    and (storage.foldername(name))[1] in (
      select g::text from public.my_group_ids() g
    )
  );

create policy "replace squad look" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'squads'
    and (storage.foldername(name))[1] in (
      select g::text from public.my_group_ids() g
    )
  )
  with check (
    bucket_id = 'squads'
    and (storage.foldername(name))[1] in (
      select g::text from public.my_group_ids() g
    )
  );

create policy "remove squad look" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'squads'
    and (storage.foldername(name))[1] in (
      select g::text from public.my_group_ids() g
    )
  );
