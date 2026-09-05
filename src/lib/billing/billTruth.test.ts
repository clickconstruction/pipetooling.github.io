import { describe, expect, it } from 'vitest'
import {
  appliedByInvoiceId,
  billIsOnPaidJob,
  billOnOpenJob,
  computeBillTruth,
  computeBillTruthFromJobs,
  jobBilledContribution,
  jobPrintsBilledShell,
  lifetimeCollected,
  openBillRowsForJob,
  openRemainder,
  type BillTruthInvoice,
  type BillTruthJob,
  type BillTruthPayment,
} from './billTruth'
import { isPaidJobStatus } from '../../../supabase/functions/_shared/paidJobBillGuard'
import { jobCarriesOpenBills, jobPrintsShellRemainder } from '../../../supabase/functions/_shared/portalBillMembership'
import { assembleLeanStatsJobs, computeStagesHeaderStats } from '../jobs/stagesHeaderStats'
import { buildJobsStagesBoardLists, buildReadyToBillStageRows } from '../jobsStagesBoard'
import { stageRowBilledRemainingAmount } from '../jobs/invoiceBilling'
import { buildReadyToBillDashboardUnits } from '../buildReadyToBillDashboardUnits'

function job(id: string, o: Partial<BillTruthJob> = {}): BillTruthJob {
  return { id, status: 'billed', revenue: 0, payments_made: 0, collections_at: null, ...o }
}
function inv(id: string, job_id: string, amount: number, status = 'billed'): BillTruthInvoice {
  return { id, job_id, amount, status }
}
function pay(invoice_id: string | null, amount: number | null): BillTruthPayment {
  return { invoice_id, amount }
}

describe('billTruth — rule primitives', () => {
  it('openRemainder is the one clamp: never negative, nulls read 0', () => {
    expect(openRemainder(1000, 400)).toBe(600)
    expect(openRemainder(220, 300)).toBe(0)
    expect(openRemainder(null, 5)).toBe(0)
    expect(openRemainder(50, null)).toBe(50)
  })

  it('agrees with the _shared server twins on every real job status', () => {
    for (const s of ['waiting', 'working', 'ready_to_bill', 'billed', 'paid', 'archived']) {
      expect(billOnOpenJob(s)).toBe(jobCarriesOpenBills(s))
      expect(jobPrintsBilledShell(s)).toBe(jobPrintsShellRemainder(s))
      expect(billIsOnPaidJob(s)).toBe(isPaidJobStatus(s))
    }
  })

  it('the one deliberate client difference: NULL / empty status is the board\'s "working" (open)', () => {
    expect(billOnOpenJob(null)).toBe(true)
    expect(billOnOpenJob(undefined)).toBe(true)
    expect(billOnOpenJob('')).toBe(true)
    // …while the SQL mirror excludes NULL like `j.status <> 'paid'` does.
    expect(jobCarriesOpenBills(null)).toBe(false)
    expect(jobCarriesOpenBills('')).toBe(false)
  })

  it('lifetime billed: invoices win, billed/paid shells fall back to revenue, nothing else counts', () => {
    expect(jobBilledContribution({ status: 'paid', revenue: 5000 }, [])).toBe(5000)
    expect(jobBilledContribution({ status: 'billed', revenue: 900 }, [])).toBe(900)
    expect(jobBilledContribution({ status: 'billed', revenue: 900 }, [inv('a', 'j', 1000), inv('b', 'j', 50, 'ready_to_bill')])).toBe(1000)
    expect(jobBilledContribution({ status: 'paid', revenue: 900 }, [inv('a', 'j', 400, 'paid')])).toBe(400)
    expect(jobBilledContribution({ status: 'working', revenue: 900 }, [])).toBe(0)
    expect(jobBilledContribution({ status: 'working', revenue: 900 }, [inv('a', 'j', 300)])).toBe(300)
  })

  it('lifetime collected counts job-level (record-only) payments too', () => {
    expect(lifetimeCollected([pay('i1', 400), pay(null, 5000), pay('i2', null)])).toBe(5400)
  })

  it('openBillRowsForJob: paid job → nothing; billed rows net linked payments; shell only when no billed row', () => {
    const applied = appliedByInvoiceId([pay('i1', 400), pay(null, 999)])
    expect(openBillRowsForJob(job('p', { status: 'paid', revenue: 5000 }), [inv('x', 'p', 500)], applied)).toEqual([])
    const rows = openBillRowsForJob(job('j', { revenue: 2000 }), [inv('i1', 'j', 1000), inv('d', 'j', 50, 'ready_to_bill')], applied)
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ kind: 'invoice', invoiceId: 'i1', billed: 1000, applied: 400, remaining: 600, settled: false })
    const shell = openBillRowsForJob(job('s', { revenue: 900, payments_made: 200 }), [], applied)
    expect(shell[0]).toMatchObject({ kind: 'shell', invoiceId: null, billed: 900, applied: 200, remaining: 700 })
    // a working job with no billed line has nothing owed yet — no invented shell debt
    expect(openBillRowsForJob(job('w', { status: 'working', revenue: 900 }), [], applied)).toEqual([])
  })
})

