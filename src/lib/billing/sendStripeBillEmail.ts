/**
 * The one call that emails a Stripe bill (punch list #343, PR 3). **Send Email invoice** made it inside its own button
 * (`StripeInvoiceSendFromStripeButton`). Bill Customer's one press, *Make the bill and email Dana*, makes the same call
 * right after the bill is made, so the call and the reading of its answer live here and both callers share them. Edge
 * function `send-stripe-invoice`: our own email through Resend with the Pay now button and Stripe's PDF, Stripe's own
 * as the fallback, a copy of their own to each address on the row's `copy_emails`. A test-mode bill comes to the
 * sender. The words of the answer are `billEmailOutcome.ts`'s.
 */
import { supabase } from '../supabase'
import type { BillingStripeModePref } from '../billingStripeModePref'
import { stripeModeInvokeBody } from '../billingStripeModePref'
import { readEdgeFunctionErrorBody } from '../readEdgeFunctionErrorBody'
import { formatErrorMessage } from '../../utils/errorHandling'
import { billCopiesFailedMessage, billCopiesSentHint, billEmailSentMessage, parseBillCopiesOutcome, parseBillEmailOutcome } from './billEmailOutcome'

export type SendStripeBillEmailResult =
  /** `line` is what went and to whom; `copiesHint` rides after it ('' with no copies); `copiesFailed` names a copy that did not go. */
  { ok: true; line: string; copiesHint: string; copiesFailed: string | null } | { ok: false; error: string }

export const BILL_EMAIL_NOT_SENT_FALLBACK = 'Could not send the bill email'

export async function sendStripeBillEmail(jobsLedgerInvoiceId: string, stripeModeForBilling: BillingStripeModePref): Promise<SendStripeBillEmailResult> {
  try {
    const { data: auth } = await supabase.auth.getSession()
    const token = auth.session?.access_token
    if (!token) return { ok: false, error: 'Not signed in' }

    const { data: raw, error: fnErr } = await supabase.functions.invoke('send-stripe-invoice', {
      body: { jobs_ledger_invoice_id: jobsLedgerInvoiceId.trim(), ...stripeModeInvokeBody(stripeModeForBilling) },
      headers: { Authorization: `Bearer ${token}` },
    })
    if (fnErr) {
      const detail = await readEdgeFunctionErrorBody(fnErr)
      return { ok: false, error: detail ?? formatErrorMessage(fnErr, BILL_EMAIL_NOT_SENT_FALLBACK) }
    }
    const body = raw as Record<string, unknown> | null
    if (body && typeof body.error === 'string' && body.error.length > 0) return { ok: false, error: body.error }
    if (body?.success !== true) return { ok: false, error: 'Unexpected response from server' }

    const copies = parseBillCopiesOutcome(body)
    return {
      ok: true,
      line: billEmailSentMessage(parseBillEmailOutcome(body), stripeModeForBilling === 'test' ? 'test' : 'live'),
      copiesHint: billCopiesSentHint(copies),
      copiesFailed: billCopiesFailedMessage(copies),
    }
  } catch (e) {
    return { ok: false, error: formatErrorMessage(e, BILL_EMAIL_NOT_SENT_FALLBACK) }
  }
}

/** Survives a parent remount after the send (a refetch) so the inline line stays; holds the line itself. */
export function stripeEmailSentSessionKey(jobsLedgerInvoiceId: string, stripeInvoiceId: string): string {
  return `pt-stripe-invoice-email-sent:${jobsLedgerInvoiceId}:${stripeInvoiceId}`
}

/** Keep the sent line for this bill, so the Send Email invoice button reads *sent* wherever it next mounts. */
export function rememberBillEmailSent(jobsLedgerInvoiceId: string, stripeInvoiceId: string, line: string): void {
  try {
    const jid = jobsLedgerInvoiceId.trim()
    const sid = stripeInvoiceId.trim()
    if (jid && sid) sessionStorage.setItem(stripeEmailSentSessionKey(jid, sid), line)
  } catch {
    /* private mode */
  }
}

export function forgetBillEmailSent(jobsLedgerInvoiceId: string, stripeInvoiceId: string): void {
  try {
    const jid = jobsLedgerInvoiceId.trim()
    const sid = stripeInvoiceId.trim()
    if (jid && sid) sessionStorage.removeItem(stripeEmailSentSessionKey(jid, sid))
  } catch {
    /* private mode */
  }
}
