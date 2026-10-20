import { describe, expect, it } from 'vitest'
import { bidTaxRateToSave, effectiveBidTaxRate } from './bidTaxRate'
import { parseBidTaxRatePct } from '../appSettingsKeys'

describe('effectiveBidTaxRate', () => {
  it("is the bid's own rate when set", () => {
    expect(effectiveBidTaxRate(7.75, 8.25)).toEqual({ pct: 7.75, source: 'bid' })
    expect(effectiveBidTaxRate('6.5', 8.25)).toEqual({ pct: 6.5, source: 'bid' })
    expect(effectiveBidTaxRate(0, 8.25)).toEqual({ pct: 0, source: 'bid' })
  })
  it('is the company default when the bid has none, and 8.25 when the setting is missing', () => {
    expect(effectiveBidTaxRate(null, 8)).toEqual({ pct: 8, source: 'company' })
    expect(effectiveBidTaxRate(undefined, null)).toEqual({ pct: 8.25, source: 'company' })
    expect(effectiveBidTaxRate('', undefined)).toEqual({ pct: 8.25, source: 'company' })
  })
  it('falls back on garbage or a rate outside 0–100', () => {
    expect(effectiveBidTaxRate(101, 8.25)).toEqual({ pct: 8.25, source: 'company' })
    expect(effectiveBidTaxRate('abc', 8)).toEqual({ pct: 8, source: 'company' })
    expect(parseBidTaxRatePct(-1)).toBe(8.25)
    expect(parseBidTaxRatePct('8.25 %')).toBe(8.25)
  })
})

describe('bidTaxRateToSave', () => {
  it('saves a rate of its own, null for blank or the company number, undefined for garbage', () => {
    expect(bidTaxRateToSave('7.75', 8.25)).toBe(7.75)
    expect(bidTaxRateToSave('8.25', 8.25)).toBeNull()
    expect(bidTaxRateToSave('', 8.25)).toBeNull()
    expect(bidTaxRateToSave('x', 8.25)).toBeUndefined()
    expect(bidTaxRateToSave('120', 8.25)).toBeUndefined()
    expect(bidTaxRateToSave('0', 8.25)).toBe(0)
  })
})
