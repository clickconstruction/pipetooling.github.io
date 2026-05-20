import { describe, expect, it } from 'vitest'

import { parsePercentCompleteInput } from './parsePercentCompleteInput'

describe('parsePercentCompleteInput', () => {
  it('returns null for an empty string', () => {
    expect(parsePercentCompleteInput('')).toBeNull()
  })

  it('returns null for whitespace-only input', () => {
    expect(parsePercentCompleteInput('   ')).toBeNull()
  })

  it('returns null for non-numeric input', () => {
    expect(parsePercentCompleteInput('abc')).toBeNull()
  })

  it('parses a plain integer in range', () => {
    expect(parsePercentCompleteInput('50')).toBe(50)
  })

  it('trims surrounding whitespace before parsing', () => {
    expect(parsePercentCompleteInput(' 50 ')).toBe(50)
  })

  it('treats negatives as clear (they clamp to 0, which we map to null)', () => {
    expect(parsePercentCompleteInput('-5')).toBeNull()
  })

  it('clamps values above 100 to 100 (matches the DB CHECK upper bound)', () => {
    expect(parsePercentCompleteInput('150')).toBe(100)
  })

  it('rounds fractional values down when the fraction is < 0.5', () => {
    expect(parsePercentCompleteInput('50.4')).toBe(50)
  })

  it('rounds fractional values up when the fraction is >= 0.5', () => {
    expect(parsePercentCompleteInput('50.6')).toBe(51)
  })

  it('treats explicit "0" as clear (functionally identical to "not tracked")', () => {
    expect(parsePercentCompleteInput('0')).toBeNull()
  })

  it('treats fractionals that round to 0 as clear (0.4 -> 0 -> null)', () => {
    expect(parsePercentCompleteInput('0.4')).toBeNull()
  })

  it('accepts 100 at the upper boundary', () => {
    expect(parsePercentCompleteInput('100')).toBe(100)
  })

  it('rounds 100.4 to 100 (no out-of-range edge case after rounding)', () => {
    expect(parsePercentCompleteInput('100.4')).toBe(100)
  })

  it('handles NaN-producing edge cases by returning null', () => {
    expect(parsePercentCompleteInput('NaN')).toBeNull()
  })
})
