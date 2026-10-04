// TEMPORARY FAKE CLIENT FOR BROWSER TESTING — restored afterwards.
const ME = 'me';
const day = (n: number) => { const d = new Date(); d.setDate(d.getDate() + n); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; };
const people: Record<string, string> = { me: 'Δημήτρης', u1: 'Μαρία', u2: 'Νίκος', u3: 'Ελένη', u4: 'Γιώργος' };
const prof = (id: string) => ({ display_name: people[id], avatar_url: null });
const groups = [
  { id: 'g1', handle: 'ladadika', name: 'Ladadika Nights', bio: 'Κάθε Πέμπτη κάπου στα Λαδάδικα. Όποιος αργεί κερνάει.', avatar_url: 'https://picsum.photos/seed/sqav1/300/300',
    banner_url: 'https://picsum.photos/seed/sqbanner1/1200/600', memories_public: true, member_count: 5, created_at: '2026-03-02T10:00:00Z', parea_follower_count: 12 },
  { id: 'g2', handle: 'coffee', name: 'Thess Coffee Club', bio: null, avatar_url: null, banner_url: null, memories_public: false, member_count: 4, created_at: '2026-05-10T10:00:00Z' },
  { id: 'g3', handle: 'beachers', name: 'Beach Crew', bio: null, avatar_url: 'https://picsum.photos/seed/sqav3/300/300',
    banner_url: 'https://picsum.photos/seed/sqbanner3/1200/800', memories_public: false, member_count: 7, created_at: '2026-06-01T10:00:00Z' },
  { id: 'g4', handle: 'jazzy', name: 'Jazz Lovers', bio: null, avatar_url: 'https://picsum.photos/seed/sqav4/300/300', banner_url: null, memories_public: false, member_count: 6, created_at: '2026-06-02T10:00:00Z' },
  { id: 'g5', handle: 'kayak', name: 'Sunset Kayak', bio: null, avatar_url: null, banner_url: null, memories_public: false, member_count: 5, created_at: '2026-06-03T10:00:00Z' },
  { id: 'g6', handle: 'quiz', name: 'Quiz Night SKG', bio: null, avatar_url: 'https://picsum.photos/seed/sqav6/300/300', banner_url: null, memories_public: false, member_count: 8, created_at: '2026-06-04T10:00:00Z' },
];
const ev = (id: string, g: number, title: string, date: string, st: string | null, en: string | null, ins: string[]) => ({
  id, group_id: groups[g].id, title, date, start_time: st, end_time: en, location: title.split(' στ')[1] ?? 'Θεσσαλονίκη',
  place_label: 'Θεσσαλονίκη', description: 'Έλα κι εσύ, θα περάσουμε ωραία.', created_by: 'u1', is_public: false,
  lat: 40.6357, lng: 22.9372, tags: [], groups: { id: groups[g].id, name: groups[g].name },
  event_attendees: ins.map((u) => ({ user_id: u, status: 'in', profiles: prof(u) })),
});
const db: Record<string, any[]> = {
  profiles: Object.keys(people).map((id) => ({ id, display_name: people[id], avatar_url: null, created_at: '2026-06-12T10:00:00Z' })),
  group_members: [
    ...groups.map((g) => ({ group_id: g.id, user_id: ME, groups: g, profiles: prof(ME) })),
    ...['u1', 'u2', 'u3', 'u4'].map((u) => ({ group_id: 'g1', user_id: u, groups: groups[0], profiles: prof(u) })),
  ],
  events: [
    ev('e1', 0, 'Brunch στη Ναυαρίνου', day(-30), '12:00', '14:00', ['me', 'u1', 'u2']),
    ev('e2', 0, 'Ηλιοβασίλεμα στο Επταπύργιο', day(-3), '19:30', '21:00', ['u1', 'u3']),
    ev('e3', 0, 'Μεζέδες στο Καπάνι', day(-1), '13:30', '15:30', ['me', 'u2', 'u3', 'u4']),
    { ...ev('e8', 0, 'Δημόσιο πάρτι', day(-2), '21:00', '23:00', ['me', 'u1']), is_public: true },
    ev('e4', 1, 'Καφές στην Αριστοτέλους', day(0), '08:00', '10:00', ['me', 'u1']),
    ev('e5', 0, 'Ποτά στα Λαδάδικα', day(0), '00:00', '23:59', ['me', 'u1', 'u2', 'u3']),
    ev('e9', 0, 'Τάβλι στην Άνω Πόλη', day(0), '22:30', '01:00', ['u2', 'u3']),
    ev('e6', 0, 'Σινεμά στο λιμάνι', day(2), '20:00', '22:30', ['u1']),
    ev('e7', 1, 'Βόλτα στη Νέα Παραλία', day(4), '19:00', '21:00', []),
  ],
  event_photos: ([['e1', 3], ['e2', 2], ['e3', 5], ['h1', 3], ['h2', 2], ['h3', 4]] as [string, number][]).flatMap(([e, n]) =>
    Array.from({ length: n }, (_, i) => ({ id: `${e}-p${i}`, event_id: e, user_id: i % 2 ? 'u1' : ME, path: `g/events/${e}/${i}.jpg`, width: 600, height: 900, created_at: `2026-01-0${i + 1}` }))),
  messages: [
    { id: 'm1', group_id: 'g1', sender_id: 'u1', content: 'Ποιος είναι για απόψε;', created_at: new Date().toISOString(), edited_at: null, deleted_at: null, reply_to: null, attachment_path: null, profiles: prof('u1') },
    { id: 'm2', group_id: 'g2', sender_id: 'u2', content: 'Φέρνω κρουασάν αύριο', created_at: new Date(Date.now() - 86400000).toISOString(), edited_at: null, deleted_at: null, reply_to: null, attachment_path: null, profiles: prof('u2') },
  ],
  event_checkins: [{ event_id: 'e5', user_id: 'u1' }, { event_id: 'e5', user_id: 'u2' }],
  event_attendees: [] as any[],
  photo_reactions: [] as any[],
  group_invites: [{ group_id: 'g1', code: 'A1B2C3D4E5' }] as any[],
};
for (const [id, seed] of [['e5', 'bar'], ['e6', 'cinema'], ['e7', 'sea']]) {
  const e = db.events.find((x: any) => x.id === id); if (e) e.cover_url = `https://picsum.photos/seed/${seed}/1280/720`;
}
db.events.find((x: any) => x.id === 'e7').event_attendees = [];
// Public nights of other pareas this week, for Explore's line (two at Μπιτ Παζάρ: the spot).
for (const [id, g, title, ago, place, lat, lng] of [
  ['c1', 3, 'Jam session στο Μπιτ Παζάρ', 1, 'Μπιτ Παζάρ', 40.6385, 22.9440],
  ['c2', 2, 'Κρασί στο Μπιτ Παζάρ', 2, 'Μπιτ Παζάρ', 40.6387, 22.9443],
  ['c3', 1, 'Ηλιοβασίλεμα στην Παραλία', 3, 'Νέα Παραλία', 40.6195, 22.9520],
] as any) {
  db.events.push({ ...ev(id, g, title, day(-ago), '21:00', '23:30', ['u1']), is_public: true, place_label: place, lat, lng });
  for (let i = 0; i < 3; i++) db.event_photos.push({ id: `${id}-p${i}`, event_id: id, user_id: 'u1', path: `g/events/${id}/${i}.jpg`, width: 600, height: 900, created_at: `2026-01-0${i + 1}` });
}
db.events.push({ ...ev('j1', 0, 'Jam session στο Μπιτ Παζάρ', day(5), '21:00', '23:30', []), group_id: 'xh2', is_public: true,
  groups: { name: 'Jazz Lovers', handle: 'jazz_skg', bio: null, member_count: 9, follower_count: 31 }, cover_url: 'https://picsum.photos/seed/sax/1280/720' });
