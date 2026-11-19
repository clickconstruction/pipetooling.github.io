import { describe, expect, it, vi } from 'vitest'
import { loadCustomerPaidDays, loadDrawBillsByJob, loadDrawTieSheet, loadDrawTies, loadUsualPayWeeks, saveDrawBill } from './drawTieIo'

type Db = Parameters<typeof loadDrawTies>[0]
type Answer = { data: unknown; error: { code?: string; message: string } | null }

/** A client that answers each table's read with one fixed answer, whatever filters are chained on it. */
function dbOf(answers: Record<string, Answer>, rpc?: Answer): Db {
  const chain = (answer: Answer) => {
    const q: Record<string, unknown> = {}
    for (const m of ['select', 'eq', 'not', 'in', 'limit']) q[m] = () => q
    q.maybeSingle = () => Promise.resolve(answer)
    q.then = (resolve: (a: Answer) => unknown) => Promise.resolve(answer).then(resolve)
    return q
  }
  return { from: (table: string) => chain(answers[table] ?? { data: null, error: { message: `no answer for ${table}` } }), rpc: vi.fn(() => Promise.resolve(rpc ?? { data: { ok: true }, error: null })) } as unknown as Db
}

const MISSING_COLUMN = { data: null, error: { code: '42703', message: 'column people_labor_jobs.draw_invoice_id does not exist' } }

describe('every sheet’s tie', () => {
  it('maps the sheets that hold one', async () => {
    const db = dbOf({ people_labor_jobs: { data: [{ id: 's1', draw_invoice_id: 'b1' }, { id: 's2', draw_invoice_id: null }], error: null } })
    expect([...(await loadDrawTies(db))]).toEqual([['s1', 'b1']])
  })

  it('is empty before the migration is pushed', async () => {
    expect((await loadDrawTies(dbOf({ people_labor_jobs: MISSING_COLUMN }))).size).toBe(0)
  })

  it('is empty when the read throws, so the ledger beside it still loads', async () => {
    // A client with no .not(), as a test stub or an older client would be.
    const db = { from: () => ({ select: () => ({}) }) } as unknown as Db
    await expect(loadDrawTies(db)).resolves.toEqual(new Map())
  })
})

describe('one sheet with its job’s bills', () => {
  const BILLS = [{ id: 'b1', status: 'billed', sequence_order: 0, billed_at: null, amount: 100, created_at: null }]

  it('hands back the sheet, its tie and the bills', async () => {
    const db = dbOf({ people_labor_jobs: { data: { id: 's1', job_ledger_id: 'j1', stage: 'customer_pay', draw_invoice_id: 'b1' }, error: null }, jobs_ledger_invoices: { data: BILLS, error: null } })
    expect(await loadDrawTieSheet(db, 's1')).toEqual({ sheetId: 's1', jobId: 'j1', stage: 'customer_pay', drawInvoiceId: 'b1', bills: BILLS })
  })

  it('has no bills on a sheet with no job, and asks for none', async () => {
    const db = dbOf({ people_labor_jobs: { data: { id: 's1', job_ledger_id: null, stage: 'walkthrough' }, error: null } })
    expect(await loadDrawTieSheet(db, 's1')).toEqual({ sheetId: 's1', jobId: null, stage: 'walkthrough', drawInvoiceId: null, bills: [] })
  })

  it('answers null before the migration, when the sheet is not found, and when the bills cannot be read', async () => {
    expect(await loadDrawTieSheet(dbOf({ people_labor_jobs: MISSING_COLUMN }), 's1')).toBeNull()
    expect(await loadDrawTieSheet(dbOf({ people_labor_jobs: { data: null, error: null } }), 's1')).toBeNull()
    const refusedBills = dbOf({ people_labor_jobs: { data: { id: 's1', job_ledger_id: 'j1', stage: 'walkthrough' }, error: null }, jobs_ledger_invoices: { data: null, error: { message: 'permission denied' } } })
    expect(await loadDrawTieSheet(refusedBills, 's1')).toBeNull()
  })
})

