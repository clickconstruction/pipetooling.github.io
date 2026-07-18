import { describe, expect, it } from 'vitest'
import {
  DASHBOARD_INVOICES_JOBS_LEDGER_SELECT,
  buildBilledWaitingDashboardUnits,
  buildPaymentsByInvoiceIdMap,
  countDashboardRtbDraftsForJob,
  dashboardBilledInvoiceAmounts,
  dashboardInvoiceToPaymentModal,
  dashboardJobHasCustomerForBilling,
  jobBillingFromDashboardInvoice,
  mapJoinedInvoiceToDashboard,
  type DashboardInvoiceJoinRow,
  type InvoiceForDashboard,
  type JobForDashboard,
  type JobsLedgerPaymentRow,
} from './dashboardBillingInvoiceUnits'

function mkPayment(over: Partial<JobsLedgerPaymentRow> = {}): JobsLedgerPaymentRow {
  return {
    id: 'pay-1',
    invoice_id: 'inv-1',
    job_id: 'job-1',
    amount: 100,
    ...over,
  } as JobsLedgerPaymentRow
}

const BASE_INVOICE_FIELDS = {
  id: 'inv-1',
  job_id: 'job-1',
  amount: 500,
  status: 'billed',
  created_at: '2026-07-01T00:00:00Z',
  billed_at: '2026-07-02T00:00:00Z',
  estimated_bill_date: null,
  external_send_channel: null,
  external_send_note: null,
  hosted_invoice_url: null,
  sent_to_customer_at: null,
  sequence_order: 1,
  stripe_invoice_id: null,
  stripe_invoice_memo: null,
  stripe_invoice_footer: null,
  stripe_invoice_status: null,
  agreed_write_down_at: null,
  agreed_write_down_by: null,
  agreed_write_down_note: null,
  agreed_write_down_previous_amount: null,
  agreed_write_down_stripe_credit_note_id: null,
  is_primary_rtb_bundle: null,
}

const BASE_JOBS_LEDGER = {
  hcp_number: 'HCP-9',
  job_name: 'Repipe',
  job_address: '1 Main St',
  google_drive_link: 'https://drive',
  job_plans_link: null,
  created_at: '2026-06-20T00:00:00Z',
  master_user_id: 'master-1',
  customer_id: 'cust-1',
  customer_name: 'Casey Customer',
  customer_email: 'casey@example.com',
  customer_phone: '555-0100',
  last_work_date: '2026-06-30',
}

function mkJoinRow(over: Record<string, unknown> = {}, jl: Record<string, unknown> = {}): DashboardInvoiceJoinRow {
  return {
    ...BASE_INVOICE_FIELDS,
    ...over,
    jobs_ledger: { ...BASE_JOBS_LEDGER, ...jl },
  } as unknown as DashboardInvoiceJoinRow
}

function mkInvoice(over: Partial<InvoiceForDashboard> = {}): InvoiceForDashboard {
  return {
    ...BASE_INVOICE_FIELDS,
    ...BASE_JOBS_LEDGER,
    open_since_at: BASE_JOBS_LEDGER.created_at,
    invoice_payments: [],
    ...over,
  } as unknown as InvoiceForDashboard
}

function mkJob(over: Partial<JobForDashboard> = {}): JobForDashboard {
  return {
    id: 'job-1',
    hcp_number: 'HCP-9',
    job_name: 'Repipe',
    job_address: '1 Main St',
    revenue: 1000,
    payments_made: 0,
    google_drive_link: null,
    job_plans_link: null,
    created_at: '2026-06-20T00:00:00Z',
    customer_id: 'cust-1',
    ...over,
  }
}

describe('buildPaymentsByInvoiceIdMap', () => {
  it('groups payments by invoice_id preserving input order', () => {
    const p1 = mkPayment({ id: 'p1', invoice_id: 'a', amount: 10 })
    const p2 = mkPayment({ id: 'p2', invoice_id: 'b', amount: 20 })
    const p3 = mkPayment({ id: 'p3', invoice_id: 'a', amount: 30 })
    const m = buildPaymentsByInvoiceIdMap([p1, p2, p3])
    expect(m.get('a')).toEqual([p1, p3])
    expect(m.get('b')).toEqual([p2])
  })

  it('skips payments without an invoice_id', () => {
    const orphan = mkPayment({ id: 'p1', invoice_id: null })
    const m = buildPaymentsByInvoiceIdMap([orphan])
    expect(m.size).toBe(0)
  })

  it('returns an empty map for no payments', () => {
    expect(buildPaymentsByInvoiceIdMap([]).size).toBe(0)
  })
})

