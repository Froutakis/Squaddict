-- 6 events per squad around Thessaloniki.
-- Seeded events carry a hidden 'seed' tag (the app ignores unknown tags),
-- so re-running replaces them and the cleanup at the bottom removes only them.

begin;

delete from public.events where 'seed' = any(tags);

with grp as (
  select
    g.id,
    row_number() over (order by g.created_at, g.id) - 1 as rn,
    coalesce(
      (select gm.user_id from public.group_members gm
        where gm.group_id = g.id and gm.user_id = g.created_by),
      (select gm.user_id from public.group_members gm
        where gm.group_id = g.id order by gm.joined_at limit 1)
    ) as author
  from public.groups g
),
places (idx, title, location, place_label, lat, lng, tag, start_time, end_time, description) as (
  values
    (0,  'Καφές στην Αριστοτέλους',     'Πλατεία Αριστοτέλους', 'Πλατεία Αριστοτέλους, Θεσσαλονίκη',   40.6325::float8, 22.9410::float8, 'coffee',   '11:00'::time, '13:00'::time, 'Freddo και κουβέντα με θέα τη θάλασσα.'),
    (1,  'Βόλτα στη Νέα Παραλία',       'Ομπρέλες Ζογγολόπουλου', 'Νέα Παραλία, Θεσσαλονίκη',          40.6182, 22.9530, 'outdoors', '19:00', '21:00', 'Περπάτημα από τις Ομπρέλες μέχρι τον Πύργο.'),
    (2,  'Ποτά στα Λαδάδικα',           'Λαδάδικα',             'Λαδάδικα, Θεσσαλονίκη',               40.6357, 22.9372, 'drinks',   '21:30', '23:30', 'Πρώτος γύρος κερασμένος από όποιον αργήσει.'),
    (3,  'Ηλιοβασίλεμα στο Επταπύργιο', 'Επταπύργιο',           'Άνω Πόλη, Θεσσαλονίκη',               40.6440, 22.9617, 'outdoors', '19:30', '21:00', 'Ανεβαίνουμε Άνω Πόλη για τη θέα.'),
    (4,  'Μεζέδες στο Καπάνι',          'Αγορά Καπάνι',         'Αγορά Καπάνι, Θεσσαλονίκη',           40.6377, 22.9408, 'food',     '13:30', '15:30', 'Τσίπουρο και μεζέδες μέσα στην αγορά.'),
    (5,  'Παγωτό στον Λευκό Πύργο',     'Λευκός Πύργος',        'Λευκός Πύργος, Θεσσαλονίκη',          40.6264, 22.9484, 'outdoors', '18:00', '19:30', 'Παγωτό και βόλτα στην παραλία.'),
    (6,  'Ροτόντα και Καμάρα',          'Ροτόντα',              'Ροτόντα, Θεσσαλονίκη',                40.6333, 22.9527, 'culture',  '17:00', '18:30', 'Μικρή ξενάγηση στα μνημεία του κέντρου.'),
    (7,  'Συναυλία στο Μέγαρο',         'Μέγαρο Μουσικής',      'Μέγαρο Μουσικής Θεσσαλονίκης',        40.5947, 22.9519, 'music',    '20:30', '22:30', 'Κλείνουμε εισιτήρια μαζί.'),
    (8,  'Πεζοπορία στο Σέιχ Σου',      'Σέιχ Σου',             'Δάσος Σέιχ Σου, Θεσσαλονίκη',         40.6490, 22.9760, 'sports',   '10:00', '12:30', 'Άνετη διαδρομή, φέρτε νερό.'),
    (9,  'Brunch στη Ναυαρίνου',        'Πλατεία Ναυαρίνου',    'Πλατεία Ναυαρίνου, Θεσσαλονίκη',      40.6308, 22.9490, 'food',     '12:00', '14:00', 'Αργό Κυριακάτικο brunch.'),
    (10, 'Σινεμά στο λιμάνι',           'Αποθήκη Α''',          'Λιμάνι Θεσσαλονίκης',                 40.6345, 22.9337, 'culture',  '20:00', '22:30', 'Προβολή στις αποθήκες του λιμανιού.'),
    (11, 'Board games στο κέντρο',      'Αγία Σοφία',           'Πλατεία Αγίας Σοφίας, Θεσσαλονίκη',   40.6327, 22.9469, 'games',    '18:30', '21:30', 'Φέρτε το αγαπημένο σας παιχνίδι.')
),
slots (slot, day_offset, is_public) as (
  values (0, 1, false), (1, 2, false), (2, 4, true), (3, 6, false), (4, 9, false), (5, 13, true)
)
insert into public.events
  (group_id, created_by, title, date, start_time, end_time,
   location, place_label, description, lat, lng, tags, is_public)
select
  grp.id,
  grp.author,
  p.title,
  current_date + s.day_offset,
  p.start_time,
  p.end_time,
  p.location,
  p.place_label,
  p.description,
  p.lat,
  p.lng,
  array[p.tag, 'seed'],
  s.is_public
from grp
cross join slots s
join places p on p.idx = (grp.rn * 2 + s.slot) % 12
where grp.author is not null;

insert into public.event_attendees (event_id, user_id, status)
select e.id, e.created_by, 'in'
from public.events e
where 'seed' = any(e.tags)
on conflict (event_id, user_id) do nothing;

commit;

select g.name, count(e.id) as events
from public.groups g
left join public.events e on e.group_id = g.id and 'seed' = any(e.tags)
group by g.name
order by g.name;

-- To remove every seeded event (their RSVPs go with them):
-- delete from public.events where 'seed' = any(tags);
