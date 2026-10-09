/**
 * One rule for a payment put on the job with no bill picked (v2.5006; the owner's call of 2026-10-09):
 * the Billed board, its header (bill truth), GC Review and the GC statement — the client's and the
 * scheduled dispatch's — count it as the portal, the bill paper and the demand letter already did:
 * the part of the job on no bill first, then the sent bills oldest first (`attributeJobPayments`).
 * Each shape runs through every reader, so they cannot drift apart again.
 */
import { describe, expect, it } from 'vitest'
import type { JobWithDetails } from '../../types/jobWithDetails'
import { buildJobsStagesBoardLists, billedStageRowRemainingAmount, jobCapableToBillAmounts, jobOpenBillingRemainderDollars, type StageRow } from '../jobsStagesBoard'
import { jobsMapJobs, jobsMapOwedLine } from './jobsMap'
import { jobBilledUnpaidDollars, stageRowBilledRemainingAmount } from './invoiceBilling'
import { billAppliedOnJob } from './billApplied'
import { appliedByInvoiceUnderRule, computeBillTruth, computeBillTruthFromJobs } from '../billing/billTruth'
import { buildGcReviewRollup } from '../gcReviewRollup'
import {
  applyPaymentRule,
  statementBillsOf,
  type GcStatementPayload,
  type GcStatementPayloadRow,
} from '../../../supabase/functions/gc-statement-email-dispatch/render'

type Bill = { id: string; amount: number; status?: string; linked?: number }
type Shape = { revenue: number; bills: Bill[]; untied: Array<[amount: number, paidOn: string]> }

function makeJob(id: string, s: Shape): JobWithDetails {
  const invoices = s.bills.map((b, i) => ({
    id: b.id,
    job_id: id,
    amount: b.amount,
    status: b.status ?? 'billed',
    sequence_order: i,
    billed_at: `2026-0${i + 3}-16T17:00:00Z`,
    estimated_bill_date: null,
    is_primary_rtb_bundle: false,
  }))
  const payments = [
    ...s.bills.filter((b) => b.linked).map((b, i) => ({ id: `${id}-l${i}`, job_id: id, invoice_id: b.id, amount: b.linked!, paid_on: '2026-04-01', payment_type: 'check', reference_number: `L${i}`, sequence_order: null })),
    ...s.untied.map(([amount, paidOn], i) => ({ id: `${id}-u${i}`, job_id: id, invoice_id: null, amount, paid_on: paidOn, payment_type: 'check', reference_number: `${1000 + i}`, sequence_order: null })),
  ]
  const paid = payments.reduce((t, p) => t + p.amount, 0)
  return {
    id,
    status: 'billed',
    revenue: s.revenue,
    payments_made: paid,
    hcp_number: id,
    click_number: '',
    job_name: `Job ${id}`,
    job_address: `${id} Main St`,
    customer_name: 'Ridgeway Builders',
    gc_customer_id: 'gc-ridgeway',
    gcCustomer: { id: 'gc-ridgeway', name: 'Ridgeway Builders' },
    bill_to_party: 'gc',
    invoices,
    payments,
    materials: [],
    fixtures: [],
    team_members: [],
  } as unknown as JobWithDetails
}

/** Job 273 as it stood on 2026-10-09: a $56,365 job, three bills adding to $17,585, $39,680 on the job with no bill picked. */
const J273: Shape = {
  revenue: 56365,
  bills: [
    { id: 'b0', amount: 13420 },
    { id: 'b1', amount: 665 },
    { id: 'b2', amount: 3500 },
  ],
  untied: [
    [12000, '2025-10-10'],
    [1200, '2025-11-11'],
    [8880, '2025-12-19'],
    [17600, '2026-03-10'],
  ],
}
const three = (untied: Shape['untied']): Shape => ({
  revenue: 1750,
  bills: [
    { id: 'c0', amount: 1000 },
    { id: 'c1', amount: 500 },
    { id: 'c2', amount: 250 },
  ],
  untied,
})

const billedRows = (j: JobWithDetails): StageRow[] => buildJobsStagesBoardLists([j], '').billedActiveRows
const remainingByBill = (rows: StageRow[]) => rows.map((r) => [r.kind === 'job' ? null : r.inv.id, stageRowBilledRemainingAmount(r)])