describe('mapJoinedInvoiceToDashboard', () => {
  it('copies invoice fields and flattens jobs_ledger fields', () => {
    const out = mapJoinedInvoiceToDashboard(mkJoinRow(), new Map())
    expect(out.id).toBe('inv-1')
    expect(out.job_id).toBe('job-1')
    expect(out.amount).toBe(500)
    expect(out.status).toBe('billed')
    expect(out.hcp_number).toBe('HCP-9')
    expect(out.job_name).toBe('Repipe')
    expect(out.job_address).toBe('1 Main St')
    expect(out.master_user_id).toBe('master-1')
    expect(out.customer_id).toBe('cust-1')
    expect(out.customer_name).toBe('Casey Customer')
    expect(out.customer_email).toBe('casey@example.com')
    expect(out.customer_phone).toBe('555-0100')
    expect(out.last_work_date).toBe('2026-06-30')
    expect(out.google_drive_link).toBe('https://drive')
    expect(out.job_plans_link).toBeNull()
  })

  it('prefers the job created_at for open_since_at, falling back to the invoice created_at', () => {
    expect(mapJoinedInvoiceToDashboard(mkJoinRow(), new Map()).open_since_at).toBe('2026-06-20T00:00:00Z')
    expect(
      mapJoinedInvoiceToDashboard(mkJoinRow({}, { created_at: null }), new Map()).open_since_at,
    ).toBe('2026-07-01T00:00:00Z')
  })

  it('attaches payments for the invoice id and defaults to an empty list', () => {
    const pays = [mkPayment({ id: 'p1', invoice_id: 'inv-1' })]
    const m = new Map([['inv-1', pays]])
    expect(mapJoinedInvoiceToDashboard(mkJoinRow(), m).invoice_payments).toEqual(pays)
    expect(mapJoinedInvoiceToDashboard(mkJoinRow({ id: 'inv-2' }), m).invoice_payments).toEqual([])
  })

  it('falls back to empty strings / nulls when the join row is missing', () => {
    const row = { ...BASE_INVOICE_FIELDS, jobs_ledger: null } as unknown as DashboardInvoiceJoinRow
    const out = mapJoinedInvoiceToDashboard(row, new Map())
    expect(out.hcp_number).toBe('')
    expect(out.job_name).toBe('')
    expect(out.job_address).toBe('')
    expect(out.master_user_id).toBe('')
    expect(out.customer_id).toBeNull()
    expect(out.customer_phone).toBeNull()
    expect(out.last_work_date).toBeNull()
    expect(out.open_since_at).toBe('2026-07-01T00:00:00Z')
  })

  it('reads only fields the loaders select (guard against select/mapper drift)', () => {
    // Every invoice-row field the mapper copies must be requested in the select,
    // and every jobs_ledger field must be inside the jobs_ledger!inner(...) embed.
    const embedMatch = DASHBOARD_INVOICES_JOBS_LEDGER_SELECT.match(/jobs_ledger!inner\(([^)]*)\)/)
    expect(embedMatch).not.toBeNull()
    const embedFields = new Set(embedMatch![1]!.split(',').map((s) => s.trim()))
    const topFields = new Set(
      DASHBOARD_INVOICES_JOBS_LEDGER_SELECT.replace(/jobs_ledger!inner\([^)]*\)/, '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
    )
    for (const f of Object.keys(BASE_INVOICE_FIELDS)) {
      expect(topFields.has(f), `invoice field ${f} missing from select`).toBe(true)
    }
    for (const f of Object.keys(BASE_JOBS_LEDGER)) {
      expect(embedFields.has(f), `jobs_ledger field ${f} missing from embed`).toBe(true)
    }
  })
})

