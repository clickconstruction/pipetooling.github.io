import { describe, expect, it } from 'vitest'
import {
  loadRecentMargins,
  normalizeMarginTarget,
  saveRecentMargins,
  unitPriceForTargetMargin,
  updateRecentMargins,
} from './applyMarginPricing'

describe('normalizeMarginTarget', () => {
  it('rounds and bounds to [1, 95]', () => {
    expect(normalizeMarginTarget('50')).toBe(50)
    expect(normalizeMarginTarget(49.6)).toBe(50)
    expect(normalizeMarginTarget(0)).toBeNull()
    expect(normalizeMarginTarget(96)).toBeNull()
    expect(normalizeMarginTarget('')).toBeNull()
    expect(normalizeMarginTarget('abc')).toBeNull()
  })
})

describe('unitPriceForTargetMargin', () => {
  it('prices to the target margin, whole dollars, per unit', () => {
    // $3,559.68 cost, 1 unit, 50% margin → $7,119
    expect(unitPriceForTargetMargin(3559.68, 1, 50)).toBe(7119)
    // The resulting margin lands on target: (7119 - 3559.68) / 7119 ≈ 50.0%
    const p = unitPriceForTargetMargin(3559.68, 1, 50)!
    expect(Math.abs((p - 3559.68) / p - 0.5)).toBeLessThan(0.001)
    // Multi-unit rows divide the row cost across units.
    expect(unitPriceForTargetMargin(1000, 4, 50)).toBe(500)
  })

  it('returns null for uncosted rows and bad inputs', () => {
    expect(unitPriceForTargetMargin(0, 1, 50)).toBeNull()
    expect(unitPriceForTargetMargin(-5, 1, 50)).toBeNull()
    expect(unitPriceForTargetMargin(100, 0, 50)).toBeNull()
    expect(unitPriceForTargetMargin(100, 1, 0)).toBeNull()
  })
})

describe('recent margins', () => {
  it('keeps the last three, most recent first, deduped', () => {
    expect(updateRecentMargins([45, 40, 35], 50)).toEqual([50, 45, 40])
    expect(updateRecentMargins([50, 45, 40], 45)).toEqual([45, 50, 40])
    expect(updateRecentMargins([], 50)).toEqual([50])
  })

  it('round-trips through storage and survives junk', () => {
    const store = new Map<string, string>()
    const storage = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
    }
    saveRecentMargins(storage, [50, 45, 40])
    expect(loadRecentMargins(storage)).toEqual([50, 45, 40])
    storage.setItem('bidPricingRecentMargins_v1', '{"not":"an array"}')
    expect(loadRecentMargins(storage)).toEqual([])
    storage.setItem('bidPricingRecentMargins_v1', '[50, "junk", 120, 40]')
    expect(loadRecentMargins(storage)).toEqual([50, 40])
  })
})
