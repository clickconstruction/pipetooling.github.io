/**
 * Permits (punch list #292, revision 4): what a card says and where it points for the city a
 * permit is in. San Antonio's cards read Bexar County's parcel record; another city's cards say
 * whose county keeps the land records and open its appraisal district, its own permit search and
 * its county clerk. The cities are `_shared/permitCities.ts`. No React, no Supabase.
 */
import { permitCity } from '../../../supabase/functions/_shared/permitCities'
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