describe('dashboardBilledInvoiceAmounts', () => {
  it('reports zero applied and the full amount open with no payments', () => {
    expect(dashboardBilledInvoiceAmounts(mkInvoice({ amount: 500 }))).toEqual({ applied: 0, open: 500 })
  })

  it('sums payments and reduces the open amount', () => {
    const inv = mkInvoice({
      amount: 500,
      invoice_payments: [mkPayment({ amount: 100.25 }), mkPayment({ id: 'p2', amount: 50.5 })],
    })
    expect(dashboardBilledInvoiceAmounts(inv)).toEqual({ applied: 150.75, open: 349.25 })
  })

  it('clamps open at zero when overpaid', () => {
    const inv = mkInvoice({ amount: 100, invoice_payments: [mkPayment({ amount: 150 })] })
    expect(dashboardBilledInvoiceAmounts(inv)).toEqual({ applied: 150, open: 0 })
  })

  it('treats null payment amounts and a null invoice amount as zero', () => {
    const inv = mkInvoice({
      amount: null as unknown as number,
      invoice_payments: [mkPayment({ amount: null as unknown as number })],
    })
    expect(dashboardBilledInvoiceAmounts(inv)).toEqual({ applied: 0, open: 0 })
  })
})

describe('dashboardInvoiceToPaymentModal', () => {
  it('builds the modal shape: invoice row plus a minimal job object', () => {
    const out = dashboardInvoiceToPaymentModal(mkInvoice())
    expect(out.id).toBe('inv-1')
    expect(out.amount).toBe(500)
    expect(out.status).toBe('billed')
    expect(out.job).toEqual({
      id: 'job-1',
      hcp_number: 'HCP-9',
      job_name: 'Repipe',
      revenue: null,
      payments_made: null,
    })
  })

  it('strips the dashboard-only flattened fields from the invoice row', () => {
    const out = dashboardInvoiceToPaymentModal(mkInvoice()) as unknown as Record<string, unknown>
    for (const stripped of [
      'hcp_number',
      'job_name',
      'job_address',
      'google_drive_link',
      'job_plans_link',
      'master_user_id',
      'customer_id',
      'customer_name',
      'customer_email',
      'open_since_at',
      'invoice_payments',
    ]) {
      expect(stripped in out, `${stripped} should be stripped`).toBe(false)
    }
    // Documents current behavior: customer_phone / last_work_date are NOT in the
    // destructure list, so they ride along on the spread (harmless extras today).
    expect(out.customer_phone).toBe('555-0100')
    expect(out.last_work_date).toBe('2026-06-30')
  })
})

describe('jobBillingFromDashboardInvoice', () => {
  it('maps the invoice job fields into a JobBillingContext keyed by job_id', () => {
    expect(jobBillingFromDashboardInvoice(mkInvoice())).toEqual({
      id: 'job-1',
      master_user_id: 'master-1',
      hcp_number: 'HCP-9',
      job_name: 'Repipe',
      customer_id: 'cust-1',
      customer_name: 'Casey Customer',
      customer_email: 'casey@example.com',
      job_address: '1 Main St',
      customer_phone: '555-0100',
      last_work_date: '2026-06-30',
    })
  })
})

describe('dashboardJobHasCustomerForBilling', () => {
  it('rejects null, undefined, empty, and whitespace-only customer ids', () => {
    expect(dashboardJobHasCustomerForBilling(null)).toBe(false)
    expect(dashboardJobHasCustomerForBilling(undefined)).toBe(false)
    expect(dashboardJobHasCustomerForBilling('')).toBe(false)
    expect(dashboardJobHasCustomerForBilling('   ')).toBe(false)
  })

  it('accepts a non-empty customer id', () => {
    expect(dashboardJobHasCustomerForBilling('cust-1')).toBe(true)
  })
})

describe('countDashboardRtbDraftsForJob', () => {
  it('counts only invoices on the given job', () => {
    const invs = [
      mkInvoice({ id: 'a', job_id: 'job-1' }),
      mkInvoice({ id: 'b', job_id: 'job-2' }),
      mkInvoice({ id: 'c', job_id: 'job-1' }),
    ]
    expect(countDashboardRtbDraftsForJob('job-1', invs)).toBe(2)
    expect(countDashboardRtbDraftsForJob('job-2', invs)).toBe(1)
    expect(countDashboardRtbDraftsForJob('job-3', invs)).toBe(0)
  })
})