describe('billTruth — the journey specimens', () => {
  it('J3-1: never-sent drafts on Paid-in-Full jobs (688 · $5,500, 903 · $185) are not Ready to Bill', () => {
    const t = computeBillTruth({
      jobs: [job('688', { status: 'paid', revenue: 5500, payments_made: 5500 }), job('903', { status: 'paid', revenue: 185, payments_made: 185 }), job('w1', { status: 'working', revenue: 4000 })],
      invoices: [inv('d688', '688', 5500, 'ready_to_bill'), inv('d903', '903', 185, 'ready_to_bill'), inv('dw1', 'w1', 1200, 'ready_to_bill')],
      payments: [],
    })
    expect(t.readyToBill.count).toBe(1)
    expect(t.readyToBill.total).toBe(1200)
    expect(t.onPaidJobs.count).toBe(2)
    expect(t.onPaidJobs.total).toBe(5685)
    expect(t.paidInFull.jobCount).toBe(2)
    // drafts are not owed money, so nothing is "excluded from Owed"
    expect(t.excludedOwed).toEqual({ count: 0, total: 0 })
  })

  it('J4-1/2: the $488 orphan (billed invoice, job missing) is excluded from Owed and reported', () => {
    const t = computeBillTruth({
      jobs: [job('b1', { revenue: 1000 })],
      invoices: [inv('i1', 'b1', 1000), inv('ghost', 'deleted-job', 488)],
      payments: [],
    })
    expect(t.owed).toEqual({ count: 1, total: 1000 })
    expect(t.orphans.count).toBe(1)
    expect(t.excludedOwed).toEqual({ count: 1, total: 488 })
  })

  it('J4-1 (b): a fully-paid bill never marked Paid stays a member at $0, settled, so counts agree everywhere', () => {
    const t = computeBillTruth({
      jobs: [job('j', { revenue: 1500 })],
      invoices: [inv('open', 'j', 1000), inv('done', 'j', 500)],
      payments: [pay('done', 500)],
    })
    expect(t.billed.count).toBe(2)
    expect(t.billed.total).toBe(1000)
    expect(t.billed.rows.find((r) => r.invoiceId === 'done')).toMatchObject({ remaining: 0, settled: true })
  })

  it('J34-N6: a negative shell balance clamps to 0 once and never nets against another job', () => {
    const t = computeBillTruth({
      jobs: [job('over', { revenue: 220, payments_made: 300 }), job('owed', { revenue: 1000, payments_made: 0 })],
      invoices: [],
      payments: [],
    })
    expect(t.billed.rows.map((r) => r.remaining)).toEqual([0, 1000])
    expect(t.owed.total).toBe(1000) // not 920
    expect(t.billed.rows[0]!.settled).toBe(true)
  })

  it('decision 6 / J21: billed invoices on working jobs are owed (2 billed-job + 5 working-job bills = 7 / $38,036.27)', () => {
    const jobs = [job('b1'), job('b2'), job('977', { status: 'working' }), job('963', { status: 'working' }), job('978', { status: 'working' })]
    const invoices = [
      inv('a', 'b1', 10_000),
      inv('b', 'b2', 9_453.47),
      inv('c', '977', 4_000),
      inv('d', '977', 3_500),
      inv('e', '963', 5_000),
      inv('f', '978', 3_082.8),
      inv('g', '978', 3_000),
    ]
    const t = computeBillTruth({ jobs, invoices, payments: [] })
    expect(t.owed.count).toBe(7)
    expect(t.owed.total).toBeCloseTo(38_036.27, 2)
  })

  it('splits Collections by the job flag; a flagged job with one paid and one open bill lands one row in each state', () => {
    const t = computeBillTruth({
      jobs: [job('c', { collections_at: '2026-07-01T00:00:00Z', revenue: 500 }), job('b', { revenue: 300 })],
      invoices: [inv('paid', 'c', 200), inv('open', 'c', 300), inv('x', 'b', 300)],
      payments: [pay('paid', 200)],
    })
    expect(t.collections.count).toBe(2)
    expect(t.collections.total).toBe(300)
    expect(t.billed).toMatchObject({ count: 1, total: 300 })
    expect(t.owed).toEqual({ count: 3, total: 600 })
  })

  it('computeBillTruthFromJobs (embedded rows) equals computeBillTruth (flat rows)', () => {
    const flat = computeBillTruth({
      jobs: [job('a', { revenue: 1000 }), job('w', { status: 'working' })],
      invoices: [inv('i1', 'a', 1000), inv('i2', 'w', 250), inv('r', 'w', 100, 'ready_to_bill')],
      payments: [pay('i1', 100)],
    })
    const embedded = computeBillTruthFromJobs([
      { ...job('a', { revenue: 1000 }), invoices: [{ id: 'i1', status: 'billed', amount: 1000 }], payments: [pay('i1', 100)] },
      { ...job('w', { status: 'working' }), invoices: [{ id: 'i2', status: 'billed', amount: 250 }, { id: 'r', status: 'ready_to_bill', amount: 100 }], payments: [] },
    ])
    expect(embedded).toEqual(flat)
  })
})

