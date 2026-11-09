import { describe, expect, it } from 'vitest'
import { BASELINE_PRICE_FLOOR_USD, BASELINE_PRICE_FLOOR_WORDS, underBaselinePriceFloor } from './baselinePriceFloor'

describe("the baseline price floor (the owner's second call of 2026-11-09, punch list #234)", () => {
  it('is $2,500: a priced job under it is under the floor; the floor itself, a bigger job and an unknown price are not', () => {
    expect(BASELINE_PRICE_FLOOR_USD).toBe(2_500)
    expect(BASELINE_PRICE_FLOOR_WORDS).toBe('$2,500')
    expect(underBaselinePriceFloor(350)).toBe(true)
    expect(underBaselinePriceFloor('2499.99')).toBe(true)
    expect(underBaselinePriceFloor(2_500)).toBe(false)
    expect(underBaselinePriceFloor(56_343)).toBe(false)
    expect(underBaselinePriceFloor(null)).toBe(false)
    expect(underBaselinePriceFloor(0)).toBe(false)
    expect(underBaselinePriceFloor('')).toBe(false)
  })
})
