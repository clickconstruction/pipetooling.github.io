import { describe, expect, it } from 'vitest'
import type { JobWithDetails } from '../../types/jobWithDetails'
import type { StageRow } from '../jobsStagesBoard'
import { buildGcReviewRollup } from '../gcReviewRollup'
import { gcUnpaidInvoiceDocs, gcUnpaidInvoicePrintSummary, planGcUnpaidInvoicePrint } from './gcUnpaidInvoicePrint'

const NOW = new Date('2026-09-27T12:00:00Z')
const MASON = { id: 'gc-mason', name: 'RMC- Dudley Mason' }

type Inv = JobWithDetails['invoices'][number]

const inv = (id: string, jobId: string, amount: number, over: Partial<Record<keyof Inv, unknown>> = {}) =>
  ({
    id,
    job_id: jobId,
    amount,
    sequence_order: 1,
    status: 'billed',
    billed_at: '2026-08-18T14:28:00Z',
    sent_to_customer_at: null,
    estimated_bill_date: null,
    stripe_invoice_memo: 'Gas install',
    external_send_note: '',
    stripe_invoice_footer: null,
    ...over,
  }) as unknown as Inv

function job(id: string, over: Partial<JobWithDetails> = {}): JobWithDetails {
  return {
    id,
    status: 'billed',
    gcCustomer: MASON,
    gc_customer_id: MASON.id,
    bill_to_party: 'gc',
    hcp_number: id.replace('j', ''),
    click_number: '',
    job_name: 'Dudley Mason',
    job_address: `${id} Terrell Rd, San Antonio, TX 78209`,
    customer_name: 'Bobby Urrabazo',
    customer_email: '',
    revenue: 1000,
    payments_made: 0,
    invoices: [],
    payments: [],
    materials: [],
    fixtures: [],
    team_members: [],
    ...over,
  } as unknown as JobWithDetails
}

const invoiceRow = (j: JobWithDetails, i: Inv): StageRow => ({ kind: 'invoice', job: j, inv: i })

describe('planGcUnpaidInvoicePrint', () => {
  it("names each statement row's own bill, in the statement's order", () => {
    const a = job('j868', { job_address: 'B Street' })
    const b = job('j372', { job_address: 'A Street' })
    const rows = [invoiceRow(a, inv('i-868', a.id, 500)), invoiceRow(b, inv('i-372', b.id, 900))]
    const group = buildGcReviewRollup(rows, [], { now: NOW }).groups[0]!
    // The statement sorts by address, so A Street leads whatever the board's order was.
    expect(group.rows.map((r) => r.key)).toEqual(['i-372', 'i-868'])
    expect(planGcUnpaidInvoicePrint(group, rows)).toEqual({
      targets: [
        { jobId: 'j372', invoiceId: 'i-372' },
        { jobId: 'j868', invoiceId: 'i-868' },
      ],
      rowsWithoutBill: 0,
    })
  })

  it('finds the bill behind a merged job row, and counts a job balance with no bill as unprintable', () => {
    const merged = job('j651')
    const shell = job('j186')
    const rows: StageRow[] = [
      { kind: 'job_with_merged_billed', job: merged, inv: inv('i-651', merged.id, 8780) },
      { kind: 'job', job: shell },
    ]
    const group = buildGcReviewRollup(rows, [], { now: NOW }).groups[0]!
    const plan = planGcUnpaidInvoicePrint(group, rows)
    expect(plan.targets).toEqual([{ jobId: 'j651', invoiceId: 'i-651' }])
    expect(plan.rowsWithoutBill).toBe(1)
  })

  it('prints only the GC being shared, and a Collections row only when the statement shows it', () => {
    const mine = job('j790')
    const other = job('j999', { gcCustomer: { id: 'gc-other', name: 'Other GC' }, gc_customer_id: 'gc-other' })
    const collections = job('j800')
    const active = [invoiceRow(mine, inv('i-790', mine.id, 1712.5)), invoiceRow(other, inv('i-999', other.id, 50))]
    const inCollections = [invoiceRow(collections, inv('i-800', collections.id, 1600))]
    const all = [...active, ...inCollections]
    const without = buildGcReviewRollup(active, inCollections, { now: NOW }).groups.find((g) => g.gcId === MASON.id)!
    expect(planGcUnpaidInvoicePrint(without, all).targets.map((t) => t.invoiceId)).toEqual(['i-790'])
    const withCollections = buildGcReviewRollup(active, inCollections, { now: NOW, includeCollections: true }).groups.find((g) => g.gcId === MASON.id)!
    expect(planGcUnpaidInvoicePrint(withCollections, all).targets.map((t) => t.invoiceId).sort()).toEqual(['i-790', 'i-800'])
  })

  it('never prints one bill twice', () => {
    const j = job('j890')
    const i = inv('i-890', j.id, 285)
    const group = { rows: [{ key: 'i-890' }, { key: 'i-890' }] } as unknown as Parameters<typeof planGcUnpaidInvoicePrint>[0]
    expect(planGcUnpaidInvoicePrint(group, [invoiceRow(j, i)]).targets).toHaveLength(1)
  })
})

