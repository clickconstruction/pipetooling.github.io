/**
 * US Census Bureau Geocoder (free, no API key, US addresses only).
 * https://geocoding.geo.census.gov/geocoder/
 *
 * Third-tier fallback after Nominatim and Google. Conservative matcher: wants a
 * structured street address (street + city/state or ZIP) and declines rather
 * than guessing, so `not_found` here is common and non-fatal.
 */
export type CensusGeocodeResult =
  | { ok: true; lat: number; lng: number }
  | { ok: false; error: 'not_found' | 'census_upstream'; detail?: string }

type CensusResponseJson = {
  result?: {
    addressMatches?: { coordinates?: { x?: number; y?: number } }[]
  }
}

export async function geocodeWithCensus(address: string): Promise<CensusGeocodeResult> {
  const trimmed = address.trim()
  if (trimmed.length < 1) {
    return { ok: false, error: 'not_found' }
  }
  const url = `https://geocoding.geo.census.gov/geocoder/locations/onelineaddress?address=${encodeURIComponent(trimmed)}&benchmark=Public_AR_Current&format=json`
  let r: Response
  try {
    r = await fetch(url)
  } catch {
    return { ok: false, error: 'census_upstream', detail: 'US Census geocoder request failed' }
  }
  if (!r.ok) {
    return { ok: false, error: 'census_upstream', detail: `HTTP ${r.status}` }
  }
  let j: CensusResponseJson
  try {
    j = (await r.json()) as CensusResponseJson
  } catch {
    return { ok: false, error: 'census_upstream', detail: 'Response was not valid JSON' }
  }
  const matches = j.result?.addressMatches
  if (Array.isArray(matches) && matches.length > 0) {
    const lng = matches[0]?.coordinates?.x
    const lat = matches[0]?.coordinates?.y
    if (typeof lat === 'number' && typeof lng === 'number' && Number.isFinite(lat) && Number.isFinite(lng)) {
      return { ok: true, lat, lng }
    }
  }
  return { ok: false, error: 'not_found' }
}
