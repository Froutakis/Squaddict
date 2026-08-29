export function mapsUrl(platform: string, lat: number, lng: number, label?: string): string {
  const point = `${lat},${lng}`;
  const name = label ? encodeURIComponent(label) : '';

  if (platform === 'ios') {
    return `http://maps.apple.com/?ll=${point}${name ? `&q=${name}` : ''}`;
  }

  if (platform === 'android') {
    return `geo:${point}?q=${point}${name ? `(${name})` : ''}`;
  }

  return `https://www.google.com/maps/search/?api=1&query=${point}`;
}