describe('gcUnpaidInvoiceDocs', () => {
  it('builds the invoice document for each bill still unpaid, in order', () => {
    const a = job('j867', { invoices: [inv('i-a', 'j867', 1710)] })
    const b = job('j890', { invoices: [inv('i-b', 'j890', 285)] })
    const built = gcUnpaidInvoiceDocs(
      [
        { jobId: 'j890', invoiceId: 'i-b' },
        { jobId: 'j867', invoiceId: 'i-a' },
      ],
      new Map([
        [a.id, a],
        [b.id, b],
      ]),
    )
    expect(built.docs.map((d) => d.amountFormatted)).toEqual(['$285.00', '$1,710.00'])
    expect(built.noLongerUnpaid).toBe(0)
    expect(built.failed).toBe(0)
  })

  it('leaves out a bill paid, sent back or deleted since the board loaded', () => {
    const paid = job('j1', { invoices: [inv('i-paid', 'j1', 500)], payments: [{ invoice_id: 'i-paid', amount: 500 }] as never })
    const sentBack = job('j2', { invoices: [inv('i-rtb', 'j2', 300, { status: 'ready_to_bill' })] })
    const deleted = job('j3', { invoices: [] })
    const partial = job('j4', { invoices: [inv('i-part', 'j4', 800)], payments: [{ invoice_id: 'i-part', amount: 300 }] as never })
    const built = gcUnpaidInvoiceDocs(
      [
        { jobId: 'j1', invoiceId: 'i-paid' },
        { jobId: 'j2', invoiceId: 'i-rtb' },
        { jobId: 'j3', invoiceId: 'i-gone' },
        { jobId: 'j4', invoiceId: 'i-part' },
      ],
      new Map([paid, sentBack, deleted, partial].map((j) => [j.id, j])),
    )
    // A part-paid bill still prints: money is still open on it.
    expect(built.docs).toHaveLength(1)
    expect(built.noLongerUnpaid).toBe(3)
  })

  it('counts a job that could not be read as failed, never as paid', () => {
    const built = gcUnpaidInvoiceDocs([{ jobId: 'missing', invoiceId: 'i-x' }], new Map())
    expect(built).toEqual({ docs: [], noLongerUnpaid: 0, failed: 1 })
  })
})

describe('gcUnpaidInvoicePrintSummary', () => {
  const none = { rowsWithoutBill: 0, noLongerUnpaid: 0, failed: 0 }

  it('says how many printed', () => {
    expect(gcUnpaidInvoicePrintSummary('RMC- Dudley Mason', { printed: 19, ...none })).toEqual({ message: '19 unpaid invoices for RMC- Dudley Mason.', complete: true })
    expect(gcUnpaidInvoicePrintSummary('Knight', { printed: 1, ...none }).message).toBe('1 unpaid invoice for Knight.')
  })

  it('names every row it left out and why', () => {
    const s = gcUnpaidInvoicePrintSummary('Knight', { printed: 4, rowsWithoutBill: 1, noLongerUnpaid: 2, failed: 1 })
    expect(s.complete).toBe(false)
    expect(s.message).toBe('4 unpaid invoices for Knight — left out: 1 row is a job balance with no invoice; 2 bills are no longer unpaid; 1 bill could not be built.')
  })

  it('says so when there is nothing to print', () => {
    expect(gcUnpaidInvoicePrintSummary('Knight', { printed: 0, ...none, rowsWithoutBill: 2 }).message).toBe(
      'No unpaid invoices to print for Knight — left out: 2 rows are job balances with no invoice.',
    )
  })
})
