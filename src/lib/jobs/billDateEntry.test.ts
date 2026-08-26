import { describe, expect, it } from 'vitest'
import {
  BILL_DATE_PLACEHOLDER,
  billDateInputWidthCh,
  billedAtIsoFromYmd,
  formatBillDateInput,
  parseBillDateInput,
} from './billDateEntry'

describe('formatBillDateInput', () => {
  it('auto-inserts slashes as digits arrive', () => {
    expect(formatBillDateInput('')).toBe('')
    expect(formatBillDateInput('0')).toBe('0')
    expect(formatBillDateInput('08')).toBe('08')
    expect(formatBillDateInput('081')).toBe('08/1')
    expect(formatBillDateInput('0813')).toBe('08/13')
    expect(formatBillDateInput('08132')).toBe('08/13/2')
    expect(formatBillDateInput('081326')).toBe('08/13/26')
  })

  it('strips non-digits and caps at six digits', () => {
    expect(formatBillDateInput('08/13/26')).toBe('08/13/26')
    expect(formatBillDateInput('8a1b3c2d6e9')).toBe('81/32/69')
    expect(formatBillDateInput('08132699')).toBe('08/13/26')
  })

  it('lets backspace across a slash keep shrinking', () => {
    // deleting the trailing "2" of "08/13/2" leaves digits 0813
    expect(formatBillDateInput('08/13/')).toBe('08/13')
    expect(formatBillDateInput('08/1')).toBe('08/1')
  })
})

describe('parseBillDateInput', () => {
  it('parses a complete real date to 20YY-MM-DD', () => {
    expect(parseBillDateInput('08/13/26')).toBe('2026-08-13')
    expect(parseBillDateInput('12/31/25')).toBe('2025-12-31')
    expect(parseBillDateInput('01/01/00')).toBe('2000-01-01')
  })

  it('rejects incomplete or malformed input', () => {
    expect(parseBillDateInput('')).toBeNull()
    expect(parseBillDateInput('08/13/2')).toBeNull()
    expect(parseBillDateInput('08/13')).toBeNull()
    expect(parseBillDateInput('2026-08-13')).toBeNull()
  })

  it('rejects impossible calendar dates', () => {
    expect(parseBillDateInput('13/01/26')).toBeNull()
    expect(parseBillDateInput('00/10/26')).toBeNull()
    expect(parseBillDateInput('02/30/26')).toBeNull()
    expect(parseBillDateInput('04/31/26')).toBeNull()
    expect(parseBillDateInput('06/00/26')).toBeNull()
  })

  it('handles leap years', () => {
    expect(parseBillDateInput('02/29/24')).toBe('2024-02-29')
    expect(parseBillDateInput('02/29/25')).toBeNull()
  })
})

describe('billDateInputWidthCh', () => {
  it('hugs the typed text but never shrinks below the placeholder', () => {
    expect(billDateInputWidthCh('')).toBe(BILL_DATE_PLACEHOLDER.length)
    expect(billDateInputWidthCh('08/1')).toBe(BILL_DATE_PLACEHOLDER.length)
    expect(billDateInputWidthCh('08/13/26')).toBe(8)
  })
})

describe('billedAtIsoFromYmd', () => {
  it('pins 18:00 UTC so the company-timezone date matches in CST and CDT', () => {
    expect(billedAtIsoFromYmd('2026-08-13')).toBe('2026-08-13T18:00:00.000Z')
    expect(billedAtIsoFromYmd('2026-01-15')).toBe('2026-01-15T18:00:00.000Z')
  })
})
