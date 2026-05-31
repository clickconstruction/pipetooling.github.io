import { describe, expect, it } from 'vitest'
import { decimalToHms, hmsToDecimal } from './hoursGridTime'

describe('decimalToHms', () => {
  it('returns empty string for zero, negative, or NaN', () => {
    expect(decimalToHms(0)).toBe('')
    expect(decimalToHms(-1)).toBe('')
    expect(decimalToHms(NaN)).toBe('')
  })

  it('always renders an H:MM:SS triple (seconds segment never omitted)', () => {
    expect(decimalToHms(8)).toBe('8:00:00')
    expect(decimalToHms(8.5)).toBe('8:30:00')
  })

  it('zero-pads minutes and renders seconds when present', () => {
    expect(decimalToHms(8.25)).toBe('8:15:00')
    expect(decimalToHms(2.125)).toBe('2:07:30')
    expect(decimalToHms(2 + 30 / 60 + 15 / 3600)).toBe('2:30:15')
  })
})

describe('hmsToDecimal', () => {
  it('returns 0 for empty/whitespace', () => {
    expect(hmsToDecimal('')).toBe(0)
    expect(hmsToDecimal('   ')).toBe(0)
  })

  it('treats one-digit fraction as decimal hours', () => {
    expect(hmsToDecimal('8.5')).toBe(8.5)
  })

  it('treats two-digit fraction >59 as decimal hours', () => {
    expect(hmsToDecimal('8.75')).toBe(8.75)
  })

  it('treats two-digit fraction <=59 as minutes', () => {
    expect(hmsToDecimal('8.30')).toBeCloseTo(8.5, 10)
  })

  it('parses colon-separated H:M and H:M:S', () => {
    expect(hmsToDecimal('8:30')).toBeCloseTo(8.5, 10)
    expect(hmsToDecimal('2:07:30')).toBeCloseTo(2.125, 10)
  })

  it('treats spaces as separators', () => {
    expect(hmsToDecimal('8 30')).toBeCloseTo(8.5, 10)
  })

  it('round-trips with decimalToHms for colon-formatted values', () => {
    expect(hmsToDecimal(decimalToHms(2.125))).toBeCloseTo(2.125, 10)
  })
})
