import type { ParcelRecord } from './txParcelRecord.ts'

/**
 * Does the map pin, and then the parcel under it, belong to the address a person
 * typed? (v2.6520)
 *
 * The property lookup geocodes an address and asks the Texas parcel roll which
 * parcel sits under the pin. Google answers a street it cannot find with a pin
 * for the part it could match — the city, the ZIP, the middle of a street —
 * flagged `partial_match`, with a `location_type` of APPROXIMATE or
 * GEOMETRIC_CENTER and no `street_number`. The roll then names whatever parcel
 * sits at that pin: on 2026-11-04 a made-up `123 ZZ Test Ln, Taylor, TX 76574`
 * came back lien-ready with a real downtown parcel's owner and legal
 * description. Two gates, both pure and shared with the client (re-exported
 * from `src/lib/customers/parcelPinMatch.ts`, tested there):
 *
 * - `geocodePinHold`: the pin must be a street-level match that carries the
 *   typed house number; anything less holds the lookup before the roll is asked.
 * - `parcelSitusHold`: when the roll gives the parcel's own address (its situs),
 *   it must name the same lot — same house number, same street — or the parcel
 *   is held and nothing is filled.
 *
 * A hold carries a kind and a detail; `pinHoldWords` says it to a person.
 * Dependency-free (Deno and the app both import it).
 */

export type PinHoldKind = 'street_unknown' | 'number_unknown' | 'situs_mismatch'

export type PinHold = { kind: PinHoldKind; detail: string }

/** What the geocoder says about how well it placed the address. */
export type GeocodePrecision = {
  /** Google's `geometry.location_type`: ROOFTOP, RANGE_INTERPOLATED, GEOMETRIC_CENTER or APPROXIMATE. */
  locationType: string
  /** Google's `partial_match`: the answer is for part of the address only. */
  partialMatch: boolean
  /** The result's `types` (street_address, premise, subpremise, route, locality, postal_code, …). */
  types: readonly string[]
  /** The `street_number` component, '' when the result has none. */
  streetNumber: string
}

const STREET_LEVEL_TYPES: ReadonlySet<string> = new Set(['street_address', 'premise', 'subpremise'])

const DIRECTIONALS: ReadonlySet<string> = new Set(['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw', 'north', 'south', 'east', 'west'])

/** Suffix and road-system words that spell the same street two ways: "Gruene Rd" / "GRUENE ROAD", "FM 1234" / "F M 1234". */
const STREET_WORDS: ReadonlySet<string> = new Set([
  'st', 'street', 'ln', 'lane', 'dr', 'drive', 'rd', 'road', 'ave', 'avenue', 'blvd', 'boulevard', 'ct', 'court', 'cir', 'circle',
  'pl', 'place', 'trl', 'trail', 'pkwy', 'parkway', 'hwy', 'highway', 'way', 'loop', 'cv', 'cove', 'ter', 'terrace', 'pass', 'path',
  'run', 'xing', 'crossing', 'bnd', 'bend', 'holw', 'hollow', 'rdg', 'ridge', 'pt', 'point', 'sq', 'square', 'plz', 'plaza',
  'mdw', 'mdws', 'meadow', 'meadows', 'vly', 'valley', 'vw', 'view', 'hts', 'heights', 'est', 'estates', 'fwy', 'frwy', 'freeway',
  'expy', 'expressway', 'fm', 'f', 'm', 'cr', 'county', 'rr', 'ranch', 'rte', 'route', 'us', 'sh', 'ih', 'i', 'state', 'spur',
])

