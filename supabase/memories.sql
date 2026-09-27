-- Memories: shared check-ins ("I'm here") and a push when someone adds photos.
-- Run once in the Supabase SQL editor, after schema.sql and push_notifications.sql.

create table if not exists public.event_checkins (
  event_id      uuid        not null references public.events(id)   on delete cascade,
  user_id       uuid        not null references public.profiles(id) on delete cascade,
  checked_in_at timestamptz not null default now(),
  primary key (event_id, user_id)
);

create index if not exists event_checkins_event_idx on public.event_checkins (event_id);

alter table public.event_checkins enable row level security;

drop policy if exists "read check-ins of my squads events" on public.event_checkins;
drop policy if exists "check in when i am in"             on public.event_checkins;
drop policy if exists "undo own check-in"                 on public.event_checkins;

create policy "read check-ins of my squads events" on public.event_checkins
  for select to authenticated
  using (
    exists (
      select 1 from public.events e
       where e.id = event_checkins.event_id
         and e.group_id in (select public.my_group_ids())
    )
  );

-- Only people who said they're in, and only around the day of the event
-- (yesterday covers nights that run past midnight).
create policy "check in when i am in" on public.event_checkins
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
       where e.id = event_checkins.event_id
         and e.date between current_date - 1 and current_date
    )
  );

create policy "undo own check-in" on public.event_checkins
  for delete to authenticated
  using (user_id = auth.uid());

-- One push per burst: a second photo from the same person on the same night
-- within 10 minutes stays silent, so dropping 6 photos sends one notification.
create or replace function public.notify_new_photo()
returns trigger language plpgsql security definer set search_path to 'public' as $function$
declare
  squad_id uuid;
  squad text;
  night text;
  sender text;
  notifications jsonb;
begin
  if public.push_is_quiet(new.created_at) then
    return null;
  end if;

  if exists (
    select 1 from public.event_photos p
     where p.event_id = new.event_id
       and p.user_id  = new.user_id
       and p.id      <> new.id
       and p.created_at > new.created_at - interval '10 minutes'
  ) then
    return null;
  end if;

  select e.group_id, e.title, g.name
    into squad_id, night, squad
  from public.events e
  join public.groups g on g.id = e.group_id
  where e.id = new.event_id;

  select display_name into sender from public.profiles where id = new.user_id;

  select coalesce(jsonb_agg(jsonb_build_object(
           'to', t.token,
           'sound', 'default',
           'channelId', 'default',
           'title', '📸 ' || night,
           'body', sender || ' added photos in ' || squad,
           'data', jsonb_build_object('type', 'event', 'groupId', squad_id, 'eventId', new.event_id)
         )), '[]'::jsonb)
    into notifications
  from public.group_members m
  join public.push_tokens t on t.user_id = m.user_id
  where m.group_id = squad_id
    and m.user_id <> new.user_id;

  if jsonb_array_length(notifications) > 0 then
    perform public.send_pushes(notifications);
  end if;

  return null;
end $function$;

drop trigger if exists event_photos_push on public.event_photos;
create trigger event_photos_push
  after insert on public.event_photos
  for each row execute function public.notify_new_photo();
