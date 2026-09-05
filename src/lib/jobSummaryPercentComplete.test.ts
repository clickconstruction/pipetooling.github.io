import { describe, expect, it } from 'vitest'
import {
  formatJobSummaryPercentComplete,
  jobInvoicedTotalUsd,
  jobInvoicesAllPaidWithAmount,
  jobSummaryPaidInvoiceOpts,
  paidInvoicesCoverContract,
  resolveJobCurrentPercentFallback,
  resolveJobSummaryPercentComplete,
  resolveJobSummaryPercentCompleteWithSource,
  type JobSummaryPercentSource,
} from './jobSummaryPercentComplete'
import { percentProvenanceLabel } from './jobPercentProvenance'

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

describe('jobInvoicedTotalUsd', () => {
  it('sums every invoice regardless of status; empty → 0', () => {
    expect(
      jobInvoicedTotalUsd([
        { amount: 500 },
        { amount: 250.5 },
        { amount: null },
      ]),
    ).toBe(750.5)
    expect(jobInvoicedTotalUsd([])).toBe(0)
    expect(jobInvoicedTotalUsd(null)).toBe(0)
  })
})

describe('paidInvoicesCoverContract', () => {
  it('covers when invoiced ≥ contract, within max($1, 0.5%)', () => {
    expect(paidInvoicesCoverContract(123_600, 123_600)).toBe(true)
    expect(paidInvoicesCoverContract(123_000, 123_600)).toBe(true) // $600 short < 0.5% ($618)
    expect(paidInvoicesCoverContract(122_900, 123_600)).toBe(false) // $700 short > 0.5%
    expect(paidInvoicesCoverContract(99.5, 100)).toBe(true) // 50¢ short, inside the $1 floor
    expect(paidInvoicesCoverContract(98, 100)).toBe(false)
    expect(paidInvoicesCoverContract(130_000, 123_600)).toBe(true) // over-billed still covers
  })
  it('J523: one paid progress bill at 66% of the contract does not cover it', () => {
    expect(paidInvoicesCoverContract(81_916.6, 123_600)).toBe(false)
  })
  it('no contract to compare against (null / $0 revenue) → covered, the pre-gate rule', () => {
    expect(paidInvoicesCoverContract(500, null)).toBe(true)
    expect(paidInvoicesCoverContract(500, 0)).toBe(true)
    expect(paidInvoicesCoverContract(0, undefined)).toBe(true)
  })
})

