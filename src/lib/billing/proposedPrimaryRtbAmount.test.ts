import { describe, expect, it } from 'vitest'
import {
  PRIMARY_RTB_MESSAGES,
  otherOpenInvoiceAmounts,
  planPrimaryRtbForBillCustomer,
  proposedPrimaryRtbAmount,
  type PrimaryRtbPlanInvoice,
} from './proposedPrimaryRtbAmount'

const RTB = { status: 'ready_to_bill', revenue: 3630, payments_made: 0 }

function inv(p: Partial<PrimaryRtbPlanInvoice> & { id: string }): PrimaryRtbPlanInvoice {
  return {
    status: 'ready_to_bill',
    amount: 0,
    is_primary_rtb_bundle: false,
    stripe_invoice_id: null,
    hosted_invoice_url: null,
    ...p,
  }
}

describe('proposedPrimaryRtbAmount — the RPC remainder in cents', () => {
  it('is revenue − payments − other open invoices, clamped at zero', () => {
    expect(proposedPrimaryRtbAmount({ revenue: 1000, payments: 250, otherOpenInvoices: [300] })).toBe(450)
    expect(proposedPrimaryRtbAmount({ revenue: 1000, payments: 900, otherOpenInvoices: [300] })).toBe(0)
  })

  it('does float math in cents (0.1 + 0.2 territory)', () => {
    expect(proposedPrimaryRtbAmount({ revenue: 0.3, payments: 0.1, otherOpenInvoices: [0.1] })).toBe(0.1)
    expect(proposedPrimaryRtbAmount({ revenue: 1234.56, payments: 0, otherOpenInvoices: [1234.55] })).toBe(0.01)
  })

  it('treats null / undefined as zero like COALESCE', () => {
    expect(proposedPrimaryRtbAmount({ revenue: null, payments: undefined, otherOpenInvoices: [null] })).toBe(0)
    expect(proposedPrimaryRtbAmount({ revenue: 500, payments: null, otherOpenInvoices: [] })).toBe(500)
  })
})

describe('otherOpenInvoiceAmounts — what counts against the remainder', () => {
  it('counts RTB partials and billed rows, never the RTB primary, never paid/void rows', () => {
    const rows = [
      inv({ id: 'primary', amount: 3000, is_primary_rtb_bundle: true }),
      inv({ id: 'partial', amount: 500 }),
      inv({ id: 'billed', amount: 200, status: 'billed' }),
      inv({ id: 'paid', amount: 999, status: 'paid' }),
      // A billed row flagged primary still counts (only the RTB primary is elastic).
      inv({ id: 'billed-primary', amount: 100, status: 'billed', is_primary_rtb_bundle: true }),
    ]
    expect(otherOpenInvoiceAmounts(rows).sort()).toEqual([100, 200, 500])
  })
})

