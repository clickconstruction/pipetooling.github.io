import { describe, expect, it } from 'vitest'
import type { JobWithDetails } from '../../types/jobWithDetails'
import type { StageRow } from '../jobsStagesBoard'
import {
  effectiveInvoiceEstBillDate,
  invoiceOpenRemainingOnJob,
  jobStagesActiveBillingInvoices,
  jobStagesInvoiceJumpChipTargets,
  printBilledRowReferenceDate,
  sortStageRowsForTotalByNameDetail,
  stageRowBilledAgeDays,
  stageRowBilledLineLabel,
  stageRowBilledRemainingAmount,
  stagesJobLevelStripeEmailedHintInvoice,
  sumInvoiceAppliedFromJobPayments,
} from './invoiceBilling'

type Inv = ReturnType<typeof inv>
function inv(p: Partial<Record<string, unknown>>): JobWithDetails['invoices'][number] {
  return {
    id: 'i1',
    amount: 0,
    sequence_order: 1,
    status: 'billed',
    estimated_bill_date: null,
    billed_at: null,
    external_send_channel: null,
    stripe_invoice_id: null,
    sent_to_customer_at: null,
    ...p,
  } as unknown as JobWithDetails['invoices'][number]
}

function job(p: Partial<Record<string, unknown>>): JobWithDetails {
  return {
    id: 'j1',
    hcp_number: 'HCP1',
    revenue: 0,
    payments_made: 0,
    last_bill_date: null,
    payments: [],
    invoices: [],
    ...p,
  } as unknown as JobWithDetails
}

describe('effectiveInvoiceEstBillDate', () => {
  it('prefers the invoice estimated_bill_date', () => {
    expect(effectiveInvoiceEstBillDate(inv({ estimated_bill_date: '2026-02-01' }) as Inv, job({ last_bill_date: '2026-01-01' }))).toBe('2026-02-01')
  })
  it('falls back to job last_bill_date, then null', () => {
    expect(effectiveInvoiceEstBillDate(inv({}) as Inv, job({ last_bill_date: '2026-01-01' }))).toBe('2026-01-01')
    expect(effectiveInvoiceEstBillDate(inv({}) as Inv, job({}))).toBe(null)
  })
})

describe('sumInvoiceAppliedFromJobPayments / invoiceOpenRemainingOnJob', () => {
  const j = job({
    payments: [
      { invoice_id: 'i1', amount: 100 },
      { invoice_id: 'i1', amount: 50 },
      { invoice_id: 'i2', amount: 999 },
      { invoice_id: 'i1', amount: null },
    ],
  })
  it('sums only payments for the given invoice', () => {
    expect(sumInvoiceAppliedFromJobPayments(j, 'i1')).toBe(150)
    expect(sumInvoiceAppliedFromJobPayments(job({}), 'i1')).toBe(0)
  })
  it('open remaining is amount minus applied, floored at zero', () => {
    expect(invoiceOpenRemainingOnJob(inv({ id: 'i1', amount: 400 }) as Inv, j)).toBe(250)
    expect(invoiceOpenRemainingOnJob(inv({ id: 'i1', amount: 100 }) as Inv, j)).toBe(0)
  })
})

describe('stageRowBilledRemainingAmount', () => {
  it('job row uses revenue minus payments_made', () => {
    const r = { kind: 'job', job: job({ revenue: 1000, payments_made: 300 }) } as StageRow
    expect(stageRowBilledRemainingAmount(r)).toBe(700)
  })
  it('invoice row delegates to invoiceOpenRemainingOnJob', () => {
    const r = {
      kind: 'invoice',
      inv: inv({ id: 'i1', amount: 500 }),
      job: job({ payments: [{ invoice_id: 'i1', amount: 200 }] }),
    } as StageRow
    expect(stageRowBilledRemainingAmount(r)).toBe(300)
  })
})

describe('stageRowBilledAgeDays', () => {
  const now = new Date('2026-05-31T12:00:00Z')
  it('returns null when no reference date', () => {
    expect(stageRowBilledAgeDays({ kind: 'job', job: job({}) } as StageRow, now)).toBe(null)
  })
  it('counts days for a job last_bill_date', () => {
    expect(stageRowBilledAgeDays({ kind: 'job', job: job({ last_bill_date: '2026-05-21' }) } as StageRow, now)).toBe(10)
  })
  it('returns null for a future date', () => {
    expect(stageRowBilledAgeDays({ kind: 'job', job: job({ last_bill_date: '2026-06-10' }) } as StageRow, now)).toBe(null)
  })
})

