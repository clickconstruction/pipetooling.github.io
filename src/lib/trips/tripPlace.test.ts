import { describe, expect, it } from 'vitest'
import { milesFromShop, placeOfDay, placeOfPunch, siteIsFar, tripsLookShows, TRIP_FAR_MILES_DEFAULT } from './tripPlace'

// Made-up points: a site on a marsh road, a motel about eleven miles off, and a shop about a thousand miles away.
const site = { lat: 35.0, lng: -76.6 }
const atSite = { lat: 35.004, lng: -76.603 }
const motel = { lat: 35.11, lng: -76.75 }
const shop = { lat: 30.3, lng: -97.7 }

describe('one punch against the site', () => {
  it('is At the site when a place read from the phone is within two miles', () => {
    expect(placeOfPunch([atSite], site)).toBe('site')
  })

  it('is Elsewhere when the phone gave a place and none is the site', () => {
    expect(placeOfPunch([motel], site)).toBe('elsewhere')
    expect(placeOfPunch([shop, motel], site)).toBe('elsewhere')
  })

  it('is At the site when any of its places is: clock in at the motel, arrival at the site', () => {
    expect(placeOfPunch([motel, atSite, null], site)).toBe('site')
  })

  it('is no place with no place at all, as an imported or scheduled row has', () => {
    expect(placeOfPunch([], site)).toBe('none')
    expect(placeOfPunch([null, undefined], site)).toBe('none')
    expect(placeOfPunch([{ lat: Number.NaN, lng: -76.6 }], site)).toBe('none')
  })

  it('takes a place guessed from the network as the site when it is in the area', () => {
    expect(placeOfPunch([{ ...motel, rough: true }], site)).toBe('site')
  })

  it('reads a guessed place far from the site as no place, since it proves nothing either way', () => {
    expect(placeOfPunch([{ ...shop, rough: true }], site)).toBe('none')
  })

  it('cannot check any place when the site has no point', () => {
    expect(placeOfPunch([atSite], null)).toBe('none')
  })

  it('takes a wider or tighter reach when given one', () => {
    expect(placeOfPunch([motel], site, { siteRadiusMeters: 30_000 })).toBe('site')
    expect(placeOfPunch([atSite], site, { siteRadiusMeters: 100 })).toBe('elsewhere')
  })
})

describe('a day of punches', () => {
  it('is At the site when any punch was, else Elsewhere when any carried a place, else no place', () => {
    expect(placeOfDay(['none', 'elsewhere', 'site'])).toBe('site')
    expect(placeOfDay(['none', 'elsewhere'])).toBe('elsewhere')
    expect(placeOfDay(['none', 'none'])).toBe('none')
    expect(placeOfDay([])).toBe('none')
  })
})

describe('far from the shop', () => {
  it('measures the shop to the site in miles, and nothing when a point is unknown', () => {
    const miles = milesFromShop(shop, site)
    expect(miles).not.toBeNull()
    expect(Math.round(miles ?? 0)).toBeGreaterThan(1000)
    expect(milesFromShop(null, site)).toBeNull()
    expect(milesFromShop(shop, null)).toBeNull()
  })

  it('calls a site far at 150 miles, the default, or at the miles it is given', () => {
    expect(TRIP_FAR_MILES_DEFAULT).toBe(150)
    expect(siteIsFar(149.9)).toBe(false)
    expect(siteIsFar(150)).toBe(true)
    expect(siteIsFar(80, 60)).toBe(true)
    expect(siteIsFar(null)).toBe(false)
  })

  it('shows the Trips look on a site with a trip, a far site, or a site a person turned trips on for', () => {
    expect(tripsLookShows({ tripCount: 0, miles: 12 })).toBe(false)
    expect(tripsLookShows({ tripCount: 0, miles: null })).toBe(false)
    expect(tripsLookShows({ tripCount: 1, miles: 12 })).toBe(true)
    expect(tripsLookShows({ tripCount: 0, miles: 1180 })).toBe(true)
    expect(tripsLookShows({ tripCount: 0, miles: 12, turnedOn: true })).toBe(true)
    expect(tripsLookShows({ tripCount: 0, miles: 100, farMiles: 90 })).toBe(true)
  })
})