describe('billTruth — the Pipeline board is the same truth (spine parity)', () => {
  const jobRows = [
    { id: 'shell-neg', status: 'billed', revenue: 220, payments_made: 300 },
    { id: 'shell-pos', status: 'billed', revenue: 900, payments_made: 200 },
    { id: 'multi', status: 'billed', revenue: 3000, payments_made: 0 },
    { id: 'coll', status: 'billed', revenue: 800, payments_made: 0, collections_at: '2026-07-01T00:00:00Z' },
    { id: 'working', status: 'working', revenue: 5000, payments_made: 0 },
    { id: 'rtb', status: 'ready_to_bill', revenue: 1000, payments_made: 0 },
    { id: 'waiting', status: 'waiting', revenue: 100, payments_made: 0 },
    { id: 'paid', status: 'paid', revenue: 185, payments_made: 185 },
    { id: 'nullstatus', status: null, revenue: 700, payments_made: 0 },
  ].map((j) => ({ pct_complete: null, collections_at: null, hcp_number: j.id, click_number: null, customer_id: null, gc_customer_id: null, ...j }))
  const invoiceRows = [
    { id: 'm1', job_id: 'multi', amount: 1000, status: 'billed' },
    { id: 'm2', job_id: 'multi', amount: 2000, status: 'billed' },
    { id: 'c1', job_id: 'coll', amount: 800, status: 'billed' },
    { id: 'w1', job_id: 'working', amount: 1500, status: 'billed' },
    { id: 'w-draft', job_id: 'working', amount: 500, status: 'ready_to_bill' },
    { id: 'n1', job_id: 'nullstatus', amount: 700, status: 'billed' },
    { id: 'rtb-primary', job_id: 'rtb', amount: 1000, status: 'ready_to_bill', is_primary_rtb_bundle: true },
    { id: 'paid-draft', job_id: 'paid', amount: 185, status: 'ready_to_bill' },
  ].map((i, n) => ({ sequence_order: n + 1, is_primary_rtb_bundle: null, estimated_bill_date: null, billed_at: null, ...i }))
  const paymentRows = [
    { job_id: 'multi', invoice_id: 'm1', amount: 1000, paid_on: '2026-08-01' },
    { job_id: 'working', invoice_id: 'w1', amount: 200, paid_on: '2026-08-02' },
  ]

  it('billed / collections counts and totals equal the board rows summed with stageRowBilledRemainingAmount', () => {
    const assembled = assembleLeanStatsJobs(jobRows, invoiceRows, paymentRows)
    const lists = buildJobsStagesBoardLists(assembled, '')
    const truth = computeBillTruthFromJobs(assembled)
    expect(truth.billed.count).toBe(lists.billedActiveRows.length)
    expect(truth.billed.total).toBeCloseTo(lists.billedActiveRows.reduce((s, r) => s + stageRowBilledRemainingAmount(r), 0), 6)
    expect(truth.collections.count).toBe(lists.collectionsRows.length)
    expect(truth.collections.total).toBeCloseTo(lists.collectionsRows.reduce((s, r) => s + stageRowBilledRemainingAmount(r), 0), 6)
    // the negative shell contributes a $0 member, not −$80
    expect(truth.billed.total).toBeCloseTo(700 + 0 + 2000 + (1500 - 200) + 700, 6)
    expect(truth.billed.count).toBe(6)
    // the header stats read the same numbers
    const stats = computeStagesHeaderStats(assembled)
    expect(stats.billed).toEqual({ count: truth.billed.count, total: truth.billed.total })
    expect(stats.collections).toEqual({ count: truth.collections.count, total: truth.collections.total })
    expect(stats.paid.count).toBe(truth.paidInFull.jobCount)
  })

  it('Ready to Bill membership: the paid job\'s draft is excluded by kernel, board and Dashboard alike', () => {
    const assembled = assembleLeanStatsJobs(jobRows, invoiceRows, paymentRows)
    const lists = buildJobsStagesBoardLists(assembled, '')
    const truth = computeBillTruthFromJobs(assembled)
    expect(truth.readyToBill.invoices.map((i) => i.id).sort()).toEqual(['rtb-primary', 'w-draft'])
    expect(truth.onPaidJobs.invoices.map((i) => i.id)).toEqual(['paid-draft'])
    const boardRows = buildReadyToBillStageRows(lists.readyToBillJobs)
    const dashUnits = buildReadyToBillDashboardUnits(
      jobRows.filter((j) => j.status === 'ready_to_bill'),
      invoiceRows
        .filter((i) => i.status === 'ready_to_bill')
        .map((i) => ({ ...i, job_status: jobRows.find((j) => j.id === i.job_id)?.status ?? null })),
    )
    expect(boardRows.length).toBe(dashUnits.length)
    expect(boardRows.length).toBe(2)
  })
})
