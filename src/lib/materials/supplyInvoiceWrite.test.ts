import { describe, expect, it, vi } from 'vitest'
import { allocationRows, saveSupplyInvoice, singleAllocatedJobId, supplyInvoicePayload, type SupplyInvoiceDb, type SupplyInvoiceDraft } from './supplyInvoiceWrite'

vi.mock('../supabase', () => ({ supabase: {} }))

/** The form's one write (punch list #179 PR 2): the payload rules the form always had, and the writes in their order, over a fake database. */

const HOUSE = 'house-ridgeway'
const draft = (over: Partial<SupplyInvoiceDraft> = {}): SupplyInvoiceDraft => ({
  supplyHouseId: HOUSE,
  kind: 'invoice',
  number: ' S1183420 ',
  dateYmd: '2026-10-22',
  dueDateYmd: '2026-11-21',
  amountTyped: '952.28',
  purchaseOrderNumber: '41207',
  link: '',
  isPaid: false,
  paidOnYmd: '',
  onJobAccount: true,
  allocations: [{ job_id: 'job-1042', pct: 100 }],
  creditsInvoiceId: '',
  ...over,
})

function fakeDb(over: Partial<SupplyInvoiceDb> = {}): SupplyInvoiceDb & { calls: string[] } {
  const calls: string[] = []
  return {
    calls,
    insertInvoice: vi.fn(async () => (calls.push('insert'), { id: 'inv-new', error: null })),
    updateInvoice: vi.fn(async () => (calls.push('update'), { error: null })),
    deleteAllocations: vi.fn(async () => (calls.push('deleteAllocations'), { error: null })),
    insertAllocations: vi.fn(async () => (calls.push('insertAllocations'), { error: null })),
    ...over,
  }
}

describe('supplyInvoicePayload', () => {
  it('builds the row as the form always did: trimmed number, nulls for blanks, the sign from the kind', () => {
    const built = supplyInvoicePayload(draft(), null)
    expect(built).toEqual({
      ok: true,
      payload: {
        supply_house_id: HOUSE,
        invoice_number: 'S1183420',
        invoice_date: '2026-10-22',
        due_date: '2026-11-21',
        amount: 952.28,
        document_kind: 'invoice',
        link: null,
        is_paid: false,
        purchase_order_number: '41207',
        on_job_account: true,
      },
    })
  })
  it('a credit is negative, pairs to its invoice, and never carries the job-account flag on a split', () => {
    const built = supplyInvoicePayload(draft({ kind: 'credit', amountTyped: '138.99', creditsInvoiceId: 'inv-1', allocations: [{ job_id: 'a', pct: 50 }, { job_id: 'b', pct: 50 }] }), null)
    expect(built.ok && built.payload).toMatchObject({ amount: -138.99, document_kind: 'credit', credits_invoice_id: 'inv-1' })
    expect(built.ok && 'on_job_account' in built.payload).toBe(false)
  })
  it('sends on_job_account, credits_invoice_id and paid_at only when they change', () => {
    const same = supplyInvoicePayload(draft({ isPaid: true, paidOnYmd: '2026-10-28' }), { id: 'inv-1', on_job_account: true, paid_at: '2026-10-28T17:00:00.000Z', credits_invoice_id: null })
    expect(same.ok && same.payload).not.toHaveProperty('on_job_account')
    expect(same.ok && same.payload).not.toHaveProperty('paid_at')
    const flipped = supplyInvoicePayload(draft({ onJobAccount: false, isPaid: true, paidOnYmd: '2026-10-27' }), { id: 'inv-1', on_job_account: true, paid_at: '2026-10-28T17:00:00.000Z' })
    expect(flipped.ok && flipped.payload).toMatchObject({ on_job_account: false, paid_at: expect.stringMatching(/^2026-10-27T/) })
  })
  it('names the one problem that stops it', () => {
    expect(supplyInvoicePayload(draft({ number: '  ' }), null)).toEqual({ ok: false, problem: 'The number and the date are needed.' })
    expect(supplyInvoicePayload(draft({ amountTyped: '-5' }), null)).toMatchObject({ ok: false, problem: expect.stringContaining('positive') })
    expect(supplyInvoicePayload(draft({ amountTyped: 'abc' }), null)).toEqual({ ok: false, problem: 'Amount must be a number.' })
    expect(supplyInvoicePayload(draft({ kind: 'credit', amountTyped: '0' }), null).ok).toBe(false)
  })
  it('carries the read a filled bill keeps only when the draft has one', () => {
    expect(supplyInvoicePayload(draft(), null).ok && 'bill_read' in (supplyInvoicePayload(draft(), null) as { payload: object }).payload).toBe(false)
    const read = { v: 1 as const, model: 'm', readAt: 't', readId: null, file: { path: 'p', name: 'n', mime: null, attachmentId: 'att-1' }, houseName: 'Ridgeway Supply', fields: {} as never, lines: [], totals: { subtotalCents: null, taxCents: null, totalCents: 95228 }, checks: { sum: { kind: 'none' as const }, duplicate: null, statement: null, house: 'same' as const }, notes: '' }
    const built = supplyInvoicePayload(draft({ billRead: read, billAttachmentId: 'att-1' }), null)
    expect(built.ok && built.payload).toMatchObject({ bill_read: read, bill_attachment_id: 'att-1' })
    const cleared = supplyInvoicePayload(draft({ billRead: null }), null)
    expect(cleared.ok && cleared.payload).toMatchObject({ bill_read: null, bill_attachment_id: null })
  })
  it('the whole invoice is on one job only when one job holds it', () => {
    expect(singleAllocatedJobId([{ job_id: 'a', pct: 100 }])).toBe('a')
    expect(singleAllocatedJobId([{ job_id: 'a', pct: 50 }, { job_id: 'b', pct: 50 }])).toBeNull()
    expect(singleAllocatedJobId([])).toBeNull()
    expect(allocationRows('inv', [{ job_id: 'a', pct: 60 }, { job_id: '', pct: 40 }, { job_id: 'c', pct: 0 }])).toEqual([{ invoice_id: 'inv', job_id: 'a', pct: 60 }])
  })
})

