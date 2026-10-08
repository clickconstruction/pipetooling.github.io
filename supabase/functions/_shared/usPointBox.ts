/**
 * The frame a geocoded point must fall in to be kept (v2.4975): a generous box around the lower 48.
 * Every address the app pins is a job, a bid or a property record in or near Texas, so a point
 * outside it is a geocoder's wrong answer — a short or ambiguous address placed in another country —
 * and is a miss: never written to `address_geocodes`, logged with the raw answer, asked again on the
 * next lookup. A cached point outside it reads as no point, so the next lookup (the precinct night's
 * included) asks again and a good answer replaces it. Pure: no Deno or network, so the app's tests import it.
 */
export const US_POINT_BOX = { south: 24, north: 50, west: -125, east: -66 } as const

export function inUsPointBox(lat: number, lng: number): boolean {
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= US_POINT_BOX.south &&
    lat <= US_POINT_BOX.north &&
    lng >= US_POINT_BOX.west &&
    lng <= US_POINT_BOX.east
  )
}

const RAW_MAX = 2000

/**
 * A point refused for falling outside the box: logs the geocoder's raw answer and returns the
 * detail the miss carries (*Google placed it outside the lower 48 (26.7813, 91.9274)*).
 */
export function refusePointOutsideUs(source: 'google' | 'census' | 'nominatim', address: string, lat: number, lng: number, raw?: unknown): string {
  const name = source === 'google' ? 'Google' : source === 'census' ? 'The Census' : 'OpenStreetMap'
  const detail = `${name} placed it outside the lower 48 (${lat.toFixed(4)}, ${lng.toFixed(4)})`
  let rawText = ''
  try {
    rawText = JSON.stringify(raw ?? null)
  } catch {
    rawText = String(raw)
  }
  if (rawText.length > RAW_MAX) rawText = rawText.slice(0, RAW_MAX) + '…'
  console.warn(`geocode: ${detail}; a miss, not stored`, JSON.stringify({ address }), rawText)
  return detail
}