describe('buildBilledWaitingDashboardUnits', () => {
  it('merges a job with exactly one billed invoice into one job_bundle row', () => {
    const job = mkJob({ id: 'job-1' })
    const inv = mkInvoice({ id: 'inv-1', job_id: 'job-1' })
    expect(buildBilledWaitingDashboardUnits([job], [inv])).toEqual([{ kind: 'job_bundle', job, inv }])
  })

  it('keeps a job with no invoices as a plain job row', () => {
    const job = mkJob({ id: 'job-1' })
    expect(buildBilledWaitingDashboardUnits([job], [])).toEqual([{ kind: 'job' , job }])
  })

  it('keeps the job row when it has 2+ billed invoices, listing each invoice standalone', () => {
    const job = mkJob({ id: 'job-1' })
    const a = mkInvoice({ id: 'a', job_id: 'job-1' })
    const b = mkInvoice({ id: 'b', job_id: 'job-1' })
    expect(buildBilledWaitingDashboardUnits([job], [a, b])).toEqual([
      { kind: 'job', job },
      { kind: 'invoice', inv: a },
      { kind: 'invoice', inv: b },
    ])
  })

  it('keeps the job row with 3 billed invoices of mixed amounts, never bundling any of them', () => {
    const job = mkJob({ id: 'job-1', revenue: 1000, payments_made: 100 })
    const a = mkInvoice({ id: 'a', job_id: 'job-1', amount: 300 })
    const b = mkInvoice({ id: 'b', job_id: 'job-1', amount: 450.5 })
    const c = mkInvoice({ id: 'c', job_id: 'job-1', amount: 149.5 })
    expect(buildBilledWaitingDashboardUnits([job], [a, b, c])).toEqual([
      { kind: 'job', job },
      { kind: 'invoice', inv: a },
      { kind: 'invoice', inv: b },
      { kind: 'invoice', inv: c },
    ])
  })

  it('with 2+ invoices on one job and 1 on another, only the single-invoice job bundles', () => {
    const multi = mkJob({ id: 'j-multi' })
    const single = mkJob({ id: 'j-single' })
    const m1 = mkInvoice({ id: 'm1', job_id: 'j-multi', amount: 200 })
    const m2 = mkInvoice({ id: 'm2', job_id: 'j-multi', amount: 300 })
    const s1 = mkInvoice({ id: 's1', job_id: 'j-single', amount: 500 })
    expect(buildBilledWaitingDashboardUnits([multi, single], [m1, m2, s1])).toEqual([
      { kind: 'job', job: multi },
      { kind: 'job_bundle', job: single, inv: s1 },
      { kind: 'invoice', inv: m1 },
      { kind: 'invoice', inv: m2 },
    ])
  })

  it('lists invoices without a matching job as standalone rows after the jobs', () => {
    const job = mkJob({ id: 'job-1' })
    const bundled = mkInvoice({ id: 'a', job_id: 'job-1' })
    const orphan = mkInvoice({ id: 'b', job_id: 'job-x' })
    expect(buildBilledWaitingDashboardUnits([job], [bundled, orphan])).toEqual([
      { kind: 'job_bundle', job, inv: bundled },
      { kind: 'invoice', inv: orphan },
    ])
  })

  it('preserves job order then leftover-invoice order', () => {
    const j1 = mkJob({ id: 'j1' })
    const j2 = mkJob({ id: 'j2' })
    const i1 = mkInvoice({ id: 'i1', job_id: 'j2' })
    const i2 = mkInvoice({ id: 'i2', job_id: 'none' })
    const i3 = mkInvoice({ id: 'i3', job_id: 'none-2' })
    expect(buildBilledWaitingDashboardUnits([j1, j2], [i1, i2, i3])).toEqual([
      { kind: 'job', job: j1 },
      { kind: 'job_bundle', job: j2, inv: i1 },
      { kind: 'invoice', inv: i2 },
      { kind: 'invoice', inv: i3 },
    ])
  })
})
