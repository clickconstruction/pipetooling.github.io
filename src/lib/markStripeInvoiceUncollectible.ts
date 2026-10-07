import { supabase } from './supabase'
import { readEdgeFunctionErrorBody } from './readEdgeFunctionErrorBody'
import { formatErrorMessage } from '../utils/errorHandling'
import type { BillingStripeModePref } from './billingStripeModePref'
import { stripeModeInvokeBody } from './billingStripeModePref'

/**
 * The office gave up on a job: its Stripe invoice is marked uncollectible too (punch list #94,
 * v2.4792 — the owner's call). Idempotent on the server; a bill with no Stripe invoice answers ok.
 */
export async function invokeMarkStripeInvoiceUncollectible(params: {
  invoiceId: string
  stripeModeForBilling: BillingStripeModePref
  accessToken: string
}): Promise<{ ok: true; stripeStatus: string | null } | { ok: false; message: string }> {
  const { data: raw, error: fnErr } = await supabase.functions.invoke('mark-stripe-invoice-uncollectible', {
    body: { jobs_ledger_invoice_id: params.invoiceId, ...stripeModeInvokeBody(params.stripeModeForBilling) },
    headers: { Authorization: `Bearer ${params.accessToken}` },
  })
  if (fnErr) {
    const detail = await readEdgeFunctionErrorBody(fnErr)
    return { ok: false, message: detail ?? formatErrorMessage(fnErr, 'Stripe could not be marked uncollectible') }
  }
  const body = raw as Record<string, unknown> | null
  if (body && typeof body.error === 'string' && body.error.length > 0) return { ok: false, message: body.error }
  if (body?.success === true) return { ok: true, stripeStatus: typeof body.stripe_status === 'string' ? body.stripe_status : null }
  return { ok: false, message: 'Unexpected response from server' }
}
