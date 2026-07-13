import { describe, expect, it } from 'vitest'
import {
  formatJobSummaryPercentComplete,
  jobInvoicesAllPaidWithAmount,
  resolveJobSummaryPercentComplete,
} from './jobSummaryPercentComplete'

describe('jobInvoicesAllPaidWithAmount', () => {
  it('is true when every invoice is paid and the total is above zero', () => {
    expect(
      jobInvoicesAllPaidWithAmount([
        { status: 'paid', amount: 500 },
        { status: 'paid', amount: 250 },
      ]),
    ).toBe(true)
  })
  it('is false with no invoices', () => {
    expect(jobInvoicesAllPaidWithAmount([])).toBe(false)
    expect(jobInvoicesAllPaidWithAmount(null)).toBe(false)
    expect(jobInvoicesAllPaidWithAmount(undefined)).toBe(false)
  })
  it('is false when any invoice is not paid', () => {
    expect(
      jobInvoicesAllPaidWithAmount([
        { status: 'paid', amount: 500 },
        { status: 'billed', amount: 100 },
      ]),
    ).toBe(false)
    expect(jobInvoicesAllPaidWithAmount([{ status: 'ready_to_bill', amount: 500 }])).toBe(false)
  })
  it('is false when the paid total is zero or negative (write-downs, null amounts)', () => {
    expect(jobInvoicesAllPaidWithAmount([{ status: 'paid', amount: 0 }])).toBe(false)
    expect(jobInvoicesAllPaidWithAmount([{ status: 'paid', amount: null }])).toBe(false)
    expect(
      jobInvoicesAllPaidWithAmount([
        { status: 'paid', amount: 100 },
        { status: 'paid', amount: -100 },
      ]),
    ).toBe(false)
  })
})

describe('resolveJobSummaryPercentComplete', () => {
  it('returns 100 when all invoices are paid with a positive total, beating any report %', () => {
    expect(resolveJobSummaryPercentComplete(60, 20, { invoicesAllPaidWithAmount: true })).toBe(100)
    expect(resolveJobSummaryPercentComplete(null, null, { invoicesAllPaidWithAmount: true })).toBe(100)
  })
  it('ignores the invoices flag when false', () => {
    expect(resolveJobSummaryPercentComplete(60, 20, { invoicesAllPaidWithAmount: false })).toBe(60)
  })
  it('prefers the report percent when present', () => {
    expect(resolveJobSummaryPercentComplete(60, 20)).toBe(60)
    expect(resolveJobSummaryPercentComplete(0, 50)).toBe(0)
    expect(resolveJobSummaryPercentComplete(100, null)).toBe(100)
  })
  it('falls back to the job pct_complete field when no report percent', () => {
    expect(resolveJobSummaryPercentComplete(null, 45)).toBe(45)
    expect(resolveJobSummaryPercentComplete(undefined, 0)).toBe(0)
  })
  it('returns null when neither source has a valid value', () => {
    expect(resolveJobSummaryPercentComplete(null, null)).toBeNull()
    expect(resolveJobSummaryPercentComplete(undefined, undefined)).toBeNull()
  })
  it('ignores out-of-range or non-finite values from either source', () => {
    expect(resolveJobSummaryPercentComplete(150, 40)).toBe(40)
    expect(resolveJobSummaryPercentComplete(-1, null)).toBeNull()
    expect(resolveJobSummaryPercentComplete(Number.NaN, 30)).toBe(30)
    expect(resolveJobSummaryPercentComplete(null, 101)).toBeNull()
  })
  it('rounds fractional values', () => {
    expect(resolveJobSummaryPercentComplete(66.6, null)).toBe(67)
    expect(resolveJobSummaryPercentComplete(null, 33.3)).toBe(33)
  })
})

describe('formatJobSummaryPercentComplete', () => {
  it('formats percent and em-dash for null', () => {
    expect(formatJobSummaryPercentComplete(62)).toBe('62%')
    expect(formatJobSummaryPercentComplete(0)).toBe('0%')
    expect(formatJobSummaryPercentComplete(null)).toBe('—')
  })
})
