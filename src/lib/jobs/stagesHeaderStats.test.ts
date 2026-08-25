import { describe, expect, it } from 'vitest'
import type { JobWithDetails } from '../../types/jobWithDetails'
import {
  assembleLeanStatsJobs,
  COLLECTED_DAYS,
  collectedByDayFromPayments,
  computeStagesHeaderStats,
  type LeanStatsInvoiceRow,
  type LeanStatsJobRow,
  type LeanStatsPaymentRow,
} from './stagesHeaderStats'
import { addDaysYmd } from '../emailSchedule/emailScheduleWeek'

const NOW = new Date('2026-08-19T18:00:00Z')
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 86400000).toISOString().slice(0, 10)

type Inv = {
  id: string
  amount: number
  status: string
  sequence_order?: number
  is_primary_rtb_bundle?: boolean
  estimated_bill_date?: string | null
  billed_at?: string | null
}
type Pay = { invoice_id: string | null; amount: number; paid_on?: string | null }

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
      billed_at: i.billed_at ?? null,
    })),
    payments: (o.payments ?? []).map((p, n) => ({
      job_id: id,
      invoice_id: p.invoice_id,
      amount: p.amount,
      paid_on: p.paid_on ?? null,
      sequence_order: n + 1,
    })),
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
    payments: [{ invoice_id: 'b1-a', amount: 400, paid_on: daysAgo(3) }],
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
      customer_id: j.customer_id ?? null,
      gc_customer_id: j.gcCustomer?.id ?? null,
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
        billed_at: (i as { billed_at?: string | null }).billed_at ?? null,
      })),
    ),
    paymentRows: jobs.flatMap((j) =>
      (j.payments ?? []).map((p) => ({
        job_id: j.id,
        invoice_id: p.invoice_id,
        amount: p.amount,
        paid_on: (p as { paid_on?: string | null }).paid_on ?? null,
      })),
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
    // b3 is the only billed row with a positive remainder and no billed_at/est date
    // (b1-a and k1-b carry est dates; b2 is Collections and excluded).
    expect(s.billedNoDate).toBe(1)
    // b1's $400 payment landed 3 days before NOW → 27th of the 30 daily buckets.
    expect(s.collectedByDay).toHaveLength(COLLECTED_DAYS)
    expect(s.collectedByDay[29]!.total).toBe(0)
    expect(s.collectedByDay[26]).toEqual({ dayYmd: '2026-08-16', total: 400 })
    expect(s.collectedByDay.reduce((t, d) => t + d.total, 0)).toBe(400)
  })

  it('lean-assembled rows produce IDENTICAL stats to full objects (parity by construction)', () => {
    const { jobRows, invoiceRows, paymentRows } = stripToLean(FULL)
    const lean = assembleLeanStatsJobs(jobRows, invoiceRows, paymentRows)
    expect(computeStagesHeaderStats(lean, NOW)).toEqual(computeStagesHeaderStats(FULL, NOW))
  })

  it('bounded fetch simulation (v2.1917) matches the unbounded path, with paid count + collected overridden', () => {
    // A paid job whose recent unlinked payment must still land in collectedByDay.
    const paidWithRecentPayment = job('p2', {
      status: 'paid',
      revenue: 100,
      payments_made: 100,
      payments: [{ invoice_id: null, amount: 100, paid_on: daysAgo(5) }],
    })
    const all = [...FULL, paidWithRecentPayment]
    const { jobRows, invoiceRows, paymentRows } = stripToLean(all)

    // Mirror the four bounded queries in fetchStagesHeaderStats:
    const windowStart = addDaysYmd(NOW.toISOString().slice(0, 10), -(COLLECTED_DAYS - 1))
    const activeJobRows = jobRows.filter(
      (j) => j.status == null || ['waiting', 'working', 'ready_to_bill', 'billed'].includes(j.status),
    )
    const paidCount = jobRows.filter((j) => j.status === 'paid').length
    const activeInvoiceRows = invoiceRows.filter((i) => i.status === 'ready_to_bill' || i.status === 'billed')
    const boundedPaymentRows = paymentRows.filter(
      (p) => p.invoice_id != null || (p.paid_on != null && p.paid_on >= windowStart),
    )

    const bounded = {
      ...computeStagesHeaderStats(assembleLeanStatsJobs(activeJobRows, activeInvoiceRows, boundedPaymentRows), NOW),
      paid: { count: paidCount },
      collectedByDay: collectedByDayFromPayments(boundedPaymentRows, NOW),
    }
    expect(bounded).toEqual(computeStagesHeaderStats(all, NOW))
  })

  it('documented delta: a billed invoice stranded on a paid job drops out of the bounded stats', () => {
    const stranded = job('p3', {
      status: 'paid',
      revenue: 200,
      invoices: [{ id: 'p3-b', amount: 200, status: 'billed', estimated_bill_date: daysAgo(40) }],
    })
    const all = [...FULL, stranded]
    const full = computeStagesHeaderStats(all, NOW)
    // Full path surfaces the stray invoice as an extra Billed row + aging entry…
    expect(full.billed.count).toBe(4)
    expect(full.billedAging.count30_90).toBe(2)

    const { jobRows, invoiceRows, paymentRows } = stripToLean(all)
    const activeJobRows = jobRows.filter(
      (j) => j.status == null || ['waiting', 'working', 'ready_to_bill', 'billed'].includes(j.status),
    )
    const activeInvoiceRows = invoiceRows.filter((i) => i.status === 'ready_to_bill' || i.status === 'billed')
    const bounded = computeStagesHeaderStats(
      assembleLeanStatsJobs(activeJobRows, activeInvoiceRows, paymentRows),
      NOW,
    )
    // …the bounded path drops it (paid job rows aren't fetched; orphan invoices are discarded).
    expect(bounded.billed.count).toBe(3)
    expect(bounded.billedAging.count30_90).toBe(1)
  })

  it('empty board → all zeros', () => {
    const s = computeStagesHeaderStats([], NOW)
    expect(s.waiting).toEqual({ count: 0, total: 0 })
    expect(s.readyToBill).toEqual({ count: 0, total: 0 })
    expect(s.billedAging).toEqual({ count30_90: 0, sum30_90: 0, count90: 0, sum90: 0 })
    expect(s.billedNoDate).toBe(0)
    expect(s.collectedByDay).toHaveLength(COLLECTED_DAYS)
    expect(s.collectedByDay.every((d) => d.total === 0)).toBe(true)
  })
})
