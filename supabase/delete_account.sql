-- Delete your account from inside the app (the App Store requires it).
-- Run once in the Supabase SQL editor, after schema.sql and the feature files.
--
-- The profile row is kept as a tombstone called "Deleted user · xxxx", so the
-- messages you sent stay in your friends' chats. Everything else that ties
-- the account to you goes, and finally the login itself (auth.users).
-- profiles.id has no foreign key to auth.users, so the tombstone survives.
-- The app removes your photo files and avatar from storage before calling this.
create or replace function public.delete_account()
returns void language plpgsql security definer set search_path to 'public' as $function$
declare
  me uuid := auth.uid();
begin
  if me is null then
    raise exception 'Sign in to continue.';
  end if;

  update public.profiles
     set display_name = 'Deleted user · ' || left(me::text, 4),
         avatar_url   = null
   where id = me;

  delete from public.push_tokens     where user_id = me;
  delete from public.event_attendees where user_id = me;
  delete from public.event_photos    where user_id = me;
  delete from public.message_reactions where user_id = me;
  delete from public.message_mentions  where user_id = me;

  if to_regclass('public.event_checkins') is not null then
    execute 'delete from public.event_checkins where user_id = $1' using me;
  end if;
  if to_regclass('public.parea_follows') is not null then
    execute 'delete from public.parea_follows where user_id = $1' using me;
  end if;
  if to_regclass('public.parea_going_pushes') is not null then
    execute 'delete from public.parea_going_pushes where user_id = $1' using me;
  end if;

  -- Last: leave every squad (member counts follow via their trigger).
  delete from public.group_members where user_id = me;

  delete from auth.users where id = me;
end $function$;

revoke all on function public.delete_account() from public, anon;
grant execute on function public.delete_account() to authenticated;
