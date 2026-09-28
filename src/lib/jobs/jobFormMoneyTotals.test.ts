import { describe, expect, it } from 'vitest'
import { jobFormPaidDollars, jobFormPaymentRemovePreview, jobFormRevenueDollars } from './jobFormMoneyTotals'

const line = (name: string, count: number, line_unit_price: number | null) => ({ name, count, line_unit_price })

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