describe('the board, its header and GC Review read one rule', () => {
  const cases: Array<[name: string, shape: Shape, remaining: number[]]> = [
    ['job 273: the off-bill work takes $38,780, the oldest bill the $900 left', J273, [12520, 665, 3500]],
    ['one untied payment covers all three bills, oldest first', three([[1750, '2026-05-01']]), [0, 0, 0]],
    ['a partial payment pays the oldest bill, then part of the next', three([[1200, '2026-05-01']]), [0, 300, 250]],
    ['an overpayment pays every bill and leaves its surplus on no bill', three([[2000, '2026-05-01']]), [0, 0, 0]],
  ]
  for (const [name, shape, remaining] of cases) {
    it(name, () => {
      const j = makeJob('273', shape)
      const rows = billedRows(j)
      const ids = shape.bills.map((b) => b.id)
      expect(remainingByBill(rows)).toEqual(ids.map((id, i) => [id, remaining[i]]))
      expect(rows.map((r) => billedStageRowRemainingAmount(r))).toEqual(remaining)
      const total = remaining.reduce((t, n) => t + n, 0)
      expect(jobBilledUnpaidDollars(j)).toBe(total)
      const truth = computeBillTruthFromJobs([j])
      expect(truth.billed.rows.map((r) => r.remaining)).toEqual(remaining)
      expect(truth.billed.total).toBe(total)
      const review = buildGcReviewRollup(rows, [], { now: new Date('2026-10-09T12:00:00Z') })
      expect(review.grandTotal).toBe(total)
    })
  }

  it("job 273's first bill names the $900 share of the March check, not the whole check", () => {
    const j = makeJob('273', J273)
    const review = buildGcReviewRollup(billedRows(j), [], { now: new Date('2026-10-09T12:00:00Z') })
    const first = review.groups[0]!.rows.find((r) => r.key === 'b0')!
    expect(first.remaining).toBe(12520)
    expect(first.billPayments?.map((p) => [p.reference_number, Number(p.amount)])).toEqual([['1003', 900]])
    expect(review.groups[0]!.rows.find((r) => r.key === 'b1')!.billPayments).toEqual([])
    expect(first.unmatchedOnJob).toBe(39680)
  })

  it('linked money stays its bill\'s in full, and a ready-to-bill draft takes no unlinked money', () => {
    const j = makeJob('e', {
      revenue: 1500,
      bills: [
        { id: 'e0', amount: 1000, linked: 1200 },
        { id: 'e1', amount: 500 },
        { id: 'd2', amount: 300, status: 'ready_to_bill', linked: 50 },
      ],
      untied: [[400, '2026-05-01']],
    })
    expect(billAppliedOnJob(j, 'e0')).toBe(1200)
    expect(billAppliedOnJob(j, 'e1')).toBe(400)
    expect(billAppliedOnJob(j, 'd2')).toBe(50)
  })
})

describe('bill truth needs the job on each payment', () => {
  const j = makeJob('273', J273)
  const flatJobs = [{ id: j.id, status: j.status ?? null, revenue: j.revenue ?? null, payments_made: j.payments_made ?? null }]
  const flatInvoices = (j.invoices ?? []).map((i) => ({ id: i.id, job_id: j.id, status: i.status, amount: i.amount, sequence_order: i.sequence_order, billed_at: i.billed_at }))

  it('with job ids the flat rows read the rule; without them, linked money only, as before', () => {
    const withJob = (j.payments ?? []).map((p) => ({ invoice_id: p.invoice_id, amount: p.amount, job_id: j.id, paid_on: p.paid_on }))
    expect(computeBillTruth({ jobs: flatJobs, invoices: flatInvoices, payments: withJob }).billed.total).toBe(16685)
    const withoutJob = (j.payments ?? []).map((p) => ({ invoice_id: p.invoice_id, amount: p.amount }))
    expect(computeBillTruth({ jobs: flatJobs, invoices: flatInvoices, payments: withoutJob }).billed.total).toBe(17585)
  })

  it('a paid bill counts as billed work: leave it out and its amount reads as work on no bill, which takes the money the open bill was paid with', () => {
    // Why the board's lean read loads a job's paid bills once the job carries unlinked money.
    const jobs = [{ id: 'x', revenue: 1500 }]
    const bills = [
      { id: 'x0', job_id: 'x', status: 'paid', amount: 1000, sequence_order: 0 },
      { id: 'x1', job_id: 'x', status: 'billed', amount: 500, sequence_order: 1 },
    ]
    const payments = [
      { invoice_id: 'x0', amount: 1000, job_id: 'x', paid_on: '2026-03-01' },
      { invoice_id: null, amount: 500, job_id: 'x', paid_on: '2026-04-01' },
    ]
    expect(appliedByInvoiceUnderRule(jobs, bills, payments).get('x1')).toBe(500)
    expect(appliedByInvoiceUnderRule(jobs, [bills[1]!], payments).get('x1') ?? 0).toBe(0)
  })
})

