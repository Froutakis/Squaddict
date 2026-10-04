-- Setup check: which of the supabase/*.sql files have been applied.
-- Read-only: it only looks, it changes nothing. Paste it in the SQL editor and run.
-- Every row says what it looked for, which file creates it, and ✅ or ❌.
-- Run the files with ❌ rows in the order listed at the bottom.

with checks(file, step, what, ok) as (
  values
  -- schema.sql
  ('schema.sql', 1, 'table profiles',             to_regclass('public.profiles') is not null),
  ('schema.sql', 1, 'table groups',               to_regclass('public.groups') is not null),
  ('schema.sql', 1, 'table group_members',        to_regclass('public.group_members') is not null),
  ('schema.sql', 1, 'table group_invites',        to_regclass('public.group_invites') is not null),
  ('schema.sql', 1, 'table events',               to_regclass('public.events') is not null),
  ('schema.sql', 1, 'table event_attendees',      to_regclass('public.event_attendees') is not null),
  ('schema.sql', 1, 'table event_photos',         to_regclass('public.event_photos') is not null),
  ('schema.sql', 1, 'table messages',             to_regclass('public.messages') is not null),
  ('schema.sql', 1, 'table message_reactions',    to_regclass('public.message_reactions') is not null),
  ('schema.sql', 1, 'table message_mentions',     to_regclass('public.message_mentions') is not null),
  ('schema.sql', 1, 'function my_group_ids',      to_regprocedure('public.my_group_ids()') is not null),
  ('schema.sql', 1, 'function fold_text',         to_regprocedure('public.fold_text(text)') is not null),
  ('schema.sql', 1, 'function join_squad',        to_regprocedure('public.join_squad(text)') is not null),
  ('schema.sql', 1, 'function unread_counts',     to_regprocedure('public.unread_counts()') is not null),
  ('schema.sql', 1, 'function mention_counts',    to_regprocedure('public.mention_counts()') is not null),
  ('schema.sql', 1, 'bucket chat',                exists (select 1 from storage.buckets where id = 'chat')),

  -- avatars.sql
  ('avatars.sql', 2, 'bucket avatars (public)',   exists (select 1 from storage.buckets where id = 'avatars' and public)),
  ('avatars.sql', 2, 'policy upload own avatar',  exists (select 1 from pg_policies where schemaname = 'storage' and policyname = 'upload own avatar')),

  -- live_locations.sql
  ('live_locations.sql', 3, 'function is_in_live_event', to_regprocedure('public.is_in_live_event(text)') is not null),
  ('live_locations.sql', 3, 'policy live locations (realtime)',
     exists (select 1 from pg_policies where schemaname = 'realtime' and policyname = 'in attendees see live locations')),

  -- push_notifications.sql
  ('push_notifications.sql', 4, 'extension pg_net',        exists (select 1 from pg_extension where extname = 'pg_net')),
  ('push_notifications.sql', 4, 'table push_tokens',       to_regclass('public.push_tokens') is not null),
  ('push_notifications.sql', 4, 'function register_push_token', to_regprocedure('public.register_push_token(text,text)') is not null),
  ('push_notifications.sql', 4, 'function send_pushes',    to_regprocedure('public.send_pushes(jsonb)') is not null),
  ('push_notifications.sql', 4, 'trigger messages_push',   exists (select 1 from pg_trigger where tgname = 'messages_push' and not tgisinternal)),
  ('push_notifications.sql', 4, 'trigger events_push',     exists (select 1 from pg_trigger where tgname = 'events_push' and not tgisinternal)),

  -- memories.sql
  ('memories.sql', 5, 'table event_checkins',       to_regclass('public.event_checkins') is not null),
  ('memories.sql', 5, 'policy check in when i am in', exists (select 1 from pg_policies where tablename = 'event_checkins' and policyname = 'check in when i am in')),
  ('memories.sql', 5, 'trigger event_photos_push',  exists (select 1 from pg_trigger where tgname = 'event_photos_push' and not tgisinternal)),

  -- explore_photos.sql
  ('explore_photos.sql', 6, 'column event_photos.in_explore',
     exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'event_photos' and column_name = 'in_explore')),
  ('explore_photos.sql', 6, 'function set_photo_in_explore', to_regprocedure('public.set_photo_in_explore(uuid,boolean)') is not null),
  ('explore_photos.sql', 6, 'function explore_highlights',
     exists (select 1 from pg_proc where proname = 'explore_highlights' and pronamespace = 'public'::regnamespace)),
  ('explore_photos.sql', 6, 'storage policy read explore photo files',
     exists (select 1 from pg_policies where schemaname = 'storage' and policyname = 'read explore photo files')),

  -- event_covers.sql
  ('event_covers.sql', 7, 'column events.cover_url',
     exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'events' and column_name = 'cover_url')),
  ('event_covers.sql', 7, 'bucket event-covers (public)', exists (select 1 from storage.buckets where id = 'event-covers' and public)),
  ('event_covers.sql', 7, 'policy upload squad cover',
     exists (select 1 from pg_policies where schemaname = 'storage' and policyname = 'upload squad cover')),

  -- parea_going.sql
  ('parea_going.sql', 8, 'table parea_going_pushes', to_regclass('public.parea_going_pushes') is not null),
  ('parea_going.sql', 8, 'function parea_going',     to_regprocedure('public.parea_going()') is not null),
  ('parea_going.sql', 8, 'trigger event_attendees_parea_going',
     exists (select 1 from pg_trigger where tgname = 'event_attendees_parea_going' and not tgisinternal)),

  -- follows.sql
  ('follows.sql', 9, 'table parea_follows', to_regclass('public.parea_follows') is not null),
  ('follows.sql', 9, 'column groups.parea_follower_count',
     exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'groups' and column_name = 'parea_follower_count')),
  ('follows.sql', 9, 'trigger parea_follows_count',
     exists (select 1 from pg_trigger where tgname = 'parea_follows_count' and not tgisinternal)),

  -- search.sql
  ('search.sql', 10, 'function search_public_event_ids', to_regprocedure('public.search_public_event_ids(text)') is not null),
  ('search.sql', 10, 'function search_groups_folded',    to_regprocedure('public.search_groups_folded(text,integer)') is not null),

  -- parea_profile.sql
  ('parea_profile.sql', 11, 'function parea_profile', to_regprocedure('public.parea_profile(uuid)') is not null),

  -- delete_account.sql
  ('delete_account.sql', 12, 'function delete_account', to_regprocedure('public.delete_account()') is not null),

  -- squad_votes.sql
  ('squad_votes.sql', 13, 'table squad_proposals',    to_regclass('public.squad_proposals') is not null),
  ('squad_votes.sql', 13, 'table squad_ballots',      to_regclass('public.squad_ballots') is not null),
  ('squad_votes.sql', 13, 'table squad_event_going',  to_regclass('public.squad_event_going') is not null),
  ('squad_votes.sql', 13, 'function propose',         to_regprocedure('public.propose(uuid,text,uuid)') is not null),
  ('squad_votes.sql', 13, 'function vote',            to_regprocedure('public.vote(uuid,boolean)') is not null),
  ('squad_votes.sql', 13, 'function can_answer_event', to_regprocedure('public.can_answer_event(uuid)') is not null),
  ('squad_votes.sql', 13, 'policy answer plans i can go to',
     exists (select 1 from pg_policies where tablename = 'event_attendees' and policyname = 'answer plans i can go to')),
  ('squad_votes.sql', 13, 'old follow-vote tables dropped', to_regclass('public.squad_follow_proposals') is null)
)
select step,
       file,
       what,
       case when ok then '✅' else '❌ missing' end as status
from checks
order by ok, step, what;

-- A second, optional query: how much data is there, including the demo seed.
-- select
--   (select count(*) from public.profiles)                                   as people,
--   (select count(*) from public.groups)                                     as squads,
--   (select count(*) from public.groups where id in (select md5('squaddict-demo-squad-' || n)::uuid from generate_series(1, 6) n)) as demo_squads,
--   (select count(*) from public.events)                                     as events,
--   (select count(*) from public.events where cover_url is not null)         as events_with_cover,
--   (select count(*) from public.event_photos)                               as photos,
--   (select count(*) from public.messages)                                   as messages,
--   (select count(*) from public.push_tokens)                                as devices_for_push;
