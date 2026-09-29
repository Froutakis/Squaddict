export function parseLocal(dateStr: string) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function keyOf(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function addDays(d: Date, n: number) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
}

export function startOfWeek(d: Date) {
  return addDays(d, -((d.getDay() + 6) % 7));
}

export function addMonths(d: Date, n: number) {
  return new Date(d.getFullYear(), d.getMonth() + n, 1);
}

export function isDateKey(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export function parseDateKey(value: string) {
  return isDateKey(value) ? parseLocal(value) : null;
}

export function monthGrid(d: Date) {
  const start = startOfWeek(new Date(d.getFullYear(), d.getMonth(), 1));
  return Array.from({ length: 42 }, (_, i) => addDays(start, i));
}

export function dayMonth(dateStr: string) {
  const d = parseDateKey(dateStr);
  if (!d) return '';
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function dateParts(dateStr: string) {
  const d = parseLocal(dateStr);
  const month = d.toLocaleDateString('en-US', { month: 'short' }).toUpperCase();
  return { month, day: d.getDate() };
}

export function weekdayShort(dateStr: string) {
  const d = parseDateKey(dateStr);
  return d ? d.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase() : '';
}

export function formatDateTime(dateStr: string, time?: string) {
  const d = parseLocal(dateStr);
  const weekday = d.toLocaleDateString('en-US', { weekday: 'short' });
  const monthShort = d.toLocaleDateString('en-US', { month: 'short' });
  const base = `${weekday} ${d.getDate()} ${monthShort}`;
  return time ? `${base} · ${time}` : base;
}

export function daysUntil(dateStr: string) {
  const target = parseLocal(dateStr);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((target.getTime() - today.getTime()) / 86400000);
}

export function countdownLabel(dateStr: string) {
  const n = daysUntil(dateStr);
  if (n <= 0) return 'TODAY';
  if (n === 1) return 'TOMORROW';
  return `IN ${n} DAYS`;
}

export function todayLabel() {
  const now = new Date();
  const weekday = now.toLocaleDateString('en-US', { weekday: 'long' });
  const month = now.toLocaleDateString('en-US', { month: 'long' });
  return `${weekday} ${now.getDate()} ${month}`;
}

export function dayFilterLabel(dateStr: string) {
  const n = daysUntil(dateStr);
  if (n === 0) return 'today';
  if (n === 1) return 'tomorrow';

  const d = parseLocal(dateStr);
  const weekday = d.toLocaleDateString('en-US', { weekday: 'long' });
  return `${weekday} ${d.getDate()}`;
}

const PHOTO_WINDOW_HOURS = 12;

function atTime(day: Date, time: string, dayOffset = 0) {
  const [h, m] = time.split(':').map(Number);
  return new Date(day.getFullYear(), day.getMonth(), day.getDate() + dayOffset, h, m);
}

const DEFAULT_LENGTH_HOURS = 3;

function readTime(time?: string) {
  const clean = time?.trim();
  return clean !== undefined && /^\d{1,2}:\d{2}$/.test(clean) ? clean : undefined;
}

export function eventWindow(dateStr: string, rawStart?: string, rawEnd?: string) {
  const day = parseLocal(dateStr);
  const startTime = readTime(rawStart);
  const endTime = readTime(rawEnd);
  const startsAt = startTime
    ? atTime(day, startTime)
    : new Date(day.getFullYear(), day.getMonth(), day.getDate());

  let endsAt: Date;
  if (endTime) {
    const pastMidnight = startTime !== undefined && endTime < startTime;
    endsAt = atTime(day, endTime, pastMidnight ? 1 : 0);
  } else if (startTime) {
    endsAt = new Date(startsAt.getTime() + DEFAULT_LENGTH_HOURS * 3600000);
  } else {
    endsAt = atTime(day, '23:59');
  }

  return { startsAt, endsAt };
}

export function isHappeningNow(
  dateStr: string,
  startTime?: string,
  endTime?: string,
  now: Date = new Date(),
) {
  const { startsAt, endsAt } = eventWindow(dateStr, startTime, endTime);
  return now >= startsAt && now < endsAt;
}

export function liveLabel(
  dateStr: string,
  rawStart?: string,
  rawEnd?: string,
  now: Date = new Date(),
) {
  const startTime = readTime(rawStart);
  const endTime = readTime(rawEnd);
  if (!startTime) return 'TODAY';

  const { startsAt, endsAt } = eventWindow(dateStr, startTime, endTime);

  if (endTime) {
    const left = Math.round((endsAt.getTime() - now.getTime()) / 60000);
    if (left <= 5) return 'ENDING NOW';

    const hours = Math.floor(left / 60);
    return hours > 0 ? `ENDS IN ${hours}H ${left % 60}M` : `ENDS IN ${left}M`;
  }

  const since = Math.max(0, Math.round((now.getTime() - startsAt.getTime()) / 60000));
  if (since < 1) return 'STARTING NOW';

  const hours = Math.floor(since / 60);
  return hours > 0 ? `STARTED ${hours}H ${since % 60}M AGO` : `STARTED ${since}M AGO`;
}

export function photoWindow(dateStr: string, startTime?: string, endTime?: string) {
  const day = parseLocal(dateStr);
  const opensAt = new Date(day.getFullYear(), day.getMonth(), day.getDate());

  let end: Date;
  if (endTime) {
    const pastMidnight = startTime !== undefined && endTime < startTime;
    end = atTime(day, endTime, pastMidnight ? 1 : 0);
  } else if (startTime) {
    end = atTime(day, startTime);
  } else {
    end = atTime(day, '23:59');
  }

  return { opensAt, closesAt: new Date(end.getTime() + PHOTO_WINDOW_HOURS * 3600000) };
}

export function inPhotoWindow(
  dateStr: string,
  startTime?: string,
  endTime?: string,
  now: Date = new Date(),
) {
  const { opensAt, closesAt } = photoWindow(dateStr, startTime, endTime);
  return now >= opensAt && now < closesAt;
}

export function timeLabel(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

export function dayLabel(date: Date) {
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  if (keyOf(date) === keyOf(today)) return 'Today';
  if (keyOf(date) === keyOf(yesterday)) return 'Yesterday';

  return date.toLocaleDateString('en-US', {
    day: 'numeric',
    month: 'short',
    ...(date.getFullYear() === today.getFullYear() ? {} : { year: 'numeric' }),
  });
}

export type FeedWhen = 'today' | 'tomorrow' | 'weekend';

export function dateRange(when: FeedWhen, today = new Date()): [string, string] {
  const day = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const shift = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);

  if (when === 'today') return [keyOf(day), keyOf(day)];
  if (when === 'tomorrow') return [keyOf(shift(day, 1)), keyOf(shift(day, 1))];

  const weekday = day.getDay();
  if (weekday === 0) return [keyOf(day), keyOf(day)];

  const saturday = weekday === 6 ? day : shift(day, 6 - weekday);
  return [keyOf(saturday), keyOf(shift(saturday, 1))];
}
