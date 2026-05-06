import { describe, expect, it } from 'vitest'
import { computeUnitSellingPriceFromMarkup } from './unitPriceFromMarkupOnCost'

describe('computeUnitSellingPriceFromMarkup', () => {
  it('markup zero returns rounded unit cost', () => {
    expect(computeUnitSellingPriceFromMarkup(100, 0)).toBe(100)
    expect(computeUnitSellingPriceFromMarkup(33.336, 0)).toBe(33.34)
  })

  it('50% markup on 100 yields 150', () => {
    expect(computeUnitSellingPriceFromMarkup(100, 50)).toBe(150)
  })

  it('rejects negative margin', () => {
    expect(() => computeUnitSellingPriceFromMarkup(10, -1)).toThrow(RangeError)
  })

  it('rejects non-finite or negative unit cost', () => {
    expect(() => computeUnitSellingPriceFromMarkup(Number.NaN, 0)).toThrow(RangeError)
    expect(() => computeUnitSellingPriceFromMarkup(-1, 0)).toThrow(RangeError)
  })
})
