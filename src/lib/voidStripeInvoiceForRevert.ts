import { supabase } from './supabase'
import { readEdgeFunctionErrorBody } from './readEdgeFunctionErrorBody'
import { formatErrorMessage, withSupabaseRetry } from '../utils/errorHandling'
import type { BillingStripeModePref } from './billingStripeModePref'
import { getBillingStripeModePref, stripeModeInvokeBody } from './billingStripeModePref'

export type StripeInvoiceRevertPick = {
  status: string
  stripe_invoice_id?: string | null
  external_send_channel?: string | null
}

export function invoiceNeedsStripeVoidForRevert(inv: StripeInvoiceRevertPick): boolean {
  if (inv.status !== 'billed') return false
  if ((inv.stripe_invoice_id ?? '').trim().length > 0) return true
  return inv.external_send_channel === 'stripe'
}

export function stripeModeForBillingFromRole(authRole: string | null): BillingStripeModePref {
  return authRole === 'dev' ? getBillingStripeModePref() : 'live'
}

export async function invokeVoidStripeInvoiceForRevert(params: {
  invoiceId: string
  stripeModeForBilling: BillingStripeModePref
  accessToken: string
}): Promise<{ ok: true } | { ok: false; message: string }> {
  const { data: raw, error: fnErr } = await supabase.functions.invoke('void-stripe-invoice-for-revert', {
    body: {
      jobs_ledger_invoice_id: params.invoiceId,
      ...stripeModeInvokeBody(params.stripeModeForBilling),
    },
    headers: { Authorization: `Bearer ${params.accessToken}` },
  })
  if (fnErr) {
    const detail = await readEdgeFunctionErrorBody(fnErr)
    return { ok: false, message: detail ?? formatErrorMessage(fnErr, 'Failed to void Stripe invoice') }
  }
  const body = raw as Record<string, unknown> | null
  if (body && typeof body.error === 'string' && body.error.length > 0) {
    return { ok: false, message: body.error }
  }
  if (body?.success === true) {
    return { ok: true }
  }
  return { ok: false, message: 'Unexpected response from server' }
}

const NOT_BILLED_SEND_BACK_ERROR = 'Invoice is not Billed Awaiting Payment'

/**
 * After void-stripe-invoice-for-revert succeeds: current Edge deletes the row; older Edge only
 * reverted to ready_to_bill. Ensure the ledger line is gone so no stray "draft" remains.
 */
export async function ensureLedgerInvoiceRemovedAfterStripeSendBack(
  invoiceId: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    const data = await withSupabaseRetry(
      async () => await supabase.rpc('delete_billed_invoice_on_send_back', { p_invoice_id: invoiceId }),
      'delete_billed_invoice_on_send_back',
    )
    const result = data as { ok?: boolean; error?: string } | null
    if (result?.ok) {
      return { ok: true }
    }
    const errMsg = result?.error ?? 'Failed to remove billing line'
    if (errMsg === NOT_BILLED_SEND_BACK_ERROR) {
      const d2 = await withSupabaseRetry(
        async () => await supabase.rpc('delete_ready_to_bill_invoice', { p_invoice_id: invoiceId }),
        'delete_ready_to_bill_invoice',
      )
      const r2 = d2 as { ok?: boolean; error?: string } | null
      if (!r2?.ok) {
        return { ok: false, message: r2?.error ?? errMsg }
      }
      return { ok: true }
    }
    return { ok: false, message: errMsg }
  } catch (e: unknown) {
    return { ok: false, message: formatErrorMessage(e, 'Failed to remove billing line') }
  }
}

/** All billed invoice rows for a job: void Stripe-backed lines via Edge (deletes row); others deleted via RPC. */
export async function prepareBilledInvoicesBeforeJobRevertToReadyToBill(params: {
  jobId: string
  authRole: string | null
  accessToken: string
}): Promise<{ ok: true } | { ok: false; message: string }> {
  const { data: rows, error } = await supabase
    .from('jobs_ledger_invoices')
    .select('id, status, stripe_invoice_id, external_send_channel')
    .eq('job_id', params.jobId)
    .eq('status', 'billed')
  if (error) return { ok: false, message: error.message }

  const mode = stripeModeForBillingFromRole(params.authRole)
  for (const row of rows ?? []) {
    if (invoiceNeedsStripeVoidForRevert(row)) {
      const r = await invokeVoidStripeInvoiceForRevert({
        invoiceId: row.id,
        stripeModeForBilling: mode,
        accessToken: params.accessToken,
      })
      if (!r.ok) return r
      const cleaned = await ensureLedgerInvoiceRemovedAfterStripeSendBack(row.id)
      if (!cleaned.ok) return cleaned
    } else {
      try {
        const data = await withSupabaseRetry(
          async () =>
            await supabase.rpc('delete_billed_invoice_on_send_back', { p_invoice_id: row.id }),
          'delete_billed_invoice_on_send_back',
        )
        const result = data as { ok?: boolean; error?: string } | null
        if (!result?.ok) {
          return { ok: false, message: result?.error ?? 'Failed to remove billed invoice' }
        }
      } catch (e: unknown) {
        return { ok: false, message: formatErrorMessage(e, 'Failed to remove billed invoice') }
      }
    }
  }
  return { ok: true }
}
