import { describe, expect, it } from 'vitest'
import {
  formatCurrency,
  formatPaymentDateForDisplay,
  parseMoneyInputToNumber,
  parseMoneyInputToNumberOrNull,
  sanitizeMoneyTyping,
} from './jobFormMoney'

describe('formatCurrency', () => {
  it('always shows two decimals with thousands separators', () => {
    expect(formatCurrency(1234.5)).toBe('1,234.50')
    expect(formatCurrency(0)).toBe('0.00')
  })
})

describe('parseMoneyInputToNumber', () => {
  it('strips commas, treats empty/dot as 0', () => {
    expect(parseMoneyInputToNumber('1,234.5')).toBe(1234.5)
    expect(parseMoneyInputToNumber('')).toBe(0)
    expect(parseMoneyInputToNumber('.')).toBe(0)
    expect(parseMoneyInputToNumber('abc')).toBe(0)
  })
})

describe('parseMoneyInputToNumberOrNull', () => {
  it('returns null for empty/dot/garbage', () => {
    expect(parseMoneyInputToNumberOrNull('500')).toBe(500)
    expect(parseMoneyInputToNumberOrNull('')).toBeNull()
    expect(parseMoneyInputToNumberOrNull('.')).toBeNull()
    expect(parseMoneyInputToNumberOrNull('x')).toBeNull()
  })
})

describe('sanitizeMoneyTyping', () => {
  it('keeps only digits and a single dot', () => {
    expect(sanitizeMoneyTyping('1,2a3.4.5')).toBe('123.45')
    expect(sanitizeMoneyTyping('$100')).toBe('100')
    expect(sanitizeMoneyTyping('..5')).toBe('.5')
  })
})

describe('formatPaymentDateForDisplay', () => {
  it('dashes blank, passes through unparseable, formats valid dates', () => {
    expect(formatPaymentDateForDisplay(null)).toBe('—')
    expect(formatPaymentDateForDisplay('  ')).toBe('—')
    expect(formatPaymentDateForDisplay('not-a-date')).toBe('not-a-date')
    // a valid YMD renders a localized string containing the year
    expect(formatPaymentDateForDisplay('2026-07-19')).toContain('2026')
  })
})