describe('resolveJobSummaryPercentComplete', () => {
  it('returns 100 when all invoices are paid with a positive total and no contract is set, beating any report %', () => {
    expect(resolveJobSummaryPercentComplete(60, 20, { invoicesAllPaidWithAmount: true })).toBe(100)
    expect(resolveJobSummaryPercentComplete(null, null, { invoicesAllPaidWithAmount: true })).toBe(100)
  })
  describe('paid-invoices gate (J523 shape: $81,916.60 paid of a $123,600 contract)', () => {
    const j523 = jobSummaryPaidInvoiceOpts([{ status: 'paid', amount: 81_916.6 }], 123_600)
    it('one paid progress bill falls through to the latest crew report (77, not 100)', () => {
      expect(resolveJobSummaryPercentCompleteWithSource(77, 63, j523)).toEqual({ pct: 77, source: 'crew-report' })
      expect(resolveJobSummaryPercentComplete(77, 63, j523)).toBe(77)
    })
    it('… then to the office % when no report carries one (63)', () => {
      expect(resolveJobSummaryPercentCompleteWithSource(null, 63, j523)).toEqual({ pct: 63, source: 'office' })
    })
    it('… and to nothing when neither says', () => {
      expect(resolveJobSummaryPercentCompleteWithSource(null, null, j523)).toEqual({ pct: null, source: 'none' })
    })
    it('invoiced ≥ contract and all paid → 100 from paid-invoices, beating the report', () => {
      const billedOut = jobSummaryPaidInvoiceOpts(
        [
          { status: 'paid', amount: 81_916.6 },
          { status: 'paid', amount: 41_683.4 },
        ],
        123_600,
      )
      expect(resolveJobSummaryPercentCompleteWithSource(77, 63, billedOut)).toEqual({ pct: 100, source: 'paid-invoices' })
    })
    it('single-invoice service job where invoiced == contract still reads 100', () => {
      const service = jobSummaryPaidInvoiceOpts([{ status: 'paid', amount: 850 }], 850)
      expect(resolveJobSummaryPercentCompleteWithSource(40, null, service)).toEqual({ pct: 100, source: 'paid-invoices' })
    })
    it('contract as a numeric string (ledger rows) is coerced', () => {
      const asString = jobSummaryPaidInvoiceOpts([{ status: 'paid', amount: 850 }], '850.00')
      expect(resolveJobSummaryPercentComplete(40, null, asString)).toBe(100)
    })
    it('zero-revenue job with a paid invoice → 100 as before: no contract to compare against, and the Quickfill "Complete, no Total Bill" list is built on exactly that shape', () => {
      const noBill = jobSummaryPaidInvoiceOpts([{ status: 'paid', amount: 500 }], null)
      expect(resolveJobSummaryPercentCompleteWithSource(40, null, noBill)).toEqual({ pct: 100, source: 'paid-invoices' })
      expect(resolveJobSummaryPercentComplete(40, null, jobSummaryPaidInvoiceOpts([{ status: 'paid', amount: 500 }], 0))).toBe(100)
    })
    it('an unpaid bill in the mix never fires the branch, covered or not', () => {
      const mixed = jobSummaryPaidInvoiceOpts(
        [
          { status: 'paid', amount: 81_916.6 },
          { status: 'billed', amount: 41_683.4 },
        ],
        123_600,
      )
      expect(resolveJobSummaryPercentCompleteWithSource(77, 63, mixed)).toEqual({ pct: 77, source: 'crew-report' })
    })
  })
  it('reports the source of a plain report / office / empty resolution', () => {
    expect(resolveJobSummaryPercentCompleteWithSource(60, 20)).toEqual({ pct: 60, source: 'crew-report' })
    expect(resolveJobSummaryPercentCompleteWithSource(null, 20)).toEqual({ pct: 20, source: 'office' })
    expect(resolveJobSummaryPercentCompleteWithSource(null, null)).toEqual({ pct: null, source: 'none' })
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

describe('resolveJobCurrentPercentFallback (chart value point)', () => {
  it('J523 shape: paid progress bill + office 63 → 63, not 100', () => {
    expect(
      resolveJobCurrentPercentFallback({ pct_complete: 63, invoices: [{ status: 'paid', amount: 81_916.6 }], revenue: 123_600 }),
    ).toBe(63)
  })
  it('fully billed and paid → 100', () => {
    expect(
      resolveJobCurrentPercentFallback({ pct_complete: 63, invoices: [{ status: 'paid', amount: 123_600 }], revenue: 123_600 }),
    ).toBe(100)
  })
})

describe('formatJobSummaryPercentComplete', () => {
  it('formats percent and em-dash for null', () => {
    expect(formatJobSummaryPercentComplete(62)).toBe('62%')
    expect(formatJobSummaryPercentComplete(0)).toBe('0%')
    expect(formatJobSummaryPercentComplete(null)).toBe('—')
  })
})

describe('every % source has a provenance badge (v2.2852)', () => {
  it('the resolver’s three real sources map to a badge; "none" maps to no badge', () => {
    const sources: JobSummaryPercentSource[] = ['paid-invoices', 'crew-report', 'office', 'none']
    const labels = sources.map((s) => percentProvenanceLabel(s))
    expect(labels).toEqual(['fully collected', 'crew report', 'set by office', null])
  })
  it('a resolved row carries a source the badge can name', () => {
    const paid = resolveJobSummaryPercentCompleteWithSource(77, 63, {
      invoicesAllPaidWithAmount: true,
      invoicedTotalUsd: 10_000,
      contractRevenueUsd: 10_000,
    })
    expect(percentProvenanceLabel(paid.source)).toBe('fully collected')
    const progressBill = resolveJobSummaryPercentCompleteWithSource(77, 63, {
      invoicesAllPaidWithAmount: true,
      invoicedTotalUsd: 6_600,
      contractRevenueUsd: 10_000,
    })
    expect(progressBill.pct).toBe(77)
    expect(percentProvenanceLabel(progressBill.source, { reportedOn: '2026-08-27T19:00:00Z' })).toBe('crew report Aug 27')
    expect(percentProvenanceLabel(resolveJobSummaryPercentCompleteWithSource(null, 63).source)).toBe('set by office')
    expect(percentProvenanceLabel(resolveJobSummaryPercentCompleteWithSource(null, null).source)).toBeNull()
  })
})