describe('planPrimaryRtbForBillCustomer — RPC parity, branch for branch', () => {
  it('job not in Ready to Bill → the RPC error, verbatim', () => {
    expect(planPrimaryRtbForBillCustomer({ ...RTB, status: 'working' }, [])).toEqual({
      kind: 'blocked',
      reason: 'job_not_rtb',
      message: 'Job must be in Ready to Bill',
    })
  })

  it('no primary, remainder > 0, no RTB rows → the RPC would INSERT (created:true)', () => {
    expect(planPrimaryRtbForBillCustomer(RTB, [inv({ id: 'b', status: 'billed', amount: 630 })])).toEqual({
      kind: 'bill',
      amount: 3000,
      invoiceId: null,
      wouldCreate: true,
    })
  })

  it('no primary, exactly one RTB row already equal to the remainder → the RPC adopts it', () => {
    // The lone non-primary RTB row COUNTS against the remainder (v2.1134 sum),
    // so adoption needs revenue that leaves exactly that row's amount over.
    const plan = planPrimaryRtbForBillCustomer({ ...RTB, revenue: 7260 }, [inv({ id: 'only', amount: 3630 })])
    expect(plan).toEqual({ kind: 'bill', amount: 3630, invoiceId: 'only', wouldCreate: false })
  })

  it('no primary, one non-primary RTB row that IS the whole remainder → no remainder left (partials branch)', () => {
    const plan = planPrimaryRtbForBillCustomer(RTB, [inv({ id: 'only', amount: 3630 })])
    expect(plan).toEqual({
      kind: 'blocked',
      reason: 'no_remainder_partials',
      message: PRIMARY_RTB_MESSAGES.no_remainder_partials,
    })
  })

  it('no primary, one RTB partial NOT equal to the remainder → INSERT the difference', () => {
    // RPC: v_rtb_count = 1 but amount ≠ unalloc → falls through to INSERT of unalloc.
    const plan = planPrimaryRtbForBillCustomer(RTB, [inv({ id: 'partial', amount: 1000 })])
    expect(plan).toEqual({ kind: 'bill', amount: 2630, invoiceId: null, wouldCreate: true })
  })

  it('no primary, two RTB partials → INSERT the remainder (never adopts with 2+)', () => {
    const plan = planPrimaryRtbForBillCustomer(RTB, [
      inv({ id: 'p1', amount: 1000 }),
      inv({ id: 'p2', amount: 1000 }),
    ])
    expect(plan).toEqual({ kind: 'bill', amount: 1630, invoiceId: null, wouldCreate: true })
  })

  it('no primary, remainder 0, partial RTB rows exist → "No remainder to bill on the job bundle…"', () => {
    const plan = planPrimaryRtbForBillCustomer(RTB, [inv({ id: 'p1', amount: 3630 }), inv({ id: 'p2', amount: 1 })])
    expect(plan).toEqual({
      kind: 'blocked',
      reason: 'no_remainder_partials',
      message: PRIMARY_RTB_MESSAGES.no_remainder_partials,
    })
  })

  it('no primary, remainder 0, no RTB rows (all billed) → "Nothing left to bill for this job"', () => {
    const plan = planPrimaryRtbForBillCustomer(RTB, [inv({ id: 'b', status: 'billed', amount: 3630 })])
    expect(plan).toEqual({ kind: 'blocked', reason: 'nothing_left', message: 'Nothing left to bill for this job' })
  })

  it('one never-sent primary + remainder > 0 → RESIZE to the remainder (the primary itself does not count)', () => {
    // Job 978 shape: a stale $3,630 auto draft, then a $1,000 partial carved off.
    const plan = planPrimaryRtbForBillCustomer(RTB, [
      inv({ id: 'auto', amount: 3630, is_primary_rtb_bundle: true }),
      inv({ id: 'partial', amount: 1000 }),
    ])
    expect(plan).toEqual({ kind: 'bill', amount: 2630, invoiceId: 'auto', wouldCreate: false })
  })

  it('one never-sent primary + remainder 0 → fully allocated: the RPC would DELETE; here just "Nothing left"', () => {
    const plan = planPrimaryRtbForBillCustomer(RTB, [
      inv({ id: 'auto', amount: 3630, is_primary_rtb_bundle: true }),
      inv({ id: 'segment', amount: 3630 }),
    ])
    expect(plan).toEqual({
      kind: 'blocked',
      reason: 'fully_allocated',
      message: 'Nothing left to bill for this job — every dollar is already on an invoice.',
    })
  })

  it('a Stripe-finalized primary is returned as-is, never resized, even when the remainder differs', () => {
    const plan = planPrimaryRtbForBillCustomer(RTB, [
      inv({
        id: 'sent',
        amount: 3630,
        is_primary_rtb_bundle: true,
        stripe_invoice_id: 'in_123',
        hosted_invoice_url: 'https://invoice.stripe.com/i/abc',
      }),
      inv({ id: 'partial', amount: 500 }),
    ])
    expect(plan).toEqual({ kind: 'bill', amount: 3630, invoiceId: 'sent', wouldCreate: false })
  })

  it('a primary with a Stripe id but no hosted URL is NOT finalized → resizes like a draft', () => {
    const plan = planPrimaryRtbForBillCustomer(RTB, [
      inv({ id: 'half', amount: 3630, is_primary_rtb_bundle: true, stripe_invoice_id: 'in_123', hosted_invoice_url: '  ' }),
      inv({ id: 'partial', amount: 500 }),
    ])
    expect(plan).toEqual({ kind: 'bill', amount: 3130, invoiceId: 'half', wouldCreate: false })
  })

  it('two RTB primaries → the RPC integrity error', () => {
    const plan = planPrimaryRtbForBillCustomer(RTB, [
      inv({ id: 'a', amount: 1, is_primary_rtb_bundle: true }),
      inv({ id: 'b', amount: 1, is_primary_rtb_bundle: true }),
    ])
    expect(plan.kind).toBe('blocked')
    if (plan.kind === 'blocked') expect(plan.reason).toBe('multiple_primary')
  })

  it('payments reduce the remainder before allocation does', () => {
    const plan = planPrimaryRtbForBillCustomer({ ...RTB, payments_made: 630 }, [
      inv({ id: 'auto', amount: 3630, is_primary_rtb_bundle: true }),
    ])
    expect(plan).toEqual({ kind: 'bill', amount: 3000, invoiceId: 'auto', wouldCreate: false })
  })
})