describe('the save', () => {
  it('sends the sheet and the bill, or null for No bill', async () => {
    const db = dbOf({})
    await saveDrawBill(db, 's1', 'b1')
    await saveDrawBill(db, 's1', null)
    expect((db.rpc as unknown as ReturnType<typeof vi.fn>).mock.calls).toEqual([
      ['set_sub_sheet_draw_invoice', { p_labor_job_id: 's1', p_invoice_id: 'b1' }],
      ['set_sub_sheet_draw_invoice', { p_labor_job_id: 's1', p_invoice_id: null }],
    ])
  })

  it('throws the function’s own refusal, and the database’s', async () => {
    await expect(saveDrawBill(dbOf({}, { data: { error: 'That bill is not on this sheet’s job' }, error: null }), 's1', 'b9')).rejects.toEqual({ message: 'That bill is not on this sheet’s job' })
    const missing = { code: 'PGRST202', message: 'Could not find the function public.set_sub_sheet_draw_invoice' }
    await expect(saveDrawBill(dbOf({}, { data: null, error: missing }), 's1', 'b1')).rejects.toEqual(missing)
  })
})

describe('the day the customer paid each tied sheet’s bill (step 2)', () => {
  const ties = new Map([['s-paid', 'b-paid'], ['s-open', 'b-open']])
  const bills = { data: [{ id: 'b-paid', status: 'paid' }, { id: 'b-open', status: 'billed' }], error: null }
  const payments = { data: [{ invoice_id: 'b-paid', paid_on: '2026-11-03' }, { invoice_id: 'b-paid', paid_on: '2026-11-12' }, { invoice_id: 'b-open', paid_on: '2026-11-14' }], error: null }

  it('is the last payment’s day on a bill paid in full, and nothing for a part payment', async () => {
    expect([...(await loadCustomerPaidDays(dbOf({ jobs_ledger_invoices: bills, jobs_ledger_payments: payments }), ties))]).toEqual([['s-paid', '2026-11-12']])
  })

  it('reads nothing when no sheet is tied', async () => {
    const db = dbOf({})
    const from = vi.spyOn(db, 'from')
    expect((await loadCustomerPaidDays(db, new Map())).size).toBe(0)
    expect(from).not.toHaveBeenCalled()
  })

  it('is empty when either read is refused or throws', async () => {
    expect((await loadCustomerPaidDays(dbOf({ jobs_ledger_invoices: bills, jobs_ledger_payments: { data: null, error: { message: 'permission denied' } } }), ties)).size).toBe(0)
    expect((await loadCustomerPaidDays(dbOf({ jobs_ledger_invoices: { data: null, error: { message: 'permission denied' } }, jobs_ledger_payments: payments }), ties)).size).toBe(0)
    const throwing = { from: () => ({ select: () => ({}) }) } as unknown as Db
    await expect(loadCustomerPaidDays(throwing, ties)).resolves.toEqual(new Map())
  })
})

describe('the bills of the tied sheets’ jobs', () => {
  const rows = [
    { id: 'b1', job_id: 'j1', status: 'paid', sequence_order: 0, billed_at: null, amount: 100, created_at: null },
    { id: 'b2', job_id: 'j1', status: 'billed', sequence_order: 1, billed_at: null, amount: 200, created_at: null },
    { id: 'b3', job_id: 'j2', status: 'ready_to_bill', sequence_order: 0, billed_at: null, amount: 300, created_at: null },
  ]

  it('groups them by job, without the job’s id on each bill', async () => {
    const byJob = await loadDrawBillsByJob(dbOf({ jobs_ledger_invoices: { data: rows, error: null } }), ['j1', 'j2', 'j1', ''])
    expect(byJob.get('j1')?.map((b) => b.id)).toEqual(['b1', 'b2'])
    expect(byJob.get('j2')).toEqual([{ id: 'b3', status: 'ready_to_bill', sequence_order: 0, billed_at: null, amount: 300, created_at: null }])
  })

  it('reads nothing for no job, and is empty when the read is refused or throws', async () => {
    const db = dbOf({})
    const from = vi.spyOn(db, 'from')
    expect((await loadDrawBillsByJob(db, [])).size).toBe(0)
    expect(from).not.toHaveBeenCalled()
    expect((await loadDrawBillsByJob(dbOf({ jobs_ledger_invoices: { data: null, error: { message: 'permission denied' } } }), ['j1'])).size).toBe(0)
    const throwing = { from: () => ({ select: () => ({}) }) } as unknown as Db
    await expect(loadDrawBillsByJob(throwing, ['j1'])).resolves.toEqual(new Map())
  })
})

