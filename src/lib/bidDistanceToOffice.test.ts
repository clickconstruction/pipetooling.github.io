import { describe, expect, it } from 'vitest'
import { estimateDrivingMiles, formatMilesForInput, milesFromMeters } from './bidDistanceToOffice'

describe('milesFromMeters', () => {
  it('converts meters to miles', () => {
    expect(milesFromMeters(1609.344)).toBeCloseTo(1, 6)
    expect(milesFromMeters(0)).toBe(0)
  })
})

describe('estimateDrivingMiles', () => {
  it('applies the road-winding factor to the straight-line distance', () => {
    // San Antonio → Austin is ~73 straight-line miles; ×1.3 ≈ 95.
    const sa = { lat: 29.4241, lng: -98.4936 }
    const austin = { lat: 30.2672, lng: -97.7431 }
    const miles = estimateDrivingMiles(sa, austin)
    expect(miles).toBeGreaterThan(85)
    expect(miles).toBeLessThan(105)
  })

  it('is zero for the same point', () => {
    const p = { lat: 29.5, lng: -98.5 }
    expect(estimateDrivingMiles(p, p)).toBe(0)
  })
})

describe('formatMilesForInput', () => {
  it('rounds to one decimal, trimming trailing .0', () => {
    expect(formatMilesForInput(37.44)).toBe('37.4')
    expect(formatMilesForInput(37.96)).toBe('38')
    expect(formatMilesForInput(0)).toBe('0')
  })

  it('returns empty for invalid values', () => {
    expect(formatMilesForInput(Number.NaN)).toBe('')
    expect(formatMilesForInput(-3)).toBe('')
  })
})
