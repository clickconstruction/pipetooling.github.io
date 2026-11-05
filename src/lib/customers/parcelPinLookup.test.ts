import { describe, expect, it } from 'vitest'
import { lookupParcelForAddress, normalizeAddressKey, type ParcelPinLookupDeps } from '../../../supabase/functions/_shared/parcelPinLookup'
import type { GoogleGeocodeResult } from '../../../supabase/functions/_shared/googleGeocode'
import type { ParcelRecord } from './propertyRecord'

/**
 * The lookup ladder both edge functions run (v2.6520), driven with recorded
 * answers: Google first, the cache and the Census as fallbacks, the parcel under
 * the pin, and the two holds — a pin Google could not put on the lot, a parcel
 * whose own address names another lot.
 */

const TAYLOR = '123 ZZ Test Ln, Taylor, TX 76574'

/** What the roll answered for the Taylor pin on 2026-11-04: a downtown parcel, not the typed street. */
const DOWNTOWN: ParcelRecord = {
  propId: 'R015989',
  ownerName: '313 MAIN INC',
  nameCare: '',
  legalDescription: 'S4790 - Taylor City Of',
  situsAddress: '313 MAIN ST, TAYLOR, TX 76574',
  mailingAddress: '1924 NEWNING AVE, AUSTIN, TX 78704',
  county: 'Williamson',
  source: 'Williamson Appraisal District',
  taxYear: '2026',
}
const LOT: ParcelRecord = { ...DOWNTOWN, propId: 'R1', ownerName: 'SMITH JOHN', legalDescription: 'LOT 5 BLK 2', situsAddress: '123 ZZ TEST LN, TAYLOR, TX 76574' }

type GoogleOk = Extract<GoogleGeocodeResult, { ok: true }>
function google(over: Partial<GoogleOk> = {}): GoogleGeocodeResult {
  return { ok: true, lat: 30.57, lng: -97.41, county: 'Williamson', locationType: 'ROOFTOP', partialMatch: false, types: ['street_address'], streetNumber: '123', ...over }
}

type Setup = {
  google?: ((display: string) => Promise<GoogleGeocodeResult>) | null
  cached?: { lat: number; lng: number } | null
  census?: boolean
  parcel?: ParcelRecord | null
  countyFromGoogleWhenNoParcel?: boolean
}

function make(s: Setup = {}): { deps: ParcelPinLookupDeps; log: string[] } {
  const log: string[] = []
  const deps: ParcelPinLookupDeps = {
    readCachedPoint: async (key) => {
      log.push(`cache read ${key}`)
      return s.cached ?? null
    },
    writeCachedPoint: async (key, lat, lng) => {
      log.push(`cache write ${key} ${lat},${lng}`)
    },
    geocodeGoogle:
      s.google === null
        ? null
        : s.google ??
          (async () => {
            log.push('google')
            return google()
          }),
    geocodeCensus: async () => {
      log.push('census')
      return s.census ? { ok: true, lat: 30.5, lng: -97.4 } : { ok: false, error: 'not_found' }
    },
    identify: async (lat, lng) => {
      log.push(`identify ${lat},${lng}`)
      return { parcel: s.parcel === undefined ? LOT : s.parcel }
    },
    ...(s.countyFromGoogleWhenNoParcel !== undefined ? { countyFromGoogleWhenNoParcel: s.countyFromGoogleWhenNoParcel } : {}),
  }
  return { deps, log }
}

