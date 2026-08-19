import { describe, expect, it } from 'vitest'
import type { JobWithDetails } from '../../types/jobWithDetails'
import {
  assembleLeanStatsJobs,
  computeStagesHeaderStats,
  type LeanStatsInvoiceRow,
  type LeanStatsJobRow,
  type LeanStatsPaymentRow,
} from './stagesHeaderStats'

const NOW = new Date('2026-08-19T18:00:00Z')
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 86400000).toISOString().slice(0, 10)

type Inv = {
  id: string
  amount: number
  status: string
  sequence_order?: number
  is_primary_rtb_bundle?: boolean
  estimated_bill_date?: string | null
}
type Pay = { invoice_id: string | null; amount: number }

function job(
  id: string,
  o: {
    status: string | null
    revenue: number
    payments_made?: number
    pct_complete?: number | null
    collections_at?: string | null
    invoices?: Inv[]
    payments?: Pay[]
  },
): JobWithDetails {
  return {
    id,
    status: o.status,
    revenue: o.revenue,
    payments_made: o.payments_made ?? 0,
    pct_complete: o.pct_complete ?? null,
    collections_at: o.collections_at ?? null,
    hcp_number: id.replace(/\D/g, '') || '1',
    click_number: null,
    invoices: (o.invoices ?? []).map((i, n) => ({
      id: i.id,
      job_id: id,
      amount: i.amount,
      status: i.status,
      sequence_order: i.sequence_order ?? n + 1,
      is_primary_rtb_bundle: i.is_primary_rtb_bundle ?? null,
      estimated_bill_date: i.estimated_bill_date ?? null,
    })),
    payments: (o.payments ?? []).map((p, n) => ({ job_id: id, invoice_id: p.invoice_id, amount: p.amount, sequence_order: n + 1 })),
    materials: [],
    fixtures: [],
    team_members: [],
  } as unknown as JobWithDetails
}

/** Every bundling branch: implicit sole-RTB merge, primary bundle + extra,
 * split shell, working job with RTB + a stray billed invoice, billed merged /
 * shell, collections, aging buckets, paid. */
const FULL: JobWithDetails[] = [
  job('w1', { status: 'waiting', revenue: 1000, payments_made: 100 }),
  job('k1', {
    status: 'working',
    revenue: 2000,
    pct_complete: 50,
    invoices: [{ id: 'k1-b', amount: 400, status: 'billed', estimated_bill_date: daysAgo(45) }],
    payments: [{ invoice_id: 'k1-b', amount: 150 }],
  }),
  job('w2', {
    status: 'working',
    revenue: 600,
    invoices: [{ id: 'w2-r', amount: 250, status: 'ready_to_bill' }],
  }),
  job('r1', { status: 'ready_to_bill', revenue: 1500, invoices: [{ id: 'r1-a', amount: 1500, status: 'ready_to_bill' }] }),
  job('r2', {
    status: 'ready_to_bill',
    revenue: 1000,
    invoices: [
      { id: 'r2-a', amount: 300, status: 'ready_to_bill', is_primary_rtb_bundle: true },
      { id: 'r2-b', amount: 200, status: 'ready_to_bill' },
    ],
  }),
  job('r3', { status: 'ready_to_bill', revenue: 800, invoices: [{ id: 'r3-a', amount: 500, status: 'ready_to_bill' }] }),
  job('b1', {
    status: 'billed',
    revenue: 900,
    invoices: [{ id: 'b1-a', amount: 900, status: 'billed', estimated_bill_date: daysAgo(100) }],
    payments: [{ invoice_id: 'b1-a', amount: 400 }],
  }),
  job('b2', {
    status: 'billed',
    revenue: 700,
    collections_at: '2026-08-01',
    invoices: [{ id: 'b2-a', amount: 700, status: 'billed' }],
  }),
  job('b3', { status: 'billed', revenue: 350, payments_made: 50 }),
  job('p1', { status: 'paid', revenue: 5000, payments_made: 5000 }),
]

function stripToLean(jobs: JobWithDetails[]): {
  jobRows: LeanStatsJobRow[]
  invoiceRows: LeanStatsInvoiceRow[]
  paymentRows: LeanStatsPaymentRow[]
} {
  return {
    jobRows: jobs.map((j) => ({
      id: j.id,
      status: j.status,
      revenue: j.revenue,
      payments_made: j.payments_made,
      pct_complete: j.pct_complete,
      collections_at: j.collections_at,
      hcp_number: j.hcp_number,
      click_number: j.click_number,
    })),
    invoiceRows: jobs.flatMap((j) =>
      (j.invoices ?? []).map((i) => ({
        id: i.id,
        job_id: j.id,
        amount: i.amount,
        status: i.status,
        sequence_order: i.sequence_order,
        is_primary_rtb_bundle: i.is_primary_rtb_bundle ?? null,
        estimated_bill_date: i.estimated_bill_date ?? null,
      })),
    ),
    paymentRows: jobs.flatMap((j) =>
      (j.payments ?? []).map((p) => ({ job_id: j.id, invoice_id: p.invoice_id, amount: p.amount })),
    ),
  }
}

describe('computeStagesHeaderStats', () => {
  it('matches the board header formulas exactly (hand-computed fixture)', () => {
    const s = computeStagesHeaderStats(FULL, NOW)
    expect(s.waiting).toEqual({ count: 1, total: 900 })
    // Working: k1 (2000−0) + w2 (600−0).
    expect(s.working).toEqual({ count: 2, total: 2600 })
    // RTB rows: r1 sole-merge (1) + r2 primary+extra (2) + r3 shell+invoice (2) + w2 invoice-only (1).
    // Exposure: 1500 + (300+200) + (300 shell unalloc + 500) + 250.
    expect(s.readyToBill).toEqual({ count: 6, total: 3050 })
    // Billed rows: b1 merged (900−400=500) + b3 shell (350−50=300) + k1 stray billed invoice (400−150=250).
    expect(s.billed).toEqual({ count: 3, total: 1050 })
    expect(s.collections).toEqual({ count: 1, total: 700 })
    expect(s.paid).toEqual({ count: 1 })
    // Aging over non-collections billed rows with est dates: k1-b at 45d (250), b1-a at 100d (500).
    expect(s.billedAging).toEqual({ count30_90: 1, sum30_90: 250, count90: 1, sum90: 500 })
    expect(s.capableToBill).toBeGreaterThan(0)
  })

  it('lean-assembled rows produce IDENTICAL stats to full objects (parity by construction)', () => {
    const { jobRows, invoiceRows, paymentRows } = stripToLean(FULL)
    const lean = assembleLeanStatsJobs(jobRows, invoiceRows, paymentRows)
    expect(computeStagesHeaderStats(lean, NOW)).toEqual(computeStagesHeaderStats(FULL, NOW))
  })

  it('empty board → all zeros', () => {
    const s = computeStagesHeaderStats([], NOW)
    expect(s.waiting).toEqual({ count: 0, total: 0 })
    expect(s.readyToBill).toEqual({ count: 0, total: 0 })
    expect(s.billedAging).toEqual({ count30_90: 0, sum30_90: 0, count90: 0, sum90: 0 })
  })
})
