import { describe, expect, it } from 'vitest'
import { isFullRemainingAmount, planTypedInvoice, segmentSelectionBillCheck } from './jobFormInvoiceClamps'

describe('planTypedInvoice', () => {
  it('an amount that is zero, negative or not a number is invalid', () => {
    for (const typedAmount of [0, -5, Number.NaN]) {
      expect(planTypedInvoice({ typedAmount, remainingDollars: 1_000, jobStatus: 'working' })).toEqual({ kind: 'invalid' })
    }
  })

  it('nothing left on the job is nothing to bill', () => {
    expect(planTypedInvoice({ typedAmount: 100, remainingDollars: 0, jobStatus: 'working' })).toEqual({ kind: 'nothing-left' })
    expect(planTypedInvoice({ typedAmount: 100, remainingDollars: 0.004, jobStatus: 'ready_to_bill' })).toEqual({ kind: 'nothing-left' })
  })

  it('a part of the remainder is a draft for that amount', () => {
    expect(planTypedInvoice({ typedAmount: 250.5, remainingDollars: 1_000, jobStatus: 'working' })).toEqual({ kind: 'draft', amount: 250.5, amountCents: 25_050, adjusted: false })
    expect(planTypedInvoice({ typedAmount: 250.5, remainingDollars: 1_000, jobStatus: 'ready_to_bill' })).toEqual({ kind: 'draft', amount: 250.5, amountCents: 25_050, adjusted: false })
  })

  it('more than the remainder is cut back to it and marked adjusted', () => {
    expect(planTypedInvoice({ typedAmount: 1_500, remainingDollars: 1_000, jobStatus: 'working' })).toEqual({ kind: 'draft', amount: 1_000, amountCents: 100_000, adjusted: true })
  })

  it('the whole remainder of a Ready to Bill job goes to Bill Customer — typed exactly or cut back to it', () => {
    expect(planTypedInvoice({ typedAmount: 1_000, remainingDollars: 1_000, jobStatus: 'ready_to_bill' })).toEqual({ kind: 'bill-customer', amount: 1_000, amountCents: 100_000, adjusted: false })
    expect(planTypedInvoice({ typedAmount: 1_200, remainingDollars: 1_000, jobStatus: 'ready_to_bill' })).toEqual({ kind: 'bill-customer', amount: 1_000, amountCents: 100_000, adjusted: true })
  })

  it('on any other status the whole remainder is still a draft', () => {
    for (const jobStatus of ['working', 'billed', 'paid', null, undefined]) {
      expect(planTypedInvoice({ typedAmount: 1_000, remainingDollars: 1_000, jobStatus }).kind).toBe('draft')
    }
  })

  it('compares in whole cents', () => {
    expect(planTypedInvoice({ typedAmount: 100.1, remainingDollars: 100.10000000000001, jobStatus: 'ready_to_bill' }).kind).toBe('bill-customer')
    expect(planTypedInvoice({ typedAmount: 100.104, remainingDollars: 100.1, jobStatus: 'working' })).toEqual({ kind: 'draft', amount: 100.1, amountCents: 10_010, adjusted: false })
    expect(planTypedInvoice({ typedAmount: 99.99, remainingDollars: 100, jobStatus: 'ready_to_bill' }).kind).toBe('draft')
  })
})

describe('segmentSelectionBillCheck', () => {
  it('nothing picked, or a net that is not above zero, is empty', () => {
    expect(segmentSelectionBillCheck({ netDollars: 0, count: 0, remainingDollars: 500 })).toBe('empty')
    expect(segmentSelectionBillCheck({ netDollars: 0, count: 2, remainingDollars: 500 })).toBe('empty')
    expect(segmentSelectionBillCheck({ netDollars: 300, count: 0, remainingDollars: 500 })).toBe('empty')
    expect(segmentSelectionBillCheck({ netDollars: -10, count: 1, remainingDollars: 500 })).toBe('empty')
  })

  it('a net past the remainder is over, by as little as a cent', () => {
    expect(segmentSelectionBillCheck({ netDollars: 500.01, count: 1, remainingDollars: 500 })).toBe('over')
    expect(segmentSelectionBillCheck({ netDollars: 900, count: 3, remainingDollars: 500 })).toBe('over')
  })

  it('up to the remainder is ok, and a sub-cent overage is not over', () => {
    expect(segmentSelectionBillCheck({ netDollars: 500, count: 1, remainingDollars: 500 })).toBe('ok')
    expect(segmentSelectionBillCheck({ netDollars: 500.004, count: 1, remainingDollars: 500 })).toBe('ok')
    expect(segmentSelectionBillCheck({ netDollars: 120, count: 2, remainingDollars: 500 })).toBe('ok')
  })
})

describe('isFullRemainingAmount', () => {
  it('is the remainder to the cent', () => {
    expect(isFullRemainingAmount(1_000, 1_000)).toBe(true)
    expect(isFullRemainingAmount(1_000.004, 1_000)).toBe(true)
    expect(isFullRemainingAmount(999.99, 1_000)).toBe(false)
    expect(isFullRemainingAmount(1_000.01, 1_000)).toBe(false)
  })

  it('is never true with nothing left, or with an unreadable amount', () => {
    expect(isFullRemainingAmount(0, 0)).toBe(false)
    expect(isFullRemainingAmount(0, -5)).toBe(false)
    expect(isFullRemainingAmount(Number.NaN, 1_000)).toBe(false)
  })
})
