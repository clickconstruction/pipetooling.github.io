import { describe, expect, it } from 'vitest'
import { jobFormPaidDollars, jobFormPaymentRemovePreview, jobFormRevenueDollars, jobFormRiderFeesDollars } from './jobFormMoneyTotals'

const line = (name: string, count: number, line_unit_price: number | null) => ({ name, count, line_unit_price })
/** A bill carrying returned check fees, as `add_ar_return_case_fee` leaves it (v2.5033). */
const billWithFees = (...amounts: unknown[]) => ({ id: 'b1', amount: 13_710, fee_lines: amounts.map((amount, i) => ({ description: 'Returned check fee (Tex. Bus. & Com. Code § 3.506)', amount, case_id: `tx-${i}`, added_at: '2026-10-09T15:00:00Z' })) })

describe('jobFormRiderFeesDollars (v2.5091)', () => {
  it('is the hazmat fees plus every returned check fee on the job’s bills', () => {
    expect(jobFormRiderFeesDollars(500, [billWithFees(30)])).toBe(530)
    expect(jobFormRiderFeesDollars(0, [billWithFees(30), { id: 'b2', fee_lines: null }, billWithFees(30)])).toBe(60)
  })

  it('with no fee on a bill it is the hazmat fees alone, as before', () => {
    expect(jobFormRiderFeesDollars(500, [])).toBe(500)
    expect(jobFormRiderFeesDollars(500, [{ id: 'b1', amount: 4_210 }])).toBe(500)
    expect(jobFormRiderFeesDollars(0, null)).toBe(0)
    expect(jobFormRiderFeesDollars(0, undefined)).toBe(0)
  })

  it('a fee line that names no case is not counted', () => {
    expect(jobFormRiderFeesDollars(0, [{ id: 'b1', fee_lines: [{ description: 'Some other fee', amount: 45 }] }])).toBe(0)
  })

  it('a GC card fee rides too (v2.5113): the entry gc_card_bill_finish writes, beside a returned check fee', () => {
    const cardBill = { id: 'b9', amount: 44_032.5, fee_lines: [{ description: 'Credit card fee (3%)', amount: 1_282.5, card_bill: 'b9', added_at: '2026-10-09T20:00:00Z' }] }
    expect(jobFormRiderFeesDollars(0, [cardBill])).toBe(1_282.5)
    expect(jobFormRiderFeesDollars(0, [cardBill, billWithFees(30)])).toBe(1_312.5)
  })

  it('adds in cents, and an unreadable hazmat figure counts as nothing', () => {
    expect(jobFormRiderFeesDollars(0.1, [billWithFees(0.2)])).toBe(0.3)
    expect(jobFormRiderFeesDollars(Number.NaN, [billWithFees(30)])).toBe(30)
  })

  it('the Job Total and the revenue written on save keep the fee: Southern Post’s bill 1', () => {
    const fixtures = [line('Rough-in', 1, 13_680), line('Final', 2, 2_000)]
    expect(jobFormRevenueDollars(fixtures, jobFormRiderFeesDollars(0, [billWithFees(30)]))).toBe(17_710)
  })
})

describe('jobFormRevenueDollars', () => {
  it('is the named line items plus the rider fees', () => {
    expect(jobFormRevenueDollars([line('Water heater', 1, 1_200), line('Hose bibb', 2, 150)], 0)).toBe(1_500)
    expect(jobFormRevenueDollars([line('Water heater', 1, 1_200)], 250)).toBe(1_450)
  })

  it('the fees count even when there are no line items (v2.1029)', () => {
    expect(jobFormRevenueDollars([], 75)).toBe(75)
    expect(jobFormRevenueDollars([line('', 1, 900)], 75)).toBe(75)
  })

  it('a discount row’s negative amount reduces the total', () => {
    expect(jobFormRevenueDollars([line('Rough-in', 1, 1_000), line('Discount', 1, -100)], 50)).toBe(950)
  })
})

describe('jobFormPaidDollars', () => {
  it('sums every payment line', () => {
    expect(jobFormPaidDollars([{ amount: 100 }, { amount: 250.5 }])).toBe(350.5)
    expect(jobFormPaidDollars([])).toBe(0)
  })

  it('reads a typed amount and counts a blank or unreadable one as zero', () => {
    expect(jobFormPaidDollars([{ amount: '40' }, { amount: '' }, { amount: null }, { amount: undefined }, { amount: 'abc' }, { amount: Number.NaN }])).toBe(40)
  })

  it('a negative line (a returned payment) reduces the sum', () => {
    expect(jobFormPaidDollars([{ amount: 500 }, { amount: -200 }])).toBe(300)
  })
})

describe('jobFormPaymentRemovePreview', () => {
  const payments = [
    { id: 'p1', amount: 500 },
    { id: 'p2', amount: 700 },
  ]

  it('is null with no line picked or a line that is gone', () => {
    expect(jobFormPaymentRemovePreview({ rowId: null, payments, jobTotalDollars: 2_000 })).toBeNull()
    expect(jobFormPaymentRemovePreview({ rowId: 'p9', payments, jobTotalDollars: 2_000 })).toBeNull()
  })

  it('shows the line, the job total, and the remainder now and after', () => {
    expect(jobFormPaymentRemovePreview({ rowId: 'p1', payments, jobTotalDollars: 2_000 })).toEqual({ rowAmt: 500, jobTotal: 2_000, currentRem: 800, newRem: 1_300 })
  })

  it('an overpaid job reads 0 remaining, and the remainder after never goes below zero', () => {
    expect(jobFormPaymentRemovePreview({ rowId: 'p1', payments, jobTotalDollars: 1_000 })).toEqual({ rowAmt: 500, jobTotal: 1_000, currentRem: 0, newRem: 300 })
    expect(jobFormPaymentRemovePreview({ rowId: 'p1', payments, jobTotalDollars: 600 })).toEqual({ rowAmt: 500, jobTotal: 600, currentRem: 0, newRem: 0 })
  })

  it('a line with no readable amount removes nothing', () => {
    expect(jobFormPaymentRemovePreview({ rowId: 'p3', payments: [...payments, { id: 'p3', amount: null }], jobTotalDollars: 2_000 })).toEqual({ rowAmt: 0, jobTotal: 2_000, currentRem: 800, newRem: 800 })
  })
})
