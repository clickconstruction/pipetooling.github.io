import { describe, expect, it } from 'vitest'
import { fromTexasSouthCentralFeet, pointFromFeedCoords } from '../../../supabase/functions/_shared/permitCoords'

describe('fromTexasSouthCentralFeet', () => {
  it('maps the projection origin back to its own longitude and latitude', () => {
    // EPSG:2278: the false easting and northing sit on 99° W, 27° 50′ N.
    const p = fromTexasSouthCentralFeet(1_968_500, 13_123_333.333)
    expect(p).not.toBeNull()
    expect(p!.lng).toBeCloseTo(-99, 6)
    expect(p!.lat).toBeCloseTo(27 + 50 / 60, 6)
  })

  it('lands a point east and north of the origin inside Bexar County', () => {
    // Made-up feet near the middle of the zone: about 98.5° W, 29.5° N.
    const p = fromTexasSouthCentralFeet(2_128_000, 13_730_000)
    expect(p).not.toBeNull()
    expect(p!.lng).toBeGreaterThan(-98.6)
    expect(p!.lng).toBeLessThan(-98.4)
    expect(p!.lat).toBeGreaterThan(29.4)
    expect(p!.lat).toBeLessThan(29.6)
  })

  it('refuses a pair that is not a number', () => {
    expect(fromTexasSouthCentralFeet(Number.NaN, 1)).toBeNull()
  })
})

describe('pointFromFeedCoords', () => {
  it('takes a longitude and latitude pair as it is, as strings or numbers', () => {
    expect(pointFromFeedCoords('-98.5', '29.4')).toEqual({ lat: 29.4, lng: -98.5 })
    expect(pointFromFeedCoords(-98.5, 29.4)).toEqual({ lat: 29.4, lng: -98.5 })
  })

  it('converts State Plane feet when the pair is too big to be degrees', () => {
    const p = pointFromFeedCoords('2128000', '13730000')
    expect(p).not.toBeNull()
    expect(p!.lat).toBeCloseTo(29.5, 0)
  })

  it('returns null for blanks, zeros and points outside Texas', () => {
    expect(pointFromFeedCoords(null, null)).toBeNull()
    expect(pointFromFeedCoords('', '')).toBeNull()
    expect(pointFromFeedCoords('0', '0')).toBeNull()
    expect(pointFromFeedCoords('-122.4', '37.8')).toBeNull()
  })
})
