-- Live locations for events that are happening now.
-- Positions travel over a private Realtime channel named 'live:<event id>' using Presence.
-- Nothing is stored: a position disappears as soon as its owner closes the app.
-- Only people who answered 'in' to that event may share or see positions.

create or replace function public.is_in_live_event(topic text)
returns boolean language sql stable security definer set search_path to 'public' as $function$
  select exists (
    select 1
    from public.event_attendees a
    where topic like 'live:%'
      and a.event_id::text = substring(topic from 6)
      and a.user_id = auth.uid()
      and a.status = 'in'
  );
$function$;

drop policy if exists "in attendees see live locations" on realtime.messages;
create policy "in attendees see live locations" on realtime.messages
  for select to authenticated
  using (
    realtime.messages.extension = 'presence'
    and public.is_in_live_event(realtime.topic())
  );

drop policy if exists "in attendees share live locations" on realtime.messages;
create policy "in attendees share live locations" on realtime.messages
  for insert to authenticated
  with check (
    realtime.messages.extension = 'presence'
    and public.is_in_live_event(realtime.topic())
  );
