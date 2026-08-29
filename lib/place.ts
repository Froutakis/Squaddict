export type PlaceLines = {
  primary?: string;
  secondary?: string;
};

export function placeLines(nickname?: string, address?: string): PlaceLines {
  const name = nickname?.trim();
  const spot = address?.trim();

  if (name && spot && name !== spot) return { primary: name, secondary: spot };

  return { primary: name || spot || undefined };
}
