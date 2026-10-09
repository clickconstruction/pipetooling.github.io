/**
 * The box a geocoded point must fall in to be kept (v2.4975). The point that taught it: a property
 * record's twelve-character address cached on 2026-09-14 at 26.7813, 91.9274, in Assam, India, so
 * the record had no county and no court. The shared geocoders now call that a miss.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { US_POINT_BOX, inUsPointBox, refusePointOutsideUs } from '../../../supabase/functions/_shared/usPointBox'
import { geocodeWithGoogle } from '../../../supabase/functions/_shared/googleGeocode'
import { geocodeWithCensus } from '../../../supabase/functions/_shared/censusGeocode'

const ASSAM = { lat: 26.7813, lng: 91.9274 }
const SEGUIN = { lat: 29.5688, lng: -97.9647 }

describe('inUsPointBox', () => {
  it('refuses the point a property record was cached at on 2026-09-14', () => {
    expect(inUsPointBox(ASSAM.lat, ASSAM.lng)).toBe(false)
  })

  it('keeps a Texas point, and its sign-flipped twin is the one refused', () => {
    expect(inUsPointBox(SEGUIN.lat, SEGUIN.lng)).toBe(true)
    expect(inUsPointBox(SEGUIN.lat, -SEGUIN.lng)).toBe(false)
  })

  it('keeps the corners of the lower 48 and refuses Alaska, Hawaii and the other points in the cache', () => {
    expect(inUsPointBox(24.5551, -81.78)).toBe(true) // Key West
    expect(inUsPointBox(47.6062, -122.3321)).toBe(true) // Seattle
    expect(inUsPointBox(44.8095, -66.9513)).toBe(true) // Lubec, Maine
    expect(inUsPointBox(61.2181, -149.9003)).toBe(false) // Anchorage
    expect(inUsPointBox(21.3069, -157.8583)).toBe(false) // Honolulu
    expect(inUsPointBox(-37.8461, 144.984)).toBe(false)
    expect(inUsPointBox(63.926, -22.6867)).toBe(false)
  })

  it('is closed on its edges and refuses what is not a number', () => {
    expect(inUsPointBox(US_POINT_BOX.south, US_POINT_BOX.west)).toBe(true)
    expect(inUsPointBox(US_POINT_BOX.north, US_POINT_BOX.east)).toBe(true)
    expect(inUsPointBox(Number.NaN, SEGUIN.lng)).toBe(false)
    expect(inUsPointBox(SEGUIN.lat, Number.POSITIVE_INFINITY)).toBe(false)
  })
})

describe('refusePointOutsideUs', () => {
  afterEach(() => vi.restoreAllMocks())

  it('logs the raw answer and returns the line the miss carries', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const detail = refusePointOutsideUs('google', '1 Main St', ASSAM.lat, ASSAM.lng, { formatted_address: 'Somewhere, Assam, India' })
    expect(detail).toBe('Google placed it outside the lower 48 (26.7813, 91.9274)')
    expect(warn).toHaveBeenCalledTimes(1)
    expect(warn.mock.calls[0]!.join(' ')).toContain('Somewhere, Assam, India')
  })
})

describe('the shared geocoders call a point outside the box a miss', () => {
  const realFetch = globalThis.fetch
  afterEach(() => {
    globalThis.fetch = realFetch
    vi.restoreAllMocks()
  })
  function answerWith(body: unknown) {
    globalThis.fetch = (() => Promise.resolve(new Response(JSON.stringify(body), { status: 200 }))) as typeof fetch
  }

  it('Google', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    answerWith({ status: 'OK', results: [{ geometry: { location: ASSAM }, address_components: [] }] })
    expect(await geocodeWithGoogle('1 Main St', 'test-key')).toEqual({ ok: false, error: 'not_found', detail: 'Google placed it outside the lower 48 (26.7813, 91.9274)' })
    answerWith({ status: 'OK', results: [{ geometry: { location: SEGUIN }, address_components: [{ long_name: 'Guadalupe County', types: ['administrative_area_level_2'] }] }] })
    expect(await geocodeWithGoogle('123 Main St, Seguin, TX 78155', 'test-key')).toEqual({ ok: true, ...SEGUIN, county: 'Guadalupe' })
  })

  it('the US Census', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    answerWith({ result: { addressMatches: [{ coordinates: { x: -157.8583, y: 21.3069 } }] } })
    expect(await geocodeWithCensus('1 Main St, Honolulu, HI')).toEqual({ ok: false, error: 'not_found', detail: 'The Census placed it outside the lower 48 (21.3069, -157.8583)' })
    answerWith({ result: { addressMatches: [{ coordinates: { x: SEGUIN.lng, y: SEGUIN.lat } }] } })
    expect(await geocodeWithCensus('123 Main St, Seguin, TX 78155')).toEqual({ ok: true, ...SEGUIN })
  })
})