for (const [id, title, n, cover] of [['j2', 'Swing night στην Αποθήκη', 9, null], ['j3', 'Open mic στα Λαδάδικα', 14, null]] as any) {
  db.events.push({ ...ev(id, 0, title, day(n), '21:30', '23:30', ['u1']), group_id: 'xh2', is_public: true,
    groups: { name: 'Jazz Lovers', handle: 'jazz_skg', bio: null, member_count: 9, parea_follower_count: 31 }, cover_url: cover });
}
for (const [id, t, n] of [['w1', 'Bowling στο Mediterranean', 6], ['w2', 'Σουβλάκια στον Τσίκο', 7], ['w3', 'Ποδήλατο στη Νέα Παραλία', 8]] as any) {
  db.events.push(ev(id, 1, t, day(n), '20:00', '22:00', []));
}
db.group_follows = [];
db.groups = groups;
db.user_prefs = [{ user_id: ME, acting_group_id: 'g1' }];
db.squad_follows = [
  { follower_group_id: 'g1', followed_group_id: 'g3', created_at: '2026-09-01', followed: groups[2] },
  { follower_group_id: 'g3', followed_group_id: 'g1', created_at: '2026-09-02', followed: groups[0] },
];
db.event_attendees = db.events.flatMap((e) => e.event_attendees.map((a: any) => ({ ...a, event_id: e.id })));
(globalThis as any).__db = db;