describe('the scheduled statement nets each bill by the rule', () => {
  const j = makeJob('273', J273)
  const row = (bill: Bill, over: Partial<GcStatementPayloadRow> = {}): GcStatementPayloadRow => ({
    job_id: j.id,
    row_key: bill.id,
    display_number: '273',
    job_name: 'Job 273',
    job_address: '273 Main St',
    customer_name: 'Ridgeway Builders',
    ref_date: '2026-03-16',
    ref_is_estimate: false,
    age_days: 200,
    // The RPC's figure: the bill less its linked payments (none on 273).
    remaining: bill.amount,
    in_collections: false,
    invoice_id: bill.id,
    invoice_amount: bill.amount,
    retainage_held: null,
    job_bills: (j.invoices ?? []).map((i) => ({ id: i.id, amount: i.amount, status: i.status, sequence_order: i.sequence_order, billed_at: i.billed_at })),
    job_payments: (j.payments ?? []).map((p) => ({ invoice_id: p.invoice_id, amount: p.amount, paid_on: p.paid_on, payment_type: p.payment_type, reference_number: p.reference_number, sequence_order: p.sequence_order })),
    job_total: 56365,
    ...over,
  })
  const payload = (rows: GcStatementPayloadRow[]): GcStatementPayload =>
    ({
      generated_at: '2026-10-09T12:00:00Z',
      group_by: 'gc',
      include_collections: false,
      grand_total: rows.reduce((t, r) => t + r.remaining, 0),
      groups: [{ entity_id: 'gc-ridgeway', entity_name: 'Ridgeway Builders', is_no_entity: false, job_count: 1, subtotal: rows.reduce((t, r) => t + r.remaining, 0), oldest_age_days: 200, rows }],
    }) as GcStatementPayload

  it('job 273: $17,585 from the RPC becomes $16,685, the subtotal and the grand total with it', () => {
    const p = payload(J273.bills.map((b) => row(b)))
    expect(p.grand_total).toBe(17585)
    applyPaymentRule(p)
    expect(p.groups[0]!.rows.map((r) => r.remaining)).toEqual([12520, 665, 3500])
    expect(p.groups[0]!.subtotal).toBe(16685)
    expect(p.grand_total).toBe(16685)
    const bills = statementBillsOf(p.groups[0]!)
    expect((bills[0]!.payments ?? []).map((x) => [x.reference_number, Number(x.amount)])).toEqual([['1003', 900]])
  })

  it('a row whose job total was not read keeps the RPC figure: without it, off-bill money would land on the bills', () => {
    const p = payload(J273.bills.map((b) => row(b, { job_total: null })))
    applyPaymentRule(p)
    expect(p.groups[0]!.rows.map((r) => r.remaining)).toEqual([13420, 665, 3500])
    expect(p.grand_total).toBe(17585)
  })
})

describe('the open asks and the map read the rule too (v2.5017)', () => {
  it("job 273's open asks are $16,685, so its map pin says $16,685 owed", () => {
    const j = makeJob('273', J273)
    expect(jobOpenBillingRemainderDollars(j)).toBe(16685)
    const mapped = jobsMapJobs([j], new Date('2026-10-09T12:00:00Z')).jobs.concat(jobsMapJobs([j], new Date('2026-10-09T12:00:00Z')).noAddress)
    expect(mapped.map((m) => jobsMapOwedLine(m))).toEqual(['$16,685 owed'])
  })

  it('capable to bill takes the money off once: a fully billed and paid job reads 0, not −$900', () => {
    const working = { ...makeJob('273', J273), status: 'working', pct_complete: 100 } as JobWithDetails
    const { toBill, openBilling } = jobCapableToBillAmounts(working)
    expect(openBilling).toBe(16685)
    expect(toBill).toBe(0)
  })

  it('a draft keeps its linked money; unlinked money does not reach it', () => {
    const j = makeJob('d', {
      revenue: 1800,
      bills: [
        { id: 'd0', amount: 1000 },
        { id: 'd1', amount: 300, status: 'ready_to_bill', linked: 50 },
      ],
      untied: [[1200, '2026-05-01']],
    })
    // Off-bill work is $800 (the job less its one sent bill); $400 of the $1,200 reaches the sent bill.
    expect(jobOpenBillingRemainderDollars(j)).toBe(600 + 250)
  })
})
