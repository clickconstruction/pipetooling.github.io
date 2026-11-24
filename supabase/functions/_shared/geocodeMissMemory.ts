/**
 * The memory of an address no map service could place (punch list #408). Pure: no database, no network.
 *
 * `address_geocodes` keeps a point, so it cannot hold an address nobody placed, and every screen that
 * listed such a record asked every map service again on every open. A miss is now
 * kept in `address_geocode_misses` with the day it was checked. `geocode-address-batch` and
 * `geocode-one` read it before they ask and write it when Google and the Census both said *not found*; the screens
 * read it beside the saved points and send only an address that is in neither. This file is the rule
 * both sides share, so the edge functions and `src` import the same one.
 */

/**
 * How many days a miss stands before the app asks the map services again by itself. The owner's
 * second call on punch list #408; the plan's pick is 30. This is the one place the number lives.
 */
export const GEOCODE_MISS_STANDS_DAYS = 30

const DAY_MS = 86_400_000

/** One row of `address_geocode_misses`. `checked_at` is the server's clock, stamped on every write. */
export type GeocodeMissRow = {
  address_normalized: string
  error_code: string
  detail: string | null
  checked_at: string
}

/**
 * What one map service said about one address. `failed` is every answer that is not a plain *not
 * found*: the service was down, refused the key, was over its limit or sent something unreadable.
 */
export type GeocodeServiceSaid = 'not_found' | 'failed' | 'not_asked'

export type GeocodeServicesSaid = { google: GeocodeServiceSaid; census: GeocodeServiceSaid }

/**
 * True when Google and the Census each answered and neither found the address: the case worth
 * remembering. Either of them down, refused, over its limit or never asked leaves the address to be
 * asked again on the next open, so an outage cannot mark good addresses for weeks.
 *
 * These two are the only services asked (punch list #436). OpenStreetMap's lookup was asked first until
 * then, and was never part of the rule after v2.8484: it turned every call from the functions away.
 */
export function isSettledGeocodeMiss(said: GeocodeServicesSaid): boolean {
  return said.google === 'not_found' && said.census === 'not_found'
}

/** A geocoder's error code as one of the three words: its own `not_found`, else `failed`. */
export function geocodeServiceSaid(errorCode: string): GeocodeServiceSaid {
  return errorCode === 'not_found' ? 'not_found' : 'failed'
}

/** True while a miss checked at `checkedAt` still stands at `now`. An unreadable day does not stand. */
export function geocodeMissStands(checkedAt: string | null | undefined, now: Date): boolean {
  const t = Date.parse(checkedAt ?? '')
  if (!Number.isFinite(t)) return false
  return now.getTime() - t < GEOCODE_MISS_STANDS_DAYS * DAY_MS
}

/** The day the app asks again by itself: the day checked plus the days a miss stands. Null for an unreadable day. */
export function geocodeMissAsksAgainAt(checkedAt: string | null | undefined): Date | null {
  const t = Date.parse(checkedAt ?? '')
  if (!Number.isFinite(t)) return null
  return new Date(t + GEOCODE_MISS_STANDS_DAYS * DAY_MS)
}

/** The misses that still stand at `now`, by address key. */
export function standingGeocodeMisses(rows: readonly GeocodeMissRow[], now: Date): Map<string, GeocodeMissRow> {
  const out = new Map<string, GeocodeMissRow>()
  for (const r of rows) {
    if (r && typeof r.address_normalized === 'string' && geocodeMissStands(r.checked_at, now)) out.set(r.address_normalized, r)
  }
  return out
}

/** The table's cap on `detail` is 2,000 characters; a kept detail is trimmed, single-spaced and well under it. */
export const GEOCODE_MISS_DETAIL_MAX = 1000

/** The services' words as the table keeps them: null when there are none. */
export function geocodeMissDetail(detail: string | null | undefined): string | null {
  const s = (detail ?? '').replace(/\s+/g, ' ').trim()
  if (!s) return null
  return s.length > GEOCODE_MISS_DETAIL_MAX ? `${s.slice(0, GEOCODE_MISS_DETAIL_MAX - 1)}…` : s
}

/**
 * The failure a function answers for a remembered miss, in the shape it already answers a fresh one,
 * with two more fields: `remembered` says nothing was asked, and `checked_at` says when it last was.
 * A client that predates them reads the code and the detail as it always did. A fresh failure whose
 * miss was just kept carries `checked_at` too, without `remembered` (v2.8484): that is how a caller
 * tells a miss that was kept from one that was not.
 */
export function rememberedGeocodeFailure(row: GeocodeMissRow): {
  address_normalized: string
  error_code: string
  detail?: string
  remembered: true
  checked_at: string
} {
  return {
    address_normalized: row.address_normalized,
    error_code: row.error_code,
    ...(row.detail ? { detail: row.detail } : {}),
    remembered: true,
    checked_at: row.checked_at,
  }
}
