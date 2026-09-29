-- Push notifications through Expo, sent straight from Postgres with pg_net.
-- Run once in the Supabase SQL editor.
--
-- The app stores each device's Expo push token; triggers on new messages and
-- new events build one notification per recipient device and post them to
-- Expo's push service. Content dated more than 10 minutes ago (seed scripts)
-- or inserted with `set local squaddict.skip_push = 'on'` stays silent.

create extension if not exists pg_net with schema extensions;

create table if not exists public.push_tokens (
  token      text        not null primary key,
  user_id    uuid        not null references public.profiles(id) on delete cascade,
  platform   text        not null,
  updated_at timestamptz not null default now(),
  constraint push_tokens_platform_check check (platform in ('ios', 'android'))
);

create index if not exists push_tokens_user_idx on public.push_tokens (user_id);

alter table public.push_tokens enable row level security;

drop policy if exists "read own push tokens" on public.push_tokens;
create policy "read own push tokens" on public.push_tokens
  for select to authenticated
  using (user_id = auth.uid());

-- A device belongs to whoever signed in on it last.
create or replace function public.register_push_token(push_token text, device_platform text)
returns void language plpgsql security definer set search_path to 'public' as $function$
begin
  if auth.uid() is null then
    raise exception 'Sign in to continue.';
  end if;

  if push_token !~ '^Expo(nent)?PushToken\[.+\]$' then
    raise exception 'That is not an Expo push token.';
  end if;

  insert into public.push_tokens (token, user_id, platform, updated_at)
  values (push_token, auth.uid(), device_platform, now())
  on conflict (token) do update
    set user_id    = excluded.user_id,
        platform   = excluded.platform,
        updated_at = now();
end $function$;

create or replace function public.unregister_push_token(push_token text)
returns void language sql security definer set search_path to 'public' as $function$
  delete from public.push_tokens where token = push_token and user_id = auth.uid();
$function$;

create or replace function public.push_is_quiet(created timestamptz)
returns boolean language sql stable as $function$
  select coalesce(current_setting('squaddict.skip_push', true), '') = 'on'
      or created < now() - interval '10 minutes';
$function$;

-- Expo accepts up to 100 notifications per request.
create or replace function public.send_pushes(notifications jsonb)
returns void language plpgsql security definer set search_path to 'public' as $function$
declare
  batch jsonb;
begin
  for batch in
    select jsonb_agg(item.value)
    from (
      select value, (row_number() over () - 1) / 100 as chunk
      from jsonb_array_elements(notifications)
    ) item
    group by item.chunk
  loop
    perform net.http_post(
      url     := 'https://exp.host/--/api/v2/push/send',
      body    := batch,
      headers := '{"Content-Type": "application/json", "Accept": "application/json"}'::jsonb
    );
  end loop;
end $function$;

create or replace function public.notify_new_message()
returns trigger language plpgsql security definer set search_path to 'public' as $function$
declare
  squad text;
  sender text;
  preview text;
  notifications jsonb;
begin
  if new.deleted_at is not null or public.push_is_quiet(coalesce(new.created_at, now())) then
    return null;
  end if;

  select name into squad from public.groups where id = new.group_id;
  select display_name into sender from public.profiles where id = new.sender_id;
  preview := case when coalesce(new.content, '') <> '' then left(new.content, 140) else '📷 Photo' end;

  select coalesce(jsonb_agg(jsonb_build_object(
           'to', t.token,
           'sound', 'default',
           'channelId', 'default',
           'title', case when mentioned then sender || ' mentioned you' else squad end,
           'body', case when mentioned then squad || ' · ' || preview else sender || ': ' || preview end,
           'data', jsonb_build_object('type', 'message', 'groupId', new.group_id)
         )), '[]'::jsonb)
    into notifications
  from (
    select m.user_id,
           position('@' || lower(p.display_name) in lower(coalesce(new.content, ''))) > 0 as mentioned
    from public.group_members m
    join public.profiles p on p.id = m.user_id
    where m.group_id = new.group_id
      and m.user_id <> new.sender_id
  ) recipient
  join public.push_tokens t on t.user_id = recipient.user_id;

  if jsonb_array_length(notifications) > 0 then
    perform public.send_pushes(notifications);
  end if;

  return null;
end $function$;

create or replace function public.notify_new_event()
returns trigger language plpgsql security definer set search_path to 'public' as $function$
declare
  squad text;
  creator text;
  starts text;
  notifications jsonb;
begin
  if public.push_is_quiet(new.created_at) or new.date < current_date then
    return null;
  end if;

  select name into squad from public.groups where id = new.group_id;
  select display_name into creator from public.profiles where id = new.created_by;
  starts := to_char(new.date, 'Dy DD Mon') || coalesce(' · ' || to_char(new.start_time, 'HH24:MI'), '');

  select coalesce(jsonb_agg(jsonb_build_object(
           'to', t.token,
           'sound', 'default',
           'channelId', 'default',
           'title', '📅 ' || new.title,
           'body', creator || ' posted a plan in ' || squad || ' · ' || starts,
           'data', jsonb_build_object('type', 'event', 'groupId', new.group_id, 'eventId', new.id)
         )), '[]'::jsonb)
    into notifications
  from public.group_members m
  join public.push_tokens t on t.user_id = m.user_id
  where m.group_id = new.group_id
    and m.user_id <> new.created_by;

  if jsonb_array_length(notifications) > 0 then
    perform public.send_pushes(notifications);
  end if;

  return null;
end $function$;

drop trigger if exists messages_push on public.messages;
create trigger messages_push
  after insert on public.messages
  for each row execute function public.notify_new_message();

drop trigger if exists events_push on public.events;
create trigger events_push
  after insert on public.events
  for each row execute function public.notify_new_event();
