/**
 * Permits (punch list #292, revision 4): what a card says and where it points for the city a
 * permit is in. Every city's cards read its county's parcel record (a city added without one
 * says whose county keeps the land records and opens its appraisal district), and open the
 * city's own permit search and its county clerk. The cities are `_shared/permitCities.ts`. No React, no Supabase.
 */
import { permitCity } from '../../../supabase/functions/_shared/permitCities'
import { sameStreetAddress } from '../../../supabase/functions/_shared/permitParcels'
import { haversineMeters, TRAVEL_ROAD_WINDING_FACTOR, type LatLng } from '../jobTravelEstimate'
import { txCountyCadSearchUrl } from '../txCountyLookup'

const METERS_PER_MILE = 1609.344

/** "Bexar County", or "the county" for a city the list does not hold. */
export function countyWords(city: string | null | undefined): string {
  const c = permitCity(city)
  return c ? `${c.county} County` : 'the county'
}

/** Whether the county's parcel record is read for this city's Property line. */
export function cityReadsParcels(city: string | null | undefined): boolean {
  return permitCity(city)?.parcels === true
}

/** "Asking Bexar County…" */
export function askingCountyWords(city: string | null | undefined): string {
  return `Asking ${countyWords(city)}…`
}

/** What the Property line says when it has no parcel: the county has none, or its record is not read here yet. */
export function noParcelWords(city: string | null | undefined, short = false): string {
  if (cityReadsParcels(city)) return short ? 'The county has no parcel under this street address.' : 'The county’s parcel layer has no row for this street address.'
  const county = countyWords(city)
  return county === 'the county' ? 'The county’s record is not read here yet.' : `${county}’s record is not read here yet. Its appraisal district has it.`
}

/** The four facts only Bexar's layer carries for every parcel: the DBA, the use, the year built and the built area. Elsewhere an empty one is left off the card, since the county's layer never had it. */
export function countyGivesBuildingFacts(city: string | null | undefined): boolean {
  return permitCity(city)?.county === 'Bexar'
}

/** The parcel's facts the cards read. */
type LotFacts = { building_sf: number | null; year_built: string | null; improvement_value: number | null; acres: number | null; situs?: string | null; matched_by?: 'point' | 'id'; county?: string | null }

function shortDollars(value: number): string {
  if (value >= 1_000_000) {
    const millions = value / 1_000_000
    return `$${millions >= 10 ? Math.round(millions) : Math.round(millions * 10) / 10}M`
  }
  if (value >= 1_000) return `$${Math.round(value / 1_000)}k`
  return `$${Math.round(value)}`
}

/** The skim card's line under the owner: what stands on the lot, and how big the lot is. */
export function lotWords(facts: LotFacts): string {
  const built = facts.building_sf
    ? `${Math.round(facts.building_sf).toLocaleString('en-US')} sq ft built${facts.year_built ? ` in ${facts.year_built}` : ''}`
    : facts.improvement_value
      ? `buildings on the roll at ${shortDollars(facts.improvement_value)}${facts.year_built ? `, built ${facts.year_built}` : ''}`
      : 'nothing built on the roll'
  return [built, facts.acres ? `${facts.acres} acres` : null, facts.matched_by === 'point' ? `read at the permit’s point${facts.county ? ` in ${facts.county} County` : ''}` : facts.county ? `in ${facts.county} County` : null].filter(Boolean).join(', ')
}

/**
 * The sheets' line on how the parcel relates to the permit, or null when there is nothing to say:
 * the city's own county matched the street address, or named a lot whose address is the permit's.
 * - Found under the permit's point, not its street address: it says so, and whose county it is
 *   when the point is over the county line.
 * - Found by the permit's own id or its address on a neighbouring county's layer: which county.
 * - Found by the permit's own id on a lot the county files under another address (a centre's lot,
 *   a campus), when the permit's `address` is given: the county's address for it.
 */
export function parcelPointWords(facts: Pick<LotFacts, 'situs' | 'matched_by' | 'county'>, address?: string | null): string | null {
  if (facts.matched_by !== 'point') {
    const inCounty = facts.county ? `This lot is in ${facts.county} County.` : null
    const called = facts.matched_by === 'id' && address && facts.situs && !sameStreetAddress(address, facts.situs) ? `The county calls this lot ${facts.situs}.` : null
    return inCounty || called ? [inCounty, called].filter(Boolean).join(' ') : null
  }
  const where = facts.situs ? ` The county calls it ${facts.situs}.` : ''
  if (facts.county) return `The permit’s point is in ${facts.county} County, so this is that county’s parcel there.${where}`
  return `The county has no parcel under this street address, so this is the parcel at the permit’s point.${where}`
}

/** The county appraisal district's property search, or null where the app knows none. */
export function appraisalDoor(city: string | null | undefined): string | null {
  const c = permitCity(city)
  if (!c) return null
  return txCountyCadSearchUrl(c.county) || null
}

/** The city's own permit search, a page a person fills in; null for a city the list does not hold. */
export function permitSearchDoor(city: string | null | undefined): string | null {
  return permitCity(city)?.permitSearch ?? null
}

/** The county clerk's deed search for a city, or null where no door is known. */
export function cityDeedsDoor(city: string | null | undefined): string | null {
  return permitCity(city)?.deeds ?? null
}

/** A city further from the office than this is one the office travels to on purpose. */
export const FAR_CITY_MILES = 50

/**
 * Whether the drive counts in a card's score for this city. In a city the office is in, a short
 * drive lifts a card and a long one sinks it. In a city the whole of which is a long drive, every
 * card would read "70 miles away" and sink alike, so the miles stay on the card and off the score.
 */
export function scoresMiles(city: string | null | undefined, office: LatLng | null): boolean {
  const c = permitCity(city)
  if (!c || !office) return true
  const miles = (haversineMeters(office, c.center) * TRAVEL_ROAD_WINDING_FACTOR) / METERS_PER_MILE
  return miles <= FAR_CITY_MILES
}

const LAST_CITY_KEY = 'permits.lastCity'

/** The city this browser last had on screen, when it is still one the pull reads. */
export function readLastCity(fallback: string): string {
  try {
    const saved = window.localStorage.getItem(LAST_CITY_KEY)
    return permitCity(saved)?.name ?? fallback
  } catch {
    return fallback
  }
}

export function writeLastCity(city: string): void {
  try {
    window.localStorage.setItem(LAST_CITY_KEY, city)
  } catch {
    // A browser that keeps nothing still shows the city for this sitting.
  }
}
