/**
 * The writes behind the closed end's window, with every function they call mocked: the order of Let it go's steps,
 * what stops it, what is passed on, and what a failure at Stripe does. Made-up ids only.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'

const m = vi.hoisted(() => ({
  rows: { legal_matters: [] as unknown[], jobs_ledger_invoices: [] as unknown[] },
  asked: [] as Array<{ table: string; column: string; value: unknown }>,
  setJobCollectionsFlag: vi.fn(),
  setJobUncollectible: vi.fn(),
  invokeMarkStripeInvoiceUncollectible: vi.fn(),
  getAccessTokenForEdgeFunctions: vi.fn(),
  setJobLienPathAnswer: vi.fn(),
  noteLienWindowMissed: vi.fn(),
}))
vi.mock('../supabase', () => ({
  supabase: {
    from: (table: 'legal_matters' | 'jobs_ledger_invoices') => ({
      select: () => ({
        eq: (column: string, value: unknown) => {
          m.asked.push({ table, column, value })
          return Promise.resolve({ data: m.rows[table], error: null })
        },
      }),
    }),
  },
}))
vi.mock('../setJobCollectionsFlag', () => ({ setJobCollectionsFlag: m.setJobCollectionsFlag }))
vi.mock('../setJobUncollectible', () => ({ setJobUncollectible: m.setJobUncollectible }))
vi.mock('../markStripeInvoiceUncollectible', () => ({ invokeMarkStripeInvoiceUncollectible: m.invokeMarkStripeInvoiceUncollectible }))
vi.mock('../supabaseAccessTokenForEdge', () => ({ getAccessTokenForEdgeFunctions: m.getAccessTokenForEdgeFunctions }))
vi.mock('../voidStripeInvoiceForRevert', () => ({ stripeModeForBillingFromRole: (role: string | null) => (role === 'dev' ? 'test' : 'live') }))
vi.mock('./lienJobPathIo', () => ({ setJobLienPathAnswer: m.setJobLienPathAnswer }))
vi.mock('./lienDeskIo', () => ({ noteLienWindowMissed: m.noteLienWindowMissed }))

import { keepCollectingLienClosed, letLienClosedJobGo, readLienClosedFirmWarning, recordLienMonthsClosed } from './lienClosedEndIo'

const REASON = 'The lien day passed on Nov 16 with no lien filed. The office let it go.'

afterEach(() => {
  m.rows.legal_matters = []
  m.rows.jobs_ledger_invoices = []
  m.asked.length = 0
  for (const fn of [m.setJobCollectionsFlag, m.setJobUncollectible, m.invokeMarkStripeInvoiceUncollectible, m.getAccessTokenForEdgeFunctions, m.setJobLienPathAnswer, m.noteLienWindowMissed]) fn.mockReset()
})

describe('Keep collecting', () => {
  it('takes the job off the lien path with the reason, and asks for Collections only when the job is not there', async () => {
    m.setJobLienPathAnswer.mockResolvedValue({ answer: 'off_path', changed: true, onAttorneyList: true, alreadyOnList: false, held: null })
    await keepCollectingLienClosed({ jobId: 'j1', reason: 'r', inCollections: false })
    expect(m.setJobLienPathAnswer).toHaveBeenLastCalledWith({ jobId: 'j1', answer: 'off_path', reason: 'r', attorneyList: true })
    await keepCollectingLienClosed({ jobId: 'j1', reason: 'r', inCollections: true })
    expect(m.setJobLienPathAnswer).toHaveBeenLastCalledWith({ jobId: 'j1', answer: 'off_path', reason: 'r', attorneyList: false })
  })
})

describe('Let it go', () => {
  it('marks a Collections job and leaves the Collections flag alone', async () => {
    m.setJobUncollectible.mockResolvedValue({ ok: true })
    expect(await letLienClosedJobGo({ jobId: 'j1', reason: REASON, inCollections: true, authRole: 'assistant' })).toEqual({ stripe: [] })
    expect(m.setJobCollectionsFlag).not.toHaveBeenCalled()
    expect(m.setJobUncollectible).toHaveBeenCalledWith('j1', true, REASON)
    // No bill on Stripe: Stripe is not called, and no token is asked for.
    expect(m.getAccessTokenForEdgeFunctions).not.toHaveBeenCalled()
  })

  it('puts a job in Collections first, since the mark takes a Collections job only, and stops when that is refused', async () => {
    const order: string[] = []
    m.setJobCollectionsFlag.mockImplementation(async () => (order.push('collections'), { ok: true }))
    m.setJobUncollectible.mockImplementation(async () => (order.push('mark'), { ok: true }))
    await letLienClosedJobGo({ jobId: 'j1', reason: REASON, inCollections: false, authRole: 'assistant' })
    expect(order).toEqual(['collections', 'mark'])
    expect(m.setJobCollectionsFlag).toHaveBeenCalledWith('j1', true, REASON)
    m.setJobCollectionsFlag.mockResolvedValue({ ok: false, error: 'Only a billed job can go to Collections' })
    m.setJobUncollectible.mockClear()
    await expect(letLienClosedJobGo({ jobId: 'j1', reason: REASON, inCollections: false, authRole: 'assistant' })).rejects.toThrow('Only a billed job can go to Collections')
    expect(m.setJobUncollectible).not.toHaveBeenCalled()
  })

  it('throws the reason when the mark is refused, and never reaches Stripe', async () => {
    m.rows.jobs_ledger_invoices = [{ id: 'i1', status: 'billed', stripe_invoice_id: 'in_1' }]
    m.setJobUncollectible.mockResolvedValue({ ok: false, error: 'Not allowed' })
    await expect(letLienClosedJobGo({ jobId: 'j1', reason: REASON, inCollections: true, authRole: 'assistant' })).rejects.toThrow('Not allowed')
    expect(m.invokeMarkStripeInvoiceUncollectible).not.toHaveBeenCalled()
  })

  it('marks each billed Stripe invoice too, in the viewer’s Stripe mode, and names one Stripe refused without undoing the mark', async () => {
    m.rows.jobs_ledger_invoices = [
      { id: 'i1', status: 'billed', stripe_invoice_id: 'in_1' },
      { id: 'i2', status: 'billed', stripe_invoice_id: 'in_2' },
      { id: 'i3', status: 'billed', stripe_invoice_id: null },
      { id: 'i4', status: 'ready_to_bill', stripe_invoice_id: 'in_4' },
    ]
    m.setJobUncollectible.mockResolvedValue({ ok: true })
    m.getAccessTokenForEdgeFunctions.mockResolvedValue('token')
    m.invokeMarkStripeInvoiceUncollectible.mockResolvedValueOnce({ ok: true, stripeStatus: 'uncollectible' }).mockResolvedValueOnce({ ok: false, message: 'No such invoice' })
    expect(await letLienClosedJobGo({ jobId: 'j1', reason: REASON, inCollections: true, authRole: 'assistant' })).toEqual({ stripe: ['No such invoice'] })
    expect(m.asked).toContainEqual({ table: 'jobs_ledger_invoices', column: 'job_id', value: 'j1' })
    expect(m.invokeMarkStripeInvoiceUncollectible.mock.calls.map((c) => c[0])).toEqual([
      { invoiceId: 'i1', stripeModeForBilling: 'live', accessToken: 'token' },
      { invoiceId: 'i2', stripeModeForBilling: 'live', accessToken: 'token' },
    ])
    expect(m.setJobUncollectible).toHaveBeenCalledTimes(1)
  })

  it('says so when nobody is signed in for the Stripe call', async () => {
    m.rows.jobs_ledger_invoices = [{ id: 'i1', status: 'billed', stripe_invoice_id: 'in_1' }]
    m.setJobUncollectible.mockResolvedValue({ ok: true })
    m.getAccessTokenForEdgeFunctions.mockResolvedValue(null)
    expect(await letLienClosedJobGo({ jobId: 'j1', reason: REASON, inCollections: true, authRole: 'dev' })).toEqual({ stripe: ['not signed in for the Stripe call'] })
    expect(m.invokeMarkStripeInvoiceUncollectible).not.toHaveBeenCalled()
  })
})

describe('Record it closed', () => {
  it('writes the months and who looked, with a blank notice since the job has no draft here', async () => {
    m.noteLienWindowMissed.mockResolvedValue(undefined)
    await recordLienMonthsClosed({ jobId: 'j3', months: ['2026-08'], userId: 'u1', userName: 'Dana' })
    const input = m.noteLienWindowMissed.mock.calls[0]![0]
    expect(input).toMatchObject({ jobId: 'j3', months: ['2026-08'], userId: 'u1', userName: 'Dana' })
    expect(input.fields.gcEmail).toBe('')
    expect(input.fields.notice.claimAmount).toBe('')
  })
})

describe('the Legal desk’s warning', () => {
  it('reads the payer’s matter, the GC before the customer, and warns only while a law firm holds the account', async () => {
    m.rows.legal_matters = [{ stage: 'firm_demand', closed_at: null }]
    const warned = await readLienClosedFirmWarning({ gc_customer_id: 'gc1', customer_id: 'c1' })
    expect(m.asked).toContainEqual({ table: 'legal_matters', column: 'payer_key', value: 'c:gc1' })
    expect(warned === null || warned.startsWith('The Legal desk has this account with the firm')).toBe(true)
    m.rows.legal_matters = []
    expect(await readLienClosedFirmWarning({ gc_customer_id: null, customer_id: 'c1' })).toBeNull()
    expect(m.asked).toContainEqual({ table: 'legal_matters', column: 'payer_key', value: 'c:c1' })
    // No payer to read by: nothing is asked.
    m.asked.length = 0
    expect(await readLienClosedFirmWarning({ gc_customer_id: null, customer_id: null })).toBeNull()
    expect(m.asked).toEqual([])
  })
})
