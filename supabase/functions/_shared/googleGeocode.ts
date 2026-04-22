/**
 * Google Geocoding API (server-side only). Use GOOGLE_MAPS_API_KEY from Edge secrets.
 * https://developers.google.com/maps/documentation/geocoding/requests-geocoding
 */
export type GoogleGeocodeErrorCode =
  | 'not_found'
  | 'google_denied'
  | 'google_over_query'
  | 'google_invalid'
  | 'google_unknown'
  | 'google_upstream'
  | 'google_no_results'

type GeocodeResponseJson = {
  status: string
  error_message?: string
  results?: { geometry?: { location?: { lat?: number; lng?: number } } }[]
}

export type GoogleGeocodeResult =
  | { ok: true; lat: number; lng: number }
  | { ok: false; error: GoogleGeocodeErrorCode; detail?: string }

const DETAIL_MAX = 400

/** Strip long key-like substrings; bound length for logs/UI. */
export function sanitizeGoogleGeocodeErrorMessage(raw: string | undefined): string | undefined {
  if (!raw || typeof raw !== 'string') return undefined
  let s = raw
    .replace(/\bAIza[0-9A-Za-z_-]{30,}\b/g, '[API key redacted]')
    .replace(/key=[0-9A-Za-z._-]+/gi, 'key=[redacted]')
  s = s.replace(/\s+/g, ' ').trim()
  if (s.length > DETAIL_MAX) s = s.slice(0, DETAIL_MAX) + '…'
  return s || undefined
}

function withDetail(
  j: GeocodeResponseJson,
  error: GoogleGeocodeErrorCode
): { ok: false; error: GoogleGeocodeErrorCode; detail?: string } {
  const d = sanitizeGoogleGeocodeErrorMessage(j.error_message)
  return d ? { ok: false, error, detail: d } : { ok: false, error }
}

/**
 * @param address Display address string (same as passed to Nominatim)
 * @param apiKey GOOGLE_MAPS_API_KEY
 */
export async function geocodeWithGoogle(address: string, apiKey: string): Promise<GoogleGeocodeResult> {
  const trimmed = address.trim()
  if (trimmed.length < 1) {
    return { ok: false, error: 'google_invalid' }
  }
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(trimmed)}&key=${encodeURIComponent(apiKey)}`
  const r = await fetch(url)
  if (!r.ok) {
    return { ok: false, error: 'google_upstream', detail: `HTTP ${r.status}` }
  }
  let j: GeocodeResponseJson
  try {
    j = (await r.json()) as GeocodeResponseJson
  } catch {
    return { ok: false, error: 'google_unknown', detail: 'Response was not valid JSON' }
  }

  const status = j.status
  if (status === 'OK' && j.results && j.results.length > 0) {
    const loc = j.results[0]?.geometry?.location
    const lat = loc?.lat
    const lng = loc?.lng
    if (typeof lat === 'number' && typeof lng === 'number' && Number.isFinite(lat) && Number.isFinite(lng)) {
      return { ok: true, lat, lng }
    }
    return withDetail(j, 'google_no_results')
  }

  if (status === 'ZERO_RESULTS') {
    return withDetail(j, 'not_found')
  }
  if (status === 'REQUEST_DENIED') {
    return withDetail(j, 'google_denied')
  }
  if (status === 'OVER_QUERY_LIMIT') {
    return withDetail(j, 'google_over_query')
  }
  if (status === 'INVALID_REQUEST') {
    return withDetail(j, 'google_invalid')
  }
  if (status === 'UNKNOWN_ERROR') {
    return withDetail(j, 'google_unknown')
  }
  return withDetail(j, 'google_unknown')
}
