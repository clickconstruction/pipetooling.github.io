import { describe, expect, it } from 'vitest'
import type { JobWithDetails } from '../../types/jobWithDetails'
import type { StageRow } from '../jobsStagesBoard'
import {
  effectiveInvoiceEstBillDate,
  invoiceOpenRemainingOnJob,
  jobBilledUnpaidDollars,
  jobStagesActiveBillingInvoices,
  jobStagesInvoiceJumpChipTargets,
  printBilledRowReferenceDate,
  sortStageRowsForTotalByNameDetail,
  stageRowBilledAgeDays,
  stageRowBilledAgeReference,
  stageRowBilledLineLabel,
  stageRowBilledRemainingAmount,
  stagesJobLevelStripeEmailedHintInvoice,
  sumInvoiceAppliedFromJobPayments,
  billedStageRowAgingBucket,
  billedStageRowHasNoBillLine,
  buildBilledAgingBuckets,
  buildBilledNoLineBucket,
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
    payments: [],
    invoices: [],
    ...p,
  } as unknown as JobWithDetails
}

describe('effectiveInvoiceEstBillDate', () => {
  it('uses the invoice estimated_bill_date', () => {
    expect(effectiveInvoiceEstBillDate(inv({ estimated_bill_date: '2026-02-01' }) as Inv)).toBe('2026-02-01')
  })
  it('is null without one (the manual job-level fallback retired, v2.1154)', () => {
    expect(effectiveInvoiceEstBillDate(inv({}) as Inv)).toBe(null)
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

describe('jobBilledUnpaidDollars', () => {
  it('sums open remainder across SENT (billed) invoices only, excluding drafts', () => {
    const j = job({
      invoices: [
        inv({ id: 'i1', amount: 16054, status: 'billed' }),
        inv({ id: 'i2', amount: 24081, status: 'ready_to_bill' }), // draft — excluded
      ],
      payments: [],
    })
    expect(jobBilledUnpaidDollars(j)).toBe(16054)
  })
  it('nets out payments applied to the billed invoice', () => {
    const j = job({
      invoices: [inv({ id: 'i1', amount: 1000, status: 'billed' })],
      payments: [{ invoice_id: 'i1', amount: 400 }],
    })
    expect(jobBilledUnpaidDollars(j)).toBe(600)
  })
  it('is zero with no billed invoices', () => {
    expect(jobBilledUnpaidDollars(job({ invoices: [inv({ status: 'ready_to_bill' })] }))).toBe(0)
    expect(jobBilledUnpaidDollars(job({}))).toBe(0)
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
  it('job rows are always null since the manual last bill date retired (v2.1154)', () => {
    expect(stageRowBilledAgeDays({ kind: 'job', job: job({}) } as StageRow, now)).toBe(null)
  })
  it('counts days for an invoice estimated_bill_date', () => {
    expect(stageRowBilledAgeDays({ kind: 'invoice', job: job({}), inv: inv({ estimated_bill_date: '2026-05-21' }) } as StageRow, now)).toBe(10)
  })
  it('returns null for a future date', () => {
    expect(stageRowBilledAgeDays({ kind: 'invoice', job: job({}), inv: inv({ estimated_bill_date: '2026-06-10' }) } as StageRow, now)).toBe(null)
  })
  it('falls back to billed_at (Chicago calendar day) when no est. bill date is set (v2.2130)', () => {
    // 2026-05-21T02:30Z is still May 20 in Chicago → 11 days, not 10.
    expect(stageRowBilledAgeDays({ kind: 'invoice', job: job({}), inv: inv({ billed_at: '2026-05-21T02:30:00Z' }) } as StageRow, now)).toBe(11)
    expect(stageRowBilledAgeDays({ kind: 'invoice', job: job({}), inv: inv({ billed_at: '2026-05-21T15:00:00Z' }) } as StageRow, now)).toBe(10)
  })
  it('a hand-set est. bill date overrides billed_at', () => {
    const r = { kind: 'invoice', job: job({}), inv: inv({ billed_at: '2026-05-28T15:00:00Z', estimated_bill_date: '2026-03-01' }) } as StageRow
    expect(stageRowBilledAgeDays(r, now)).toBe(91)
    expect(stageRowBilledAgeReference(r)).toEqual({ ymd: '2026-03-01', handSet: true })
    expect(stageRowBilledAgeReference({ kind: 'invoice', job: job({}), inv: inv({ billed_at: '2026-05-28T15:00:00Z' }) } as StageRow)).toEqual({ ymd: '2026-05-28', handSet: false })
    expect(stageRowBilledAgeReference({ kind: 'invoice', job: job({}), inv: inv({}) } as StageRow)).toBeNull()
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
    const older = { kind: 'invoice', job: job({}), inv: inv({ id: 'o', estimated_bill_date: '2026-01-01', amount: 100 }) } as StageRow
    const newer = { kind: 'invoice', job: job({}), inv: inv({ id: 'n', estimated_bill_date: '2026-05-01', amount: 100 }) } as StageRow
    const noDate = { kind: 'job', job: job({ revenue: 999, payments_made: 0 }) } as StageRow
    const sorted = sortStageRowsForTotalByNameDetail([newer, noDate, older])
    expect(sorted).toEqual([older, newer, noDate])
  })
  it('breaks age ties by larger remaining amount first', () => {
    const big = { kind: 'invoice', job: job({}), inv: inv({ id: 'b', estimated_bill_date: '2026-03-01', amount: 900 }) } as StageRow
    const small = { kind: 'invoice', job: job({}), inv: inv({ id: 's', estimated_bill_date: '2026-03-01', amount: 100 }) } as StageRow
    expect(sortStageRowsForTotalByNameDetail([small, big])).toEqual([big, small])
  })
})

describe('printBilledRowReferenceDate', () => {
  const now = new Date('2026-05-31T12:00:00Z')
  it('job rows always render em dash since the manual last bill date retired (v2.1154)', () => {
    const r = { kind: 'job', job: job({}) } as StageRow
    expect(printBilledRowReferenceDate(r, now)).toEqual({ display: '—', ageDays: null })
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

describe('buildBilledAgingBuckets', () => {
  const NOW = new Date('2026-07-20T12:00:00Z')
  const billedJobWithInvoice = (id: string, estBillDate: string | null, amount: number, extra: Record<string, unknown> = {}) =>
    job({
      id,
      status: 'billed',
      revenue: amount,
      payments_made: 0,
      invoices: [inv({ id: `${id}-inv`, status: 'billed', estimated_bill_date: estBillDate, amount })],
      ...extra,
    })
  const billedJobNoInvoices = (id: string, revenue: number) =>
    job({ id, status: 'billed', revenue, payments_made: 0, invoices: [] })

  it('buckets positive remainders at 30 and 90 days, excluding fresh, zero, and Collections rows', () => {
    const jobs = [
      billedJobWithInvoice('a', '2026-06-01', 500),            // ~49 days -> 30-90 bucket
      billedJobWithInvoice('b', '2026-03-01', 700),            // ~141 days -> 90+ bucket
      billedJobWithInvoice('c', '2026-07-10', 900),            // 10 days -> too fresh
      billedJobWithInvoice('d', '2026-06-01', 0),              // zero remainder -> excluded
      billedJobNoInvoices('e', 400),                           // job row: no reference date since v2.1154 -> excluded
      billedJobWithInvoice('f', '2026-03-01', 1000, { collections_at: '2026-07-01T00:00:00Z' }), // Collections -> excluded
    ]
    expect(buildBilledAgingBuckets(jobs, NOW)).toEqual({
      count30_90: 1,
      sum30_90: 500,
      count90: 1,
      sum90: 700,
    })
  })

  it('returns all-zero buckets for an empty board', () => {
    expect(buildBilledAgingBuckets([], NOW)).toEqual({ count30_90: 0, sum30_90: 0, count90: 0, sum90: 0 })
  })
})

describe('billedStageRowAgingBucket', () => {
  const NOW = new Date('2026-07-20T12:00:00Z')
  const rowFor = (estBillDate: string | null, amount: number) => {
    const j = job({ id: 'j1', status: 'billed', revenue: amount, payments_made: 0 })
    return {
      kind: 'invoice' as const,
      inv: inv({ id: 'i1', status: 'billed', estimated_bill_date: estBillDate, amount }),
      job: j,
    }
  }

  it('mirrors the buckets: 30-90, 90+, fresh, and no-date rows', () => {
    expect(billedStageRowAgingBucket(rowFor('2026-06-01', 500), NOW)).toBe('30_90')
    expect(billedStageRowAgingBucket(rowFor('2026-03-01', 700), NOW)).toBe('90')
    expect(billedStageRowAgingBucket(rowFor('2026-07-10', 900), NOW)).toBeNull()
    expect(billedStageRowAgingBucket(rowFor(null, 900), NOW)).toBeNull()
  })

  it('rows with nothing left to pay never age', () => {
    expect(billedStageRowAgingBucket(rowFor('2026-03-01', 0), NOW)).toBeNull()
  })

  it('buckets by billed_at when no est. bill date is set (v2.2130)', () => {
    const j = job({ id: 'j1', status: 'billed', revenue: 500, payments_made: 0 })
    const rowAt = (billedAt: string) => ({ kind: 'invoice' as const, inv: inv({ id: 'i1', status: 'billed', billed_at: billedAt, amount: 500 }), job: j })
    expect(billedStageRowAgingBucket(rowAt('2026-06-01T15:00:00Z'), NOW)).toBe('30_90')
    expect(billedStageRowAgingBucket(rowAt('2026-03-01T15:00:00Z'), NOW)).toBe('90')
    expect(billedStageRowAgingBucket(rowAt('2026-07-10T15:00:00Z'), NOW)).toBeNull()
  })

  it('job-shell rows have no reference date and never age', () => {
    const j = job({ id: 'j2', status: 'billed', revenue: 800, payments_made: 0 })
    expect(billedStageRowAgingBucket({ kind: 'job', job: j }, NOW)).toBeNull()
  })
})

describe('billedStageRowHasNoBillLine / buildBilledNoLineBucket', () => {
  it('shell rows always count; invoice rows only when missing both dates', () => {
    const shell: StageRow = { kind: 'job', job: job({ revenue: 500 }) }
    const dated: StageRow = { kind: 'invoice', inv: inv({ amount: 100, billed_at: '2026-08-01T00:00:00Z' }), job: job({}) }
    const estOnly: StageRow = { kind: 'invoice', inv: inv({ amount: 100, estimated_bill_date: '2026-08-01' }), job: job({}) }
    const undated: StageRow = { kind: 'invoice', inv: inv({ amount: 100 }), job: job({}) }
    expect(billedStageRowHasNoBillLine(shell)).toBe(true)
    expect(billedStageRowHasNoBillLine(dated)).toBe(false)
    expect(billedStageRowHasNoBillLine(estOnly)).toBe(false)
    expect(billedStageRowHasNoBillLine(undated)).toBe(true)
  })

  it('bucket sums open dollars over no-line rows, skipping zero-open ones', () => {
    const shell: StageRow = { kind: 'job', job: job({ revenue: 500, payments_made: 100 }) }
    const paidShell: StageRow = { kind: 'job', job: job({ id: 'j2', revenue: 500, payments_made: 500 }) }
    const dated: StageRow = { kind: 'invoice', inv: inv({ amount: 100, billed_at: '2026-08-01T00:00:00Z' }), job: job({ id: 'j3' }) }
    expect(buildBilledNoLineBucket([shell, paidShell, dated])).toEqual({ count: 1, sum: 400 })
  })
})