describe('saveSupplyInvoice', () => {
  it('a new row: insert, then the allocations deleted and inserted', async () => {
    const db = fakeDb()
    const saved = await saveSupplyInvoice(db, draft(), null)
    expect(saved).toEqual({ ok: true, id: 'inv-new', allocationProblem: null })
    expect(db.calls).toEqual(['insert', 'deleteAllocations', 'insertAllocations'])
    expect(db.insertAllocations).toHaveBeenCalledWith([{ invoice_id: 'inv-new', job_id: 'job-1042', pct: 100 }])
  })
  it('an edit with no jobs left: update, then the old allocations deleted', async () => {
    const db = fakeDb()
    const saved = await saveSupplyInvoice(db, draft({ allocations: [] }), { id: 'inv-1' })
    expect(saved).toEqual({ ok: true, id: 'inv-1', allocationProblem: null })
    expect(db.calls).toEqual(['update', 'deleteAllocations'])
  })
  it('a new row with no jobs touches no allocations', async () => {
    const db = fakeDb()
    await saveSupplyInvoice(db, draft({ allocations: [] }), null)
    expect(db.calls).toEqual(['insert'])
  })
  it('a row that fails stops with its reason; allocations that fail leave the row and name theirs', async () => {
    const refused = fakeDb({ insertInvoice: vi.fn(async () => ({ id: null, error: { message: 'new row violates row-level security policy' } })) })
    expect(await saveSupplyInvoice(refused, draft(), null)).toMatchObject({ ok: false, problem: expect.stringContaining('row-level security') })
    const partly = fakeDb({ insertAllocations: vi.fn(async () => ({ error: { message: 'job_id is not a job' } })) })
    expect(await saveSupplyInvoice(partly, draft(), null)).toMatchObject({ ok: true, id: 'inv-new', allocationProblem: expect.stringContaining('not a job') })
  })
  it('a bad draft never reaches the database', async () => {
    const db = fakeDb()
    expect(await saveSupplyInvoice(db, draft({ amountTyped: 'x' }), null)).toEqual({ ok: false, problem: 'Amount must be a number.' })
    expect(db.calls).toEqual([])
  })
})
