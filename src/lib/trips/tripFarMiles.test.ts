/**
 * How far a site is before it is a trip from home, as one setting (v2.7888): what a stored value means, what a
 * typed one means, and the words. The rule that uses the distance is `siteIsFar` in `tripPlace.ts`.
 */
import { describe, expect, it } from 'vitest'
import { TRIP_FAR_MILES_HELP, TRIP_FAR_MILES_KEY, TRIP_FAR_MILES_MAX, TRIP_FAR_MILES_MIN, tripFarMilesLine, tripFarMilesOf, tripFarMilesSavedWords, tripFarMilesTyped } from './tripFarMiles'
import { siteIsFar, TRIP_FAR_MILES_DEFAULT, tripsLookShows } from './tripPlace'
import { tripPhoneView } from './tripPhone'

describe('tripFarMilesOf', () => {
  it('reads a whole number of miles in range, as a number or as the text a numeric column comes back as', () => {
    expect(tripFarMilesOf(200)).toBe(200)
    expect(tripFarMilesOf('90')).toBe(90)
    expect(tripFarMilesOf('90.00')).toBe(90)
    expect(tripFarMilesOf(TRIP_FAR_MILES_MIN)).toBe(25)
    expect(tripFarMilesOf(TRIP_FAR_MILES_MAX)).toBe(1000)
  })
  it('reads the default when there is no row, and for anything that is not a distance', () => {
    expect(TRIP_FAR_MILES_DEFAULT).toBe(150)
    for (const v of [null, undefined, '', ' ', 'far', 0, 24, 1001, -150, 150.5, '150.5', NaN, Infinity, true, {}, []]) expect(tripFarMilesOf(v), String(v)).toBe(150)
  })
  it('names its row', () => {
    expect(TRIP_FAR_MILES_KEY).toBe('trips_far_miles_v1')
  })
})

describe('tripFarMilesTyped', () => {
  it('takes whole miles in range and nothing else', () => {
    expect(tripFarMilesTyped('150')).toBe(150)
    expect(tripFarMilesTyped(' 75 ')).toBe(75)
    for (const t of ['', ' ', '24', '1001', '150.5', '1e2', '-150', 'far', '150 miles']) expect(tripFarMilesTyped(t), t).toBeNull()
  })
})

describe('the words', () => {
  it('says the distance on the folded card and in the toast, and the range in the help', () => {
    expect(tripFarMilesLine(150)).toBe('150 miles from the shop')
    expect(tripFarMilesSavedWords(90)).toBe('Saved. A site 90 miles or more from the shop is a trip from home.')
    expect(TRIP_FAR_MILES_HELP).toContain('Pick 25 to 1,000.')
  })
})

describe('the setting decides what far means, for the look and for the phone', () => {
  it('a site 100 miles out is far at 90 and near at the default', () => {
    expect(siteIsFar(100, tripFarMilesOf(90))).toBe(true)
    expect(siteIsFar(100, tripFarMilesOf(null))).toBe(false)
    expect(tripsLookShows({ tripCount: 0, miles: 100, farMiles: 90 })).toBe(true)
    expect(tripsLookShows({ tripCount: 0, miles: 100 })).toBe(false)
    // A site with a trip shows its look at any distance, whatever the setting.
    expect(tripsLookShows({ tripCount: 1, miles: 5, farMiles: 1000 })).toBe(true)
  })
  it('the phone asks on a job 100 miles out at 90, and says nothing at the default', () => {
    const state = { ok: true, developmentId: 'd1', developmentName: 'Heron Point', hasTrips: false, mine: null, open: [], today: '2026-11-18' } as never
    expect(tripPhoneView({ state, miles: 100, justClockIn: false, clockedIn: true, farMiles: 90 }).kind).not.toBe('none')
    expect(tripPhoneView({ state, miles: 100, justClockIn: false, clockedIn: true }).kind).toBe('none')
  })
})
