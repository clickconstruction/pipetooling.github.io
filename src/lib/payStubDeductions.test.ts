import { describe, expect, it } from 'vitest'
import { stubNetPay, sumPayStubAdditionalAmounts, sumPayStubDeductionAmounts, type PayStubAdditionalLineRow, type PayStubDeductionRow } from './payStubDeductions'

/** The pay report's Less / Additional sums and Net Pay — payroll money, pinned (v2.3874, the People map's Stage A). */
const ded = (amount: number | string, over: Partial<PayStubDeductionRow> = {}): PayStubDeductionRow =>
  ({ id: 'd', pay_stub_id: 's', amount: amount as number, source: 'manual', person_offset_id: null, description: 'x', created_at: null, created_by: null, ...over })
const add = (line_total: number | string): PayStubAdditionalLineRow =>
  ({ id: 'a', pay_stub_id: 's', description: 'x', quantity: 1, rate: 1, line_total: line_total as number, created_at: null, created_by: null })

describe('the Less and Additional sums', () => {
  it('are 0 with no rows, and sum to whole cents', () => {
    expect(sumPayStubDeductionAmounts(undefined)).toBe(0)
    expect(sumPayStubDeductionAmounts([])).toBe(0)
    expect(sumPayStubDeductionAmounts([ded(10.005), ded(0.1), ded(0.2)])).toBe(10.31)
    expect(sumPayStubAdditionalAmounts([add(0.1), add(0.2)])).toBe(0.3)
  })
  it('read a numeric string the way the database hands it back', () => {
    expect(sumPayStubDeductionAmounts([ded('12.34'), ded('0.66')])).toBe(13)
    expect(sumPayStubAdditionalAmounts([add('99.99')])).toBe(99.99)
  })
})

describe('stubNetPay', () => {
  it('is gross less deductions plus additional, in cents, never below zero', () => {
    expect(stubNetPay(1000, 250)).toBe(750)
    expect(stubNetPay(1000, 250, 75.5)).toBe(825.5)
    expect(stubNetPay(100, 0.1 + 0.2)).toBe(99.7)
    expect(stubNetPay(100, 150)).toBe(0)
    expect(stubNetPay(0, 0)).toBe(0)
  })
})
