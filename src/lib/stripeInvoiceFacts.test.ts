import { beforeEach, describe, expect, it, vi } from 'vitest'

const invoke = vi.fn()
vi.mock('./supabase', () => ({ supabase: { functions: { invoke: (...a: unknown[]) => invoke(...a) } } }))
const token = vi.fn(async () => 'tok')
vi.mock('./supabaseAccessTokenForEdge', () => ({ getAccessTokenForEdgeFunctions: () => token() }))

import { clearStripeInvoiceFactsCache, fetchStripeInvoiceFacts, stripeInvoiceFactsFrom, stripeUnixToAppYmd } from './stripeInvoiceFacts'

const ok = (invoice_number: string | null, due_date: number | null) => ({ data: { success: true, currency: 'usd', total: 1000, amount_due: 1000, invoice_number, due_date, lines: [{ description: 'Rough In', quantity: 1, amount: 1000 }] } })

describe('stripeInvoiceFacts (v2.4852)', () => {
  beforeEach(() => {
    invoke.mockReset()
    token.mockClear()
    clearStripeInvoiceFactsCache()
  })

  it("a Stripe due stamp reads as the app calendar's day; none is null", () => {
    // 2026-09-17 05:30 UTC is still September 17 in Central, 2026-09-18 02:00 UTC is still the 17th.
    expect(stripeUnixToAppYmd(Date.UTC(2026, 8, 17, 5, 30) / 1000)).toBe('2026-09-17')
    expect(stripeUnixToAppYmd(Date.UTC(2026, 8, 18, 2, 0) / 1000)).toBe('2026-09-17')
    expect(stripeUnixToAppYmd(null)).toBeNull()
    expect(stripeUnixToAppYmd(0)).toBeNull()
    expect(stripeInvoiceFactsFrom({ invoice_number: '878-2609161138', due_date: null, lines: [] })).toEqual({ invoiceNumber: '878-2609161138', dueYmd: null, lines: [] })
  })

  it('asks once per bill and mode, keeps an answer for the sitting, drops a bill Stripe did not answer for and asks again', async () => {
    invoke.mockResolvedValueOnce(ok('878-2609161138', Date.UTC(2026, 8, 17, 12) / 1000)).mockResolvedValueOnce({ data: { success: false } })
    const first = await fetchStripeInvoiceFacts(['a', 'b', 'a', ' '], 'live')
    expect(invoke).toHaveBeenCalledTimes(2)
    expect(first).toEqual({ a: { invoiceNumber: '878-2609161138', dueYmd: '2026-09-17', lines: [{ description: 'Rough In', quantity: 1, amount: 1000 }] } })
    expect((invoke.mock.calls[0] as unknown[])[1]).toMatchObject({ body: { jobs_ledger_invoice_id: 'a', stripe_mode: 'live' }, headers: { Authorization: 'Bearer tok' } })
    // The kept answer is not asked again; the unanswered bill is.
    invoke.mockResolvedValueOnce(ok('878-2', null))
    const second = await fetchStripeInvoiceFacts(['a', 'b'], 'live')
    expect(invoke).toHaveBeenCalledTimes(3)
    expect(Object.keys(second).sort()).toEqual(['a', 'b'])
    // Test mode is its own answer.
    invoke.mockResolvedValueOnce(ok('t-1', null))
    expect((await fetchStripeInvoiceFacts(['a'], 'test')).a?.invoiceNumber).toBe('t-1')
  })

  it('a thrown call or no token answers with nothing, never throws', async () => {
    invoke.mockRejectedValueOnce(new Error('network'))
    expect(await fetchStripeInvoiceFacts(['a'], 'live')).toEqual({})
    token.mockResolvedValueOnce(null as unknown as string)
    expect(await fetchStripeInvoiceFacts(['a'], 'live')).toEqual({})
    expect(await fetchStripeInvoiceFacts([], 'live')).toEqual({})
  })
})