/** The unit words whose following token is a unit, not a street: "Ste 4", "Apt B", "# 12". */
const UNIT_WORDS = /(?:#|\b(?:apt|apartment|ste|suite|unit|bldg|building|lot|fl|floor|rm|room)\b)\s*\S+/gi

/** The house number that starts an address line ("123", "123a"), '' when the line starts with a word. */
export function typedHouseNumber(address: string): string {
  const first = (address.split(',')[0] ?? '').trim().toLowerCase()
  const m = first.match(/^(\d+[a-z]?)\b/)
  return m?.[1] ?? ''
}

/**
 * The street's own name, lower-case, without the house number, a unit, directionals
 * and suffix words: "123 N Main St" → "main", "415 Springtown Way" → "springtown",
 * "FM 1234" → "1234". '' when nothing is left (a bare number, an empty line).
 */
export function streetCore(line: string): string {
  const first = (line.split(',')[0] ?? '').trim().toLowerCase()
  const withoutNumber = first.replace(/^\d+[a-z]?\b\s*/, '')
  const withoutUnit = withoutNumber.replace(UNIT_WORDS, ' ')
  const tokens = withoutUnit
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t && !DIRECTIONALS.has(t) && !STREET_WORDS.has(t))
  return tokens.join(' ')
}

/**
 * Why the geocoder's pin is not a lot to ask the roll about, or null when it is.
 * The route case comes first: a street the map has but at a number it lacks is
 * usually also a partial match, and the house number is the thing to check.
 */
export function geocodePinHold(typedAddress: string, g: GeocodePrecision): PinHold | null {
  const locationType = g.locationType.trim().toUpperCase()
  const kinds = new Set(g.types)
  const streetLevel = [...STREET_LEVEL_TYPES].some((t) => kinds.has(t))
  const typedNumber = typedHouseNumber(typedAddress)
  const pinNumber = g.streetNumber.trim().toLowerCase()
  if (!streetLevel && kinds.has('route')) {
    return { kind: 'number_unknown', detail: typedNumber ? `the map has the street but no number ${typedNumber}` : 'the map has the street but the address has no house number' }
  }
  if (g.partialMatch) return { kind: 'street_unknown', detail: 'the map matched only part of the address' }
  if (locationType === 'APPROXIMATE') return { kind: 'street_unknown', detail: 'the pin is an area (a city or a ZIP), not a lot' }
  if (locationType === 'GEOMETRIC_CENTER' && !streetLevel) return { kind: 'street_unknown', detail: 'the pin is the middle of an area, not a lot' }
  if (typedNumber && pinNumber && pinNumber !== typedNumber) return { kind: 'number_unknown', detail: `the map placed number ${pinNumber}, not ${typedNumber}` }
  if (typedNumber && !pinNumber) return { kind: 'number_unknown', detail: 'the map placed the street without the house number' }
  return null
}

/**
 * Why the parcel under the pin is not the typed lot, or null when the roll's own
 * address for it (its situs) agrees or is blank. A blank situs is common on rural
 * parcels and says nothing either way; the pin gate carries those.
 */
export function parcelSitusHold(typedAddress: string, parcel: Pick<ParcelRecord, 'situsAddress'>): PinHold | null {
  const situs = parcel.situsAddress.trim()
  if (!situs) return null
  const typedNumber = typedHouseNumber(typedAddress)
  const situsNumber = typedHouseNumber(situs)
  if (typedNumber && situsNumber && typedNumber !== situsNumber) return { kind: 'situs_mismatch', detail: situs }
  const typedStreet = streetCore(typedAddress)
  const situsStreet = streetCore(situs)
  if (typedStreet && situsStreet && !typedStreet.includes(situsStreet) && !situsStreet.includes(typedStreet)) {
    return { kind: 'situs_mismatch', detail: situs }
  }
  return null
}

/** The hold said to a person, on the record panel and in the nightly's summary. `city` is the typed address's city, '' when unknown. */
export function pinHoldWords(hold: PinHold, city: string): string {
  const near = city.trim() ? ` near ${city.trim()}` : ''
  switch (hold.kind) {
    case 'street_unknown':
      return `The map has no street by that name${near}, so the roll was not asked. Check the street name, then look up again.`
    case 'number_unknown':
      return 'The map has that street but not that number, so the roll was not asked. Check the house number, then look up again.'
    case 'situs_mismatch':
      return `The parcel under the map pin is ${hold.detail}, not this address, so nothing was filled. Check the address, then look up again or paste the CAD page.`
  }
}
