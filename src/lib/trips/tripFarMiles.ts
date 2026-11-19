/**
 * How far a site is from the shop before it counts as a trip from home, as one setting (v2.7888, punch list #379,
 * the owner's call 1: *150 miles from the shop, one setting*). The Trips look shows on a development that far away,
 * and the phone asks about a trip on a job there. A site that has a trip shows its look at any distance, and the
 * Trips line's *none yet · add one* on a near site is how a person turns trips on for it.
 *
 * One row of `app_settings` (`trips_far_miles_v1`, `value_num`), read by every signed-in user and set by a dev.
 * No row, or a number outside the range, reads the default, so the app behaves as it did before the setting.
 * Pure: the read and the save are in `tripsIo.ts`.
 */
import { TRIP_FAR_MILES_DEFAULT } from './tripPlace'

export const TRIP_FAR_MILES_KEY = 'trips_far_miles_v1'

/** The setting's range, in whole miles. Below 25 the shop's own town reads as a trip; past 1,000 no site ever would. */
export const TRIP_FAR_MILES_MIN = 25
export const TRIP_FAR_MILES_MAX = 1000

function wholeMiles(v: unknown): number | null {
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN
  return Number.isInteger(n) && n >= TRIP_FAR_MILES_MIN && n <= TRIP_FAR_MILES_MAX ? n : null
}

/** The distance a stored value means: a whole number of miles in range, else the default. */
export function tripFarMilesOf(value: unknown): number {
  return wholeMiles(value) ?? TRIP_FAR_MILES_DEFAULT
}

/** What a person typed, as miles: null while it is not a whole number in range. */
export function tripFarMilesTyped(text: string): number | null {
  return /^\s*\d+\s*$/.test(text) ? wholeMiles(Number(text)) : null
}

/** The folded card's line: *150 miles from the shop*. */
export function tripFarMilesLine(miles: number): string {
  return `${miles} miles from the shop`
}

/** What the saved toast says. */
export function tripFarMilesSavedWords(miles: number): string {
  return `Saved. A site ${miles} miles or more from the shop is a trip from home.`
}

export const TRIP_FAR_MILES_LABEL = 'Miles from the shop'
export const TRIP_FAR_MILES_HELP = `The Trips look shows on a development this far from the shop, and the phone asks about a trip on a job there. A site that already has a trip shows its look at any distance. Pick ${TRIP_FAR_MILES_MIN} to ${TRIP_FAR_MILES_MAX.toLocaleString('en-US')}.`
export const TRIP_FAR_MILES_NEAR_NOTE = 'A nearer site can have trips too. On its development’s page, the Trips line reads none yet · add one.'
