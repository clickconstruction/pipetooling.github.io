import { describe, expect, it } from 'vitest'
import { bidTriagePillLabel,
  marginFlag,
  formatAmountFromString,
  formatRevenueMultiple,
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

  it('uses 0 decimals at/above 10k and 1 decimal below, always with a k suffix', () => {
    expect(formatBidValueShort(25000)).toBe('25k')
    expect(formatBidValueShort(5500)).toBe('5.5k')
  })

  it('keeps thousands for million-dollar bids', () => {
    expect(formatBidValueShort(1240000)).toBe('1240k')
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

describe('bidTriagePillLabel', () => {
  it('leads with the project name, ellipsized', () => {
    expect(bidTriagePillLabel({ project: 'Take 5 Dickinson', address: '484 w fm 646 rd Dickinson, TX', label: 'BP251' })).toBe('Take 5 Dickinson')
    expect(bidTriagePillLabel({ project: 'Bastrop County Community Development Services Building', address: null, label: 'BP1' })).toBe('Bastrop County Community D…')
  })

  it('falls back to the street for unnamed bids, then the ledger label', () => {
    expect(bidTriagePillLabel({ project: '—', address: '400 S SAGINAW BLVD, SAGINAW, TX', label: 'BP342' })).toBe('S SAGINAW BLVD')
    expect(bidTriagePillLabel({ project: '', address: null, label: 'BP342' })).toBe('BP342')
  })
})

describe('formatRevenueMultiple', () => {
  it('one decimal with the × suffix', () => {
    expect(formatRevenueMultiple(56343, 25817)).toBe('2.2×')
    expect(formatRevenueMultiple(198400, 100000)).toBe('2.0×')
    expect(formatRevenueMultiple(310000, 100000)).toBe('3.1×')
  })
  it('null when there is nothing to divide', () => {
    expect(formatRevenueMultiple(56343, 0)).toBeNull()
    expect(formatRevenueMultiple(0, 25817)).toBeNull()
    expect(formatRevenueMultiple(NaN, 100)).toBeNull()
  })
})
