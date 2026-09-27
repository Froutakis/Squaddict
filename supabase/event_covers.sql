-- Event covers: one photo per plan, shown behind the ticket.
-- Run once in the Supabase SQL editor, after schema.sql.
--
-- A public bucket, like avatars, so a cover loads with a plain URL in Home,
-- Explore and on the map without signing. Paths are <group id>/<event id>/<ts>.jpg
-- and only members of that squad may write there. Setting events.cover_url
-- follows the existing "creator updates event" policy.

alter table public.events
  add column if not exists cover_url text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('event-covers', 'event-covers', true, 3145728, array['image/jpeg'])
on conflict (id) do update
  set public             = excluded.public,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "list squad covers"   on storage.objects;
drop policy if exists "upload squad cover"  on storage.objects;
drop policy if exists "remove squad cover"  on storage.objects;

-- Needed by remove(): Storage checks select as well as delete.
create policy "list squad covers" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'event-covers'
    and (storage.foldername(name))[1] in (select public.my_group_ids()::text)
  );

create policy "upload squad cover" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'event-covers'
    and (storage.foldername(name))[1] in (select public.my_group_ids()::text)
  );

create policy "remove squad cover" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'event-covers'
    and owner = auth.uid()
  );
