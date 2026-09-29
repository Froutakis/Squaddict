-- Search that ignores accents and case, so "καφε" finds "Καφές" and "λαδαδικα"
-- finds "Λαδάδικα". Run once in the Supabase SQL editor, after schema.sql
-- (it reuses public.fold_text from there).

-- Treat the typed text literally inside LIKE.
create or replace function public.like_escape(t text)
returns text language sql immutable as $function$
  select replace(replace(replace(coalesce(t, ''), '\', '\\'), '%', '\%'), '_', '\_');
$function$;

-- Upcoming public plans whose title or place matches. Security invoker:
-- the events policies still decide what the caller may see.
create or replace function public.search_public_event_ids(needle text)
returns setof uuid language sql stable set search_path to 'public' as $function$
  select e.id
    from public.events e
   where e.is_public
     and e.date >= current_date
     and (
       public.fold_text(e.title)       like '%' || public.like_escape(public.fold_text(needle)) || '%' escape '\'
       or public.fold_text(e.location)    like '%' || public.like_escape(public.fold_text(needle)) || '%' escape '\'
       or public.fold_text(e.place_label) like '%' || public.like_escape(public.fold_text(needle)) || '%' escape '\'
     )
   limit 200;
$function$;

create or replace function public.search_groups_folded(needle text, lim int default 20)
returns setof public.groups language sql stable set search_path to 'public' as $function$
  select g.*
    from public.groups g
   where public.fold_text(g.name)   like '%' || public.like_escape(public.fold_text(needle)) || '%' escape '\'
      or public.fold_text(g.handle) like '%' || public.like_escape(public.fold_text(needle)) || '%' escape '\'
   order by g.member_count desc
   limit greatest(1, least(lim, 50));
$function$;
