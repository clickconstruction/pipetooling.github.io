import { describe, expect, it, vi } from 'vitest'
import { loadCustomerPaidDays, loadDrawTieSheet, loadDrawTies, saveDrawBill } from './drawTieIo'

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