describe('lookupParcelForAddress', () => {
  it('asks Google first, caches a street-level pin and names the parcel under it', async () => {
    const { deps, log } = make()
    const res = await lookupParcelForAddress(TAYLOR, deps)
    expect(res).toMatchObject({ ok: true, key: '123 zz test ln, taylor, tx 76574', pinSource: 'google', countyGeocoder: 'Williamson', parcel: LOT })
    expect('hold' in res).toBe(false)
    expect(log).toEqual(['google', 'cache write 123 zz test ln, taylor, tx 76574 30.57,-97.41', 'identify 30.57,-97.41'])
  })

  it('the Taylor case: a partial city pin holds the lookup before the roll is asked, and is not cached', async () => {
    const { deps, log } = make({
      google: async () => google({ locationType: 'APPROXIMATE', partialMatch: true, types: ['locality', 'political'], streetNumber: '' }),
    })
    const res = await lookupParcelForAddress(TAYLOR, deps)
    expect(res).toMatchObject({ ok: true, pinSource: 'google', countyGeocoder: 'Williamson', parcel: null, hold: { kind: 'street_unknown' } })
    expect(log).toEqual([])
  })

  it('holds a parcel whose own address names another lot and returns no parcel', async () => {
    const { deps, log } = make({ parcel: DOWNTOWN })
    const res = await lookupParcelForAddress(TAYLOR, deps)
    expect(res).toMatchObject({ ok: true, pinSource: 'google', parcel: null, hold: { kind: 'situs_mismatch', detail: '313 MAIN ST, TAYLOR, TX 76574' } })
    expect(log[log.length - 1]).toBe('identify 30.57,-97.41')
  })

  it('without a Google key the cache pin answers, then the Census', async () => {
    const cached = make({ google: null, cached: { lat: 30.6, lng: -97.5 } })
    expect(await lookupParcelForAddress(TAYLOR, cached.deps)).toMatchObject({ ok: true, pinSource: 'cache', countyGeocoder: '', parcel: LOT })
    expect(cached.log).toEqual(['cache read 123 zz test ln, taylor, tx 76574', 'identify 30.6,-97.5'])

    const census = make({ google: null, census: true })
    expect(await lookupParcelForAddress(TAYLOR, census.deps)).toMatchObject({ ok: true, pinSource: 'census', parcel: LOT })
    expect(census.log).toEqual(['cache read 123 zz test ln, taylor, tx 76574', 'census', 'identify 30.5,-97.4'])
  })

  it('when Google fails the cache answers, and the county rung asks Google again when the roll has nothing', async () => {
    let calls = 0
    const { deps, log } = make({
      google: async () => {
        calls += 1
        log.push(`google ${calls}`)
        return calls === 1 ? { ok: false, error: 'google_over_query' } : google({ county: 'Hays' })
      },
      cached: { lat: 30.6, lng: -97.5 },
      parcel: null,
      countyFromGoogleWhenNoParcel: true,
    })
    const res = await lookupParcelForAddress(TAYLOR, deps)
    expect(res).toMatchObject({ ok: true, pinSource: 'cache', countyGeocoder: 'Hays', parcel: null })
    expect(log).toEqual(['google 1', 'cache read 123 zz test ln, taylor, tx 76574', 'identify 30.6,-97.5', 'google 2'])
  })

  it('leaves the county rung alone when the caller does not ask for it (the nightly)', async () => {
    const { deps, log } = make({ google: async () => ({ ok: false, error: 'google_over_query' }), cached: { lat: 30.6, lng: -97.5 }, parcel: null })
    const res = await lookupParcelForAddress(TAYLOR, deps)
    expect(res).toMatchObject({ ok: true, pinSource: 'cache', countyGeocoder: '', parcel: null })
    expect(log.filter((l) => l.startsWith('google'))).toEqual([])
  })

  it('answers not_found with the detail when nothing places the address, and ignores a cached point outside the lower 48', async () => {
    const nothing = make({ google: async () => ({ ok: false, error: 'google_over_query', detail: 'quota' }) })
    expect(await lookupParcelForAddress(TAYLOR, nothing.deps)).toEqual({
      ok: false,
      key: '123 zz test ln, taylor, tx 76574',
      error: 'not_found',
      detail: 'Google: google_over_query (quota); no match from US Census',
    })
    const abroad = make({ google: null, cached: { lat: 19.4, lng: -99.1 } })
    expect(await lookupParcelForAddress(TAYLOR, abroad.deps)).toMatchObject({ ok: false, error: 'not_found' })
    expect(abroad.log).toEqual(['cache read 123 zz test ln, taylor, tx 76574', 'census'])
  })

  it('carries a parcel-service failure as parcelError beside an empty parcel', async () => {
    const { deps } = make()
    deps.identify = async () => ({ parcel: null, error: 'parcel service timed out' })
    expect(await lookupParcelForAddress(TAYLOR, deps)).toMatchObject({ ok: true, parcel: null, parcelError: 'parcel service timed out' })
  })

  it('normalizes the cache key the way the Map page writes it', () => {
    expect(normalizeAddressKey('  123   ZZ Test Ln, Taylor ')).toBe('123 zz test ln, taylor')
  })
})