describe('stageRowBilledLineLabel', () => {
  it('labels each row kind', () => {
    expect(stageRowBilledLineLabel({ kind: 'job', job: job({ hcp_number: 'H9' }) } as StageRow)).toBe('H9 · Job balance')
    expect(stageRowBilledLineLabel({ kind: 'job_with_merged_billed', job: job({ hcp_number: 'H9' }), inv: inv({}) } as StageRow)).toBe('H9 · Billed line')
    expect(stageRowBilledLineLabel({ kind: 'invoice', job: job({ hcp_number: 'H9' }), inv: inv({ sequence_order: 3 }) } as StageRow)).toBe('H9 · Invoice #3')
  })
  it('uses an em dash when hcp is missing', () => {
    expect(stageRowBilledLineLabel({ kind: 'job', job: job({ hcp_number: '' }) } as StageRow)).toBe('— · Job balance')
  })
})

describe('sortStageRowsForTotalByNameDetail', () => {
  it('orders by oldest age first, nulls last, then larger remaining first', () => {
    const older = { kind: 'job', job: job({ last_bill_date: '2026-01-01', revenue: 100, payments_made: 0 }) } as StageRow
    const newer = { kind: 'job', job: job({ last_bill_date: '2026-05-01', revenue: 100, payments_made: 0 }) } as StageRow
    const noDate = { kind: 'job', job: job({ last_bill_date: null, revenue: 999, payments_made: 0 }) } as StageRow
    const sorted = sortStageRowsForTotalByNameDetail([newer, noDate, older])
    expect(sorted).toEqual([older, newer, noDate])
  })
  it('breaks age ties by larger remaining amount first', () => {
    const big = { kind: 'job', job: job({ last_bill_date: '2026-03-01', revenue: 900, payments_made: 0 }) } as StageRow
    const small = { kind: 'job', job: job({ last_bill_date: '2026-03-01', revenue: 100, payments_made: 0 }) } as StageRow
    expect(sortStageRowsForTotalByNameDetail([small, big])).toEqual([big, small])
  })
})

describe('printBilledRowReferenceDate', () => {
  const now = new Date('2026-05-31T12:00:00Z')
  it('job row uses last_bill_date', () => {
    const r = { kind: 'job', job: job({ last_bill_date: '2026-05-21' }) } as StageRow
    expect(printBilledRowReferenceDate(r, now)).toEqual({ display: 'May 21, 2026', ageDays: 10 })
  })
  it('job row with no date renders em dash', () => {
    expect(printBilledRowReferenceDate({ kind: 'job', job: job({}) } as StageRow, now)).toEqual({ display: '—', ageDays: null })
  })
  it('invoice row prefers billed_at', () => {
    const r = { kind: 'invoice', inv: inv({ billed_at: '2026-05-21T08:00:00Z' }), job: job({}) } as StageRow
    expect(printBilledRowReferenceDate(r, now)).toEqual({ display: 'May 21, 2026', ageDays: 10 })
  })
  it('invoice row falls back to est bill date with (est.) suffix', () => {
    const r = { kind: 'invoice', inv: inv({ billed_at: null, estimated_bill_date: '2026-05-21' }), job: job({}) } as StageRow
    expect(printBilledRowReferenceDate(r, now)).toEqual({ display: 'May 21, 2026 (est.)', ageDays: 10 })
  })
})

describe('jobStagesActiveBillingInvoices', () => {
  it('keeps only RTB/billed and sorts by sequence_order', () => {
    const j = job({
      invoices: [
        inv({ id: 'a', status: 'billed', sequence_order: 2 }),
        inv({ id: 'b', status: 'draft', sequence_order: 1 }),
        inv({ id: 'c', status: 'ready_to_bill', sequence_order: 0 }),
      ],
    })
    expect(jobStagesActiveBillingInvoices(j).map((i) => i.id)).toEqual(['c', 'a'])
  })
})

describe('jobStagesInvoiceJumpChipTargets', () => {
  it('returns all active billing invoices when nothing is merged', () => {
    const j = job({
      invoices: [
        inv({ id: 'a', status: 'ready_to_bill', sequence_order: 0 }),
        inv({ id: 'b', status: 'ready_to_bill', sequence_order: 1 }),
      ],
    })
    expect(jobStagesInvoiceJumpChipTargets(j).map((i) => i.id)).toEqual(['a', 'b'])
  })
})

describe('stagesJobLevelStripeEmailedHintInvoice', () => {
  const emailed = (p: Record<string, unknown>) =>
    inv({ status: 'billed', external_send_channel: 'stripe', stripe_invoice_id: 'si_1', sent_to_customer_at: '2026-05-01T00:00:00Z', ...p })
  it('returns the single emailed stripe invoice', () => {
    const j = job({ invoices: [emailed({ id: 'x' }), inv({ id: 'y', status: 'draft' })] })
    expect(stagesJobLevelStripeEmailedHintInvoice(j)?.id).toBe('x')
  })
  it('returns undefined when zero or multiple match', () => {
    expect(stagesJobLevelStripeEmailedHintInvoice(job({ invoices: [] }))).toBeUndefined()
    expect(stagesJobLevelStripeEmailedHintInvoice(job({ invoices: [emailed({ id: 'x' }), emailed({ id: 'z' })] }))).toBeUndefined()
  })
})
