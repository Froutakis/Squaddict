function parseLocal(dateStr: string) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function keyOf(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function dateParts(dateStr: string) {
  const d = parseLocal(dateStr);
  const month = d.toLocaleDateString('en-US', { month: 'short' }).toUpperCase();
  return { month, day: d.getDate() };
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
