import { describe, expect, it } from 'vitest'
import {
  marginFlag,
  formatAmountFromString,
  formatCompactCurrency,
  formatBidValueShort,
  formatDateYYMMDD,
  formatDateYYMMDDParts,
  formatDesignDrawingPlanDate,
  formatDesignDrawingPlanDateLabel,
} from './bidFormatting'

describe('marginFlag', () => {
  it('returns null for null margin', () => {
    expect(marginFlag(null)).toBeNull()
  })

  it('flags red below 20, yellow below 40, green at/above 40', () => {
    expect(marginFlag(0)).toBe('red')
    expect(marginFlag(19.99)).toBe('red')
    expect(marginFlag(20)).toBe('yellow')
    expect(marginFlag(39.99)).toBe('yellow')
    expect(marginFlag(40)).toBe('green')
    expect(marginFlag(80)).toBe('green')
  })
})

describe('formatAmountFromString', () => {
  it('formats a numeric string with thousands separators', () => {
    expect(formatAmountFromString('17242.50')).toBe('17,242.50')
  })

  it('strips existing commas before parsing', () => {
    expect(formatAmountFromString('1,234.5')).toBe('1,234.50')
  })

  it('returns empty string for non-numeric input', () => {
    expect(formatAmountFromString('abc')).toBe('')
    expect(formatAmountFromString('')).toBe('')
  })
})

describe('formatCompactCurrency', () => {
  it('renders em dash for null', () => {
    expect(formatCompactCurrency(null)).toBe('—')
  })

  it('drops the decimal for whole thousands', () => {
    expect(formatCompactCurrency(5000)).toBe('$5k')
  })

  it('keeps one decimal otherwise', () => {
    expect(formatCompactCurrency(5500)).toBe('$5.5k')
  })
})

describe('formatBidValueShort', () => {
  it('renders em dash for null', () => {
    expect(formatBidValueShort(null)).toBe('—')
  })

  it('uses 0 decimals at/above 10k and 1 decimal below', () => {
    expect(formatBidValueShort(25000)).toBe('25')
    expect(formatBidValueShort(5500)).toBe('5.5')
  })
})

describe('formatDateYYMMDD', () => {
  it('renders em dash for null', () => {
    expect(formatDateYYMMDD(null)).toBe('—')
  })

  it('renders em dash for an unparseable date instead of NaN/NaN', () => {
    expect(formatDateYYMMDD('not-a-date')).toBe('—')
  })

  it('formats the date portion as MM/DD with a day-count bracket', () => {
    expect(formatDateYYMMDD('2026-03-05')).toMatch(/^03\/05 \[[+-]\d+\]$/)
  })
})

describe('formatDateYYMMDDParts', () => {
  it('returns null for null input', () => {
    expect(formatDateYYMMDDParts(null)).toBeNull()
  })

  it('returns null for an unparseable date instead of NaN parts', () => {
    expect(formatDateYYMMDDParts('not-a-date')).toBeNull()
  })

  it('formats the stable date portion as MM/DD', () => {
    expect(formatDateYYMMDDParts('2026-03-05')?.date).toBe('03/05')
  })
})

describe('design drawing plan date formatters', () => {
  it('formats date as M-D-YY', () => {
    expect(formatDesignDrawingPlanDate('2026-03-05')).toBe('3-5-26')
  })

  it('formats label as MM/DD/YY', () => {
    expect(formatDesignDrawingPlanDateLabel('2026-03-05')).toBe('03/05/26')
  })

  it('returns empty string for blank input', () => {
    expect(formatDesignDrawingPlanDate('')).toBe('')
    expect(formatDesignDrawingPlanDateLabel('   ')).toBe('')
  })
})
