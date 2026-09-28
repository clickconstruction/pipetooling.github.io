/**
 * What the office reads after pressing Send Email invoice: who sent the bill email and where
 * it went. `send-stripe-invoice` answers with the outcome (`billEmailPlan.ts`); an answer
 * without one is the function before the bill email was ours, where Stripe always sent it.
 */
import type { BillEmailOutcome } from '../../../supabase/functions/_shared/billEmailPlan'

export type { BillEmailOutcome }

const STRIPE_TEST_HINT = ' Test mode: Stripe does not deliver a real customer email, but the send succeeded.'

/** The outcome in the function's answer, or Stripe's for an answer that names none. */
export function parseBillEmailOutcome(body: unknown): BillEmailOutcome {
  const b = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>
  const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '')
  const reason = str(b.fallback_reason)
  return {
    sent_by: b.sent_by === 'clicktooling' ? 'clicktooling' : 'stripe',
    delivered_to: str(b.delivered_to) || str(b.customer_email),
    ...(reason === 'no_resend_key' || reason === 'test_without_sender' || reason === 'send_failed' ? { fallback_reason: reason } : {}),
    ...(b.test_redirected === true ? { test_redirected: true } : {}),
  }
}

/** The success line — the toast, and the green line under the button. */
export function billEmailSentMessage(outcome: BillEmailOutcome, stripeMode: 'test' | 'live'): string {
  if (outcome.sent_by === 'clicktooling') {
    if (outcome.test_redirected) return `Test bill: the email came to you${outcome.delivered_to ? ` (${outcome.delivered_to})` : ''}, not the customer.`
    return outcome.delivered_to ? `Bill email sent to ${outcome.delivered_to}.` : 'Bill email sent.'
  }
  const testHint = stripeMode === 'test' ? STRIPE_TEST_HINT : ''
  if (outcome.fallback_reason === 'send_failed' || outcome.fallback_reason === 'no_resend_key') {
    return `Stripe sent the invoice email — ours could not go out, so this one has no account code.${testHint}`
  }
  return `Stripe sent the invoice email.${testHint}`
}