describe('how long each waiting sheet’s payer usually takes (step 3)', () => {
  // Made-up payers and days.
  const receipt = (gapDays: number) => ({ billedYmd: '2026-05-01', paidYmd: '2026-06-10', gapDays })
  const SPEEDS = { data: { receipts: { 'payer-steady': [28, 28, 35, 42, 42].map(receipt), 'payer-thin': [10, 12, 14].map(receipt) } }, error: null }
  const JOBS = { data: [{ id: 'job-1', bill_to_party: 'customer', customer_id: 'payer-steady', gc_customer_id: null }, { id: 'job-2', bill_to_party: 'customer', customer_id: 'payer-thin', gc_customer_id: null }], error: null }
  const BILLS = { data: [{ id: 'b1', bill_to_party: null, bill_to_email: null }], error: null }
  const waiting = (id: string, over: Record<string, unknown> = {}) => ({ id, stage: 'customer_pay', job_ledger_id: 'job-1', draw_invoice_id: 'b1', payable_after: null, ...over })

  it('is the page’s own weeks for a payer with the history, and nothing for a thin one', async () => {
    const db = dbOf({ jobs_ledger: JOBS, jobs_ledger_invoices: BILLS }, SPEEDS)
    const out = await loadUsualPayWeeks(db, [waiting('s1'), waiting('s2', { job_ledger_id: 'job-2', draw_invoice_id: null })], new Map())
    expect([...out]).toEqual([['s1', { lo: 4, hi: 6 }]])
    expect(db.rpc).toHaveBeenCalledWith('get_billed_customer_pay_speeds')
  })

  it('reads nothing at all when no sheet is waiting with no payment and no pay day', async () => {
    const db = dbOf({}, SPEEDS)
    const sheets = [waiting('s1'), waiting('s2', { payable_after: '2026-11-27' }), waiting('s3', { stage: 'walkthrough' })]
    expect((await loadUsualPayWeeks(db, sheets, new Map([['s1', '2026-11-12']]))).size).toBe(0)
    expect(db.rpc).not.toHaveBeenCalled()
  })

  it('is empty for a role the pay speeds are not shown to', async () => {
    const db = dbOf({ jobs_ledger: JOBS, jobs_ledger_invoices: BILLS }, { data: null, error: null })
    expect((await loadUsualPayWeeks(db, [waiting('s1')], new Map())).size).toBe(0)
  })

  it('is empty when any read is refused or throws, so the ledger beside it still loads', async () => {
    const refused = { data: null, error: { message: 'permission denied' } }
    expect((await loadUsualPayWeeks(dbOf({ jobs_ledger: refused, jobs_ledger_invoices: BILLS }, SPEEDS), [waiting('s1')], new Map())).size).toBe(0)
    expect((await loadUsualPayWeeks(dbOf({ jobs_ledger: JOBS, jobs_ledger_invoices: refused }, SPEEDS), [waiting('s1')], new Map())).size).toBe(0)
    expect((await loadUsualPayWeeks(dbOf({ jobs_ledger: JOBS, jobs_ledger_invoices: BILLS }, refused), [waiting('s1')], new Map())).size).toBe(0)
    const broken = { from: () => ({ select: () => ({}) }) } as unknown as Db
    await expect(loadUsualPayWeeks(broken, [waiting('s1')], new Map())).resolves.toEqual(new Map())
  })
})
