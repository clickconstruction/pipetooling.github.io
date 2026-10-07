import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('./supabase', () => ({ supabase: { functions: { invoke: vi.fn() } } }))

import { supabase } from './supabase'
import { invokeMarkStripeInvoiceUncollectible } from './markStripeInvoiceUncollectible'

const invoke = supabase.functions.invoke as unknown as ReturnType<typeof vi.fn>

describe('invokeMarkStripeInvoiceUncollectible (punch list #94, v2.4792)', () => {
  beforeEach(() => invoke.mockReset())

  it('calls the function with the bill and the mode, and reads Stripe\'s status back', async () => {
    invoke.mockResolvedValue({ data: { success: true, stripe_status: 'uncollectible' }, error: null })
    const r = await invokeMarkStripeInvoiceUncollectible({ invoiceId: 'inv-1', stripeModeForBilling: 'live', accessToken: 'tok' })
    expect(r).toEqual({ ok: true, stripeStatus: 'uncollectible' })
    expect(invoke).toHaveBeenCalledWith('mark-stripe-invoice-uncollectible', expect.objectContaining({ body: expect.objectContaining({ jobs_ledger_invoice_id: 'inv-1' }), headers: { Authorization: 'Bearer tok' } }))
  })

  it('surfaces the function\'s own refusal and a transport error as plain words', async () => {
    invoke.mockResolvedValue({ data: { error: 'Invoice must be in Billed status' }, error: null })
    expect(await invokeMarkStripeInvoiceUncollectible({ invoiceId: 'inv-1', stripeModeForBilling: 'live', accessToken: 'tok' })).toEqual({ ok: false, message: 'Invoice must be in Billed status' })
    invoke.mockResolvedValue({ data: null, error: new Error('network down') })
    const r = await invokeMarkStripeInvoiceUncollectible({ invoiceId: 'inv-1', stripeModeForBilling: 'live', accessToken: 'tok' })
    expect(r.ok).toBe(false)
  })
})
