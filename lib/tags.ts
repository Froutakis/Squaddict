export const EVENT_TAGS = [
  'food',
  'drinks',
  'coffee',
  'sports',
  'outdoors',
  'music',
  'culture',
  'games',
  'travel',
  'other',
] as const;

export type EventTag = (typeof EVENT_TAGS)[number];

const LABELS: Record<EventTag, string> = {
  food: 'Food',
  drinks: 'Drinks',
  coffee: 'Coffee',
  sports: 'Sports',
  outdoors: 'Outdoors',
  music: 'Music',
  culture: 'Culture',
  games: 'Games',
  travel: 'Travel',
  other: 'Other',
};

export function tagLabel(tag: EventTag): string {
  return LABELS[tag];
}

export function isEventTag(value: string): value is EventTag {
  return (EVENT_TAGS as readonly string[]).includes(value);
}

export function toEventTags(values: unknown): EventTag[] {
  if (!Array.isArray(values)) return [];
  return values.filter(function (v): v is EventTag {
    return typeof v === 'string' && isEventTag(v);
  });
}
