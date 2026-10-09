/**
 * The IO behind the AIA window's applications (v2.5032): `invoice_id` is read when the database
 * has it and the read goes again without it when it does not; the tie's refusals in the office's
 * words. Supabase is a scripted stub.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

type Call = { op: string; cols: string; payload: unknown; filters: Array<[string, unknown]> }
const calls: Call[] = []
let hasInvoiceColumn = true
let updateError: { code: string; message: string } | null = null

const row = (o: Record<string, unknown> = {}) => ({ id: 'a1', job_id: 'j1', application_number: 1, period_to: null, application_date: null, fields: {}, contract_sum_to_date: 0, total_completed_and_stored: 0, retainage_pct: 0, retainage_held: 0, total_earned_less_retainage: 0, current_payment_due: 0, updated_at: null, ...o })

function builder() {
  const call: Call = { op: 'select', cols: '', payload: null, filters: [] }
  calls.push(call)
  const b: Record<string, unknown> = {}
  const chain = () => b
  b.select = (cols: string) => {
    call.cols = cols
    return b
  }
  b.update = (payload: unknown) => {
    call.op = 'update'
    call.payload = payload
    return b
  }
  b.insert = (payload: unknown) => {
    call.op = 'insert'
    call.payload = payload
    return b
  }
  b.eq = (c: string, v: unknown) => {
    call.filters.push([c, v])
    return b
  }
  b.is = chain
  b.not = chain
  b.order = chain
  b.limit = chain
  const answer = () => {
    if (call.cols.includes('invoice_id') && !hasInvoiceColumn) return { data: null, error: { code: '42703', message: 'column job_pay_applications.invoice_id does not exist' } }
    if (call.op === 'update' && !call.cols) return { data: null, error: updateError }
    const one = row(call.cols.includes('invoice_id') ? { invoice_id: 'b1' } : {})
    return { data: call.cols && call.op !== 'select' ? one : [one], error: null }
  }
  b.single = () => Promise.resolve(answer())
  b.then = (res: (v: unknown) => void, rej?: (e: unknown) => void) => Promise.resolve(answer()).then(res, rej)
  return b
}
vi.mock('./supabase', () => ({ supabase: { from: () => builder() } }))

import { PayApplicationBillTaken, PayApplicationTieNotReady, loadDeletedPayApplications, loadPayApplications, savePayApplication, tiePayApplicationBill } from './aiaPayApplicationsIo'
import type { PayApplicationWrite } from './aiaPayApplications'

beforeEach(() => {
  calls.length = 0
  hasInvoiceColumn = true
  updateError = null
})

describe('reading the bill an application became (v2.5032)', () => {
  it('the live list carries it when the database has the column', async () => {
    const [app] = await loadPayApplications('j1')
    expect(app?.invoiceId).toBe('b1')
    expect(calls).toHaveLength(1)
  })
  it('without the column the read goes again without it, and the application carries no bill key', async () => {
    hasInvoiceColumn = false
    const [app] = await loadPayApplications('j1')
    expect(app && 'invoiceId' in app).toBe(false)
    expect(calls.map((c) => c.cols.includes('invoice_id'))).toEqual([true, false])
  })
  it('the deleted list falls back the same way, where it used to come back empty', async () => {
    hasInvoiceColumn = false
    const gone = await loadDeletedPayApplications('j1')
    expect(gone).toHaveLength(1)
    expect(calls.map((c) => c.cols.includes('invoice_id'))).toEqual([true, false])
  })
  it('a save reads the bill back with the row and never writes it', async () => {
    const write = { job_id: 'j1', application_number: 1, fields: {}, lines: [], split_labor_material: false } as unknown as PayApplicationWrite
    const app = await savePayApplication(write, 'a1')
    expect(app.invoiceId).toBe('b1')
    expect(calls[0]?.payload && 'invoice_id' in (calls[0].payload as object)).toBe(false)
  })
})

describe('tiePayApplicationBill', () => {
  it('writes the bill alone on the application', async () => {
    await tiePayApplicationBill('a1', 'b1')
    expect(calls[0]).toMatchObject({ op: 'update', payload: { invoice_id: 'b1' }, filters: [['id', 'a1']] })
    await tiePayApplicationBill('a1', null)
    expect(calls[1]?.payload).toEqual({ invoice_id: null })
  })
  it('says which refusal it met', async () => {
    updateError = { code: '23505', message: 'duplicate key value violates unique constraint "job_pay_applications_invoice_live_uniq"' }
    await expect(tiePayApplicationBill('a1', 'b1')).rejects.toBeInstanceOf(PayApplicationBillTaken)
    updateError = { code: 'PGRST204', message: "Could not find the 'invoice_id' column" }
    await expect(tiePayApplicationBill('a1', 'b1')).rejects.toBeInstanceOf(PayApplicationTieNotReady)
    updateError = { code: '23514', message: 'That bill is on another job.' }
    await expect(tiePayApplicationBill('a1', 'b1')).rejects.toMatchObject({ message: 'That bill is on another job.' })
  })
})
