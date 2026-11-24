/**
 * The memory of an address no map service could place (punch list #408): how long a miss stands,
 * and which answers are worth keeping. The kernel lives with the edge functions that write the
 * miss; the screens import the same file.
 */
import { describe, expect, it } from 'vitest'
import {
  GEOCODE_MISS_DETAIL_MAX,
  GEOCODE_MISS_STANDS_DAYS,
  geocodeMissAsksAgainAt,
  geocodeMissDetail,
  geocodeMissStands,
  geocodeServiceSaid,
  isSettledGeocodeMiss,
  rememberedGeocodeFailure,
  standingGeocodeMisses,
  type GeocodeMissRow,
} from '../../../supabase/functions/_shared/geocodeMissMemory'

const NOW = new Date('2026-11-24T15:00:00Z')
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 86_400_000).toISOString()
const miss = (key: string, checked_at: string, detail: string | null = null): GeocodeMissRow => ({ address_normalized: key, error_code: 'not_found', detail, checked_at })

describe('how long a miss stands', () => {
  it('is 30 days, the plan\'s pick on the owner\'s second call', () => {
    expect(GEOCODE_MISS_STANDS_DAYS).toBe(30)
  })

  it('stands the day it was checked and the day before it runs out', () => {
    expect(geocodeMissStands(NOW.toISOString(), NOW)).toBe(true)
    expect(geocodeMissStands(daysAgo(GEOCODE_MISS_STANDS_DAYS - 1), NOW)).toBe(true)
  })

  it('is asked again once the days are up', () => {
    expect(geocodeMissStands(daysAgo(GEOCODE_MISS_STANDS_DAYS), NOW)).toBe(false)
    expect(geocodeMissStands(daysAgo(GEOCODE_MISS_STANDS_DAYS + 5), NOW)).toBe(false)
  })

  it('does not stand on a day nobody can read', () => {
    expect(geocodeMissStands(null, NOW)).toBe(false)
    expect(geocodeMissStands(undefined, NOW)).toBe(false)
    expect(geocodeMissStands('not a day', NOW)).toBe(false)
  })

  it('names the day the app asks again by itself', () => {
    expect(geocodeMissAsksAgainAt('2026-11-20T12:00:00Z')?.toISOString()).toBe('2026-12-20T12:00:00.000Z')
    expect(geocodeMissAsksAgainAt('nope')).toBeNull()
  })

  it('keeps the standing rows by key and drops the stale ones', () => {
    const got = standingGeocodeMisses([miss('zz made up corner', daysAgo(2)), miss('zz old made up corner', daysAgo(45))], NOW)
    expect([...got.keys()]).toEqual(['zz made up corner'])
  })
})

describe('which answers are kept', () => {
  it('an address Google and the Census both answered and neither found', () => {
    expect(isSettledGeocodeMiss({ google: 'not_found', census: 'not_found' })).toBe(true)
  })

  it('nothing when Google or the Census was down, refused the key or was over its limit', () => {
    expect(isSettledGeocodeMiss({ google: 'failed', census: 'not_found' })).toBe(false)
    expect(isSettledGeocodeMiss({ google: 'not_found', census: 'failed' })).toBe(false)
    expect(isSettledGeocodeMiss({ google: 'failed', census: 'failed' })).toBe(false)
  })

  it('nothing when a service was never asked: Google with no key set', () => {
    expect(isSettledGeocodeMiss({ google: 'not_asked', census: 'not_found' })).toBe(false)
  })

  it('reads a geocoder\'s own not_found as not found and every other code as a failure', () => {
    expect(geocodeServiceSaid('not_found')).toBe('not_found')
    for (const code of ['upstream', 'invalid_coordinates', 'google_denied', 'google_over_query', 'google_invalid', 'google_unknown', 'google_no_results', 'google_upstream', 'census_upstream']) {
      expect(geocodeServiceSaid(code)).toBe('failed')
    }
  })
})

describe('what is kept and what is answered', () => {
  it('keeps the services\' words single-spaced, and null when there are none', () => {
    expect(geocodeMissDetail('  No match from OpenStreetMap or Google;\n no match from US Census ')).toBe('No match from OpenStreetMap or Google; no match from US Census')
    expect(geocodeMissDetail('   ')).toBeNull()
    expect(geocodeMissDetail(undefined)).toBeNull()
  })

  it('cuts long words under the table\'s cap', () => {
    const kept = geocodeMissDetail('x'.repeat(5000))!
    expect(kept.length).toBe(GEOCODE_MISS_DETAIL_MAX)
    expect(kept.endsWith('…')).toBe(true)
  })

  it('answers a remembered miss in the shape of a fresh one, and says nothing was asked', () => {
    expect(rememberedGeocodeFailure(miss('zz made up corner', '2026-11-20T12:00:00Z', 'No match'))).toEqual({
      address_normalized: 'zz made up corner',
      error_code: 'not_found',
      detail: 'No match',
      remembered: true,
      checked_at: '2026-11-20T12:00:00Z',
    })
    expect('detail' in rememberedGeocodeFailure(miss('zz made up corner', '2026-11-20T12:00:00Z'))).toBe(false)
  })
})
