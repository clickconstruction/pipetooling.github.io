import { describe, expect, it } from 'vitest'
import { decimalToHm, decimalToHms, hmsToDecimal } from './hoursGridTime'

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

  it('carries floating-point seconds==60 up into minutes', () => {
    expect(decimalToHms(1 + 5 / 60)).toBe('1:05:00')
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

describe('decimalToHm', () => {
  it('reads running time to the minute, floored, with no seconds', () => {
    expect(decimalToHm(7 + 38 / 60)).toBe('7:38')
    expect(decimalToHm(7 + 38 / 60 + 59 / 3600)).toBe('7:38')
    expect(decimalToHm(23.5)).toBe('23:30')
    expect(decimalToHm(0.05)).toBe('0:03')
  })

  it('reads 0:00 for none, a negative or a number that is not one', () => {
    expect(decimalToHm(0)).toBe('0:00')
    expect(decimalToHm(-2)).toBe('0:00')
    expect(decimalToHm(NaN)).toBe('0:00')
  })
})
