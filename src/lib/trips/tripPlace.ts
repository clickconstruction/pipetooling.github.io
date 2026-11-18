/**
 * Where a punch was, against the site (v2.7653, punch list #379, PR 1). The clock stamps a place on clock
 * in, on arrival and on clock out, each read from the phone or, when the phone would not say, guessed
 * from the network. A punch counts At the site only when a place it carries is the site. A row with no
 * place, an imported or scheduled one, says the day was paid. It does not say where.
 *
 * Also here: how far a site is from the shop, which decides whether the Trips look shows and whether the
 * phone asks. Pure.
 */
import { haversineMeters, type LatLng } from '../jobTravelEstimate'

/** What a punch, or a person's day of punches, says about the site. */
export type TripPlace = 'site' | 'elsewhere' | 'none'

/** A place a punch carries. `rough` is a place guessed from the network, good to a town at best. */
export type PunchPoint = { lat: number; lng: number; rough?: boolean }

const METERS_PER_MILE = 1609.344

/**
 * How near a place read from the phone must be to count as the site: two miles. A site is a tract, not a
 * door, and its point is one street address looked up once.
 */
export const TRIP_SITE_RADIUS_METERS = 2 * METERS_PER_MILE

/**
 * How near a place guessed from the network must be: twenty-five miles. It cannot tell the site from the
 * motel, only that the person was out there and not at home, on a day somebody painted At the site.
 */
export const TRIP_ROUGH_RADIUS_METERS = 25 * METERS_PER_MILE

/** How far a site is from the shop before the Trips look shows and the phone asks (the owner's call 1). */
export const TRIP_FAR_MILES_DEFAULT = 150

function isPoint(p: PunchPoint | null | undefined): p is PunchPoint {
  return !!p && Number.isFinite(p.lat) && Number.isFinite(p.lng) && p.lat >= -90 && p.lat <= 90 && p.lng >= -180 && p.lng <= 180
}

/**
 * One punch against the site. At the site when any place it carries is within reach of the site's point.
 * Elsewhere when the phone gave a place and none is the site. A place guessed from the network that is
 * not near the site proves nothing either way, so it reads as no place. With no point for the site no
 * place can be checked, so every punch reads as no place and the screen says the site has no point.
 */
export function placeOfPunch(points: ReadonlyArray<PunchPoint | null | undefined>, site: LatLng | null, opts: { siteRadiusMeters?: number; roughRadiusMeters?: number } = {}): TripPlace {
  const near = opts.siteRadiusMeters ?? TRIP_SITE_RADIUS_METERS
  const roughNear = opts.roughRadiusMeters ?? TRIP_ROUGH_RADIUS_METERS
  if (!site) return 'none'
  let sure = false
  for (const p of points) {
    if (!isPoint(p)) continue
    if (haversineMeters(p, site) <= (p.rough ? roughNear : near)) return 'site'
    if (!p.rough) sure = true
  }
  return sure ? 'elsewhere' : 'none'
}

/** A person's day from its punches: At the site when any punch was, else Elsewhere when any carried a place, else no place. */
export function placeOfDay(places: ReadonlyArray<TripPlace>): TripPlace {
  let out: TripPlace = 'none'
  for (const p of places) {
    if (p === 'site') return 'site'
    if (p === 'elsewhere') out = 'elsewhere'
  }
  return out
}

/** Straight-line miles between the shop and the site; null when either point is unknown. */
export function milesFromShop(shop: LatLng | null, site: LatLng | null): number | null {
  if (!shop || !site) return null
  return haversineMeters(shop, site) / METERS_PER_MILE
}

/** Whether a site is a trip from home. An unknown distance is not far: the look waits for a trip or a person's word. */
export function siteIsFar(miles: number | null, farMiles: number = TRIP_FAR_MILES_DEFAULT): boolean {
  return miles != null && Number.isFinite(miles) && miles >= farMiles
}

/**
 * Whether the Trips look shows on a site: it has a trip, or it is far from the shop, or a person turned
 * trips on for it. Every other development is unchanged.
 */
export function tripsLookShows(args: { tripCount: number; miles: number | null; farMiles?: number; turnedOn?: boolean | null }): boolean {
  return args.tripCount > 0 || args.turnedOn === true || siteIsFar(args.miles, args.farMiles)
}