function query(table: string) {
  let rows = [...(db[table] ?? [])];
  let single = false;
  let write: any = null;
  const q: any = {
    select: () => q, order: () => q, or: () => q, limit: () => q, gte: () => q, lte: () => q, lt: (c: string, v: any) => { rows = rows.filter((r) => r[c] < v); return q; }, gt: () => q, neq: () => q, is: () => q, ilike: () => q, not: () => q, range: () => q,
    eq: (c: string, v: any) => { rows = rows.filter((r) => r[c] === v); return q; },
    in: (c: string, v: any[]) => { rows = rows.filter((r) => v.includes(r[c])); return q; },
    maybeSingle: () => { single = true; return q; }, single: () => { single = true; return q; },
    insert: (row: any) => { write = row; db[table].push(row); rows = [row]; return q; },
    upsert: (row: any) => { write = row; if (row.user_id && table === 'user_prefs') db[table] = db[table].filter((r) => r.user_id !== row.user_id); db[table].push(row); rows = [row]; return q; },
    update: () => q, delete: () => q,
    then: (res: any, rej: any) => Promise.resolve({ data: single ? rows[0] ?? null : rows, error: null, count: rows.length }).then(res, rej),
  };
  return q;
}
const channel: any = new Proxy({}, { get: (_t, k) => k === 'presenceState' ? () => ({}) : k === 'then' ? undefined : () => channel });
const user = { id: ME, email: 'me@x.gr' };
export const supabase: any = {
  from: query,
  rpc: async (name: string, args?: any) => name === 'crossed_pareas' ? { data: [
      { my_event_id: 'e3', night: day(-1), place: 'Καπάνι', other_group_id: 'g4', other_name: 'Jazz Lovers', other_avatar_url: 'https://picsum.photos/seed/sqav4/300/300', other_event_id: 'x1', other_title: 'Jazz και μεζέδες', times: 3 },
      { my_event_id: 'e2', night: day(-3), place: 'Επταπύργιο', other_group_id: 'g4', other_name: 'Jazz Lovers', other_avatar_url: 'https://picsum.photos/seed/sqav4/300/300', other_event_id: 'x2', other_title: 'Ηλιοβασίλεμα', times: 3 },
      { my_event_id: 'e1', night: day(-30), place: 'Ναυαρίνου', other_group_id: 'g4', other_name: 'Jazz Lovers', other_avatar_url: 'https://picsum.photos/seed/sqav4/300/300', other_event_id: 'x3', other_title: 'Brunch', times: 3 },
    ], error: null }
    : name === 'waves_for' ? { data: [{ id: 'w1', event_id: 'e2', created_at: new Date().toISOString(), from_group_id: 'g3', from_name: 'Beach Crew', from_avatar_url: 'https://picsum.photos/seed/sqav3/300/300', waved_back: false }], error: null }
    : name === 'send_wave' ? { data: [{ id: 'w2' }], error: null }
    : name === 'city_board' ? { data: [
      { group_id: 'g4', name: 'Jazz Lovers', avatar_url: null, nights: 14, place: 1, is_mine: false },
      { group_id: 'g3', name: 'Beach Crew', avatar_url: null, nights: 12, place: 2, is_mine: false },
      { group_id: 'xg', name: 'Rooftop Gang', avatar_url: null, nights: 11, place: 3, is_mine: false },
      { group_id: 'xg2', name: 'Run Club', avatar_url: null, nights: 11, place: 3, is_mine: false },
      { group_id: 'xg3', name: 'Orchestra', avatar_url: null, nights: 10, place: 5, is_mine: false },
      { group_id: 'g1', name: 'Ladadika Nights', avatar_url: null, nights: 8, place: 7, is_mine: true },
    ], error: null }
    : name === 'photo_reactions_for' ? { data: (args?.p_photo_ids ?? []).filter((id: string) => id.startsWith('e2-')).flatMap((id: string) => ['u1', 'u2', 'u3'].map((u) => ({ photo_id: id, user_id: u, emoji: '🔥', display_name: u, avatar_url: null, group_id: 'g1', group_name: 'Ladadika Nights' }))), error: null } : name === 'feed_nights' ? { data: [{ event_id: 'e1', reason: 'yours', via: null }, { event_id: 'e2', reason: 'yours', via: null }, { event_id: 'e3', reason: 'yours', via: null }, { event_id: 'h1', reason: 'member_went', via: 'Kostas Papas' }, { event_id: 'h2', reason: 'similar', via: 'music' }], error: null } : name === 'join_squad' ? (String(args?.invite_code) === 'A1B2C3D4E5' ? { data: db.groups.find((g: any) => g.id === 'g3'), error: null } : { data: null, error: { message: 'bad code' } }) : name === 'search_groups_folded' ? { data: [{ id: 'xh2', handle: 'jazz_skg', name: 'Jazz Lovers', member_count: 9, avatar_url: 'https://picsum.photos/seed/jz/200/200' }, { id: 'xh1', handle: 'rooftop_crew', name: 'Rooftop Crew', member_count: 14 }], error: null } : name === 'squad_nights_kept' ? { data: 14, error: null } : name === 'parea_profile' ? { data: [{ nights_out: 8, places: ['Μπιτ Παζάρ', 'Λαδάδικα', 'Αποθήκη Α'],
      covers: ['https://picsum.photos/seed/sax/1280/720', 'https://picsum.photos/seed/jazzbar/800/800'],
      photos: [1, 2, 3, 4, 5, 6].map((n) => ({ id: 'jp' + n, eventId: 'j1', userId: 'u9', path: `x/jazz/${n}.jpg`, width: 600, height: 600, createdAt: '' })) }], error: null }
    : name === 'unread_counts' ? { data: [{ squad: 'g1', unread: 4 }, { squad: 'g2', unread: 1 }], error: null }
    : name === 'mention_counts' ? { data: [], error: null }
    : name === 'parea_going' ? { data: [
    { event_id: 'pg1', title: 'Jazz στο Μπιτ Παζάρ', date: day(2), start_time: '21:30', end_time: null, location: 'Μπιτ Παζάρ', place_label: 'Θεσσαλονίκη',
      description: 'Live jazz.', lat: 40.64, lng: 22.94, cover_url: 'https://picsum.photos/seed/jazz/1280/720', group_id: 'xg', group_name: 'Jazz Lovers',
      going_count: 7, friends: [{ id: 'u1', name: 'Μαρία', avatarUrl: null }, { id: 'u2', name: 'Νίκος', avatarUrl: null }], via_groups: ['g1'] },
    { event_id: 'e8', title: 'Δημόσιο πάρτι', date: day(3), start_time: '22:00', end_time: null, location: null, place_label: 'Θεσσαλονίκη',
      description: null, lat: 40.64, lng: 22.94, cover_url: null, group_id: 'xg2', group_name: 'Party People',
      going_count: 12, friends: [{ id: 'u3', name: 'Ελένη', avatarUrl: null }], via_groups: ['g2'] },
  ], error: null } : name !== 'explore_highlights' ? { data: null, error: null } : { data: [
    ['h1', 'Rooftop στο Κέντρο', 'Rooftop Crew', 'rooftop_crew', 14, 6, 0],
    ['h2', 'Jazz στο Μπιτ Παζάρ', 'Jazz Lovers', 'jazz_skg', 9, 3, 1],
    ['h3', 'Picnic στο Σέιχ Σου', 'Green Walkers', 'green_walk', 22, 4, 2],
  ].map(([id, title, gname, handle, members, going, ago]: any) => ({
    event_id: id, title, date: day(-1 - ago), start_time: '21:00', end_time: '23:30', location: title.split(' στ')[1], place_label: 'Θεσσαλονίκη',
    description: 'Ανοιχτό σε όλους.', lat: 40.63, lng: 22.94, is_public: true, group_id: 'x' + id, group_name: gname, group_handle: handle,
    group_bio: 'Μια ανοιχτή παρέα.', member_count: members, going_count: going, photo_count: 3,
    cover_id: id + '-p0', cover_user_id: 'u9', cover_path: `x/${id}/0.jpg`, cover_width: 600, cover_height: 900, cover_created: '',
  })), error: null },
  channel: () => channel, removeChannel: async () => {}, realtime: { setAuth: () => {} },
  auth: {
    getSession: async () => ({ data: { session: { user } } }),
    getUser: async () => ({ data: { user } }),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
    signOut: async () => ({ error: null }),
  },
  storage: { from: () => ({
    createSignedUrls: async (paths: string[]) => ({ data: paths.map((p) => ({ path: p, signedUrl: `https://picsum.photos/seed/${p.replace(/[^a-z0-9]/gi, '')}/600/900` })), error: null }),
    upload: async () => ({ error: null }), remove: async () => ({ error: null }),
    getPublicUrl: (p: string) => ({ data: { publicUrl: p } }),
  }) },
};