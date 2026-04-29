import { describe, expect, it } from 'vitest'
import { parsePoGeneratorCodeFromPurchaseOrderName } from './parsePoGeneratorCodeFromPurchaseOrderName'

describe('parsePoGeneratorCodeFromPurchaseOrderName', () => {
  it('finds first code in text', () => {
    expect(parsePoGeneratorCodeFromPurchaseOrderName('Shop run PO 87432 notes')).toBe(87432)
    expect(parsePoGeneratorCodeFromPurchaseOrderName('10000')).toBe(10000)
    expect(parsePoGeneratorCodeFromPurchaseOrderName('99999 end')).toBe(99999)
  })
  it('returns null when no 10000–99999 token', () => {
    expect(parsePoGeneratorCodeFromPurchaseOrderName('Job Parts 651 2026-01-15 12:00:00')).toBe(null)
    expect(parsePoGeneratorCodeFromPurchaseOrderName('')).toBe(null)
    expect(parsePoGeneratorCodeFromPurchaseOrderName('9999')).toBe(null)
  })
  it('ignores five digits before -N shop invoice suffixes', () => {
    expect(parsePoGeneratorCodeFromPurchaseOrderName('40326-1')).toBe(null)
    expect(parsePoGeneratorCodeFromPurchaseOrderName('30426-4')).toBe(null)
    expect(parsePoGeneratorCodeFromPurchaseOrderName('12345-1')).toBe(null)
  })
})
