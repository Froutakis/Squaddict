-- PostgREST needs direct foreign keys to public.profiles in order to resolve
-- queries such as `profiles(display_name)` from group_members and messages.

alter table public.group_members
  drop constraint if exists group_members_user_id_fkey;

alter table public.group_members
  add constraint group_members_user_id_fkey
  foreign key (user_id)
  references public.profiles(id)
  on delete cascade;

alter table public.messages
  drop constraint if exists messages_sender_id_fkey;

alter table public.messages
  add constraint messages_sender_id_fkey
  foreign key (sender_id)
  references public.profiles(id)
  on delete cascade;
