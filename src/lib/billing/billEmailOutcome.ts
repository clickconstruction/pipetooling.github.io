/**
 * What the office reads after pressing Send Email invoice: who sent the bill email and where
 * it went, and what became of the copies. `send-stripe-invoice` answers with the outcome
 * (`billEmailPlan.ts`, `billCopyPlan.ts`); an answer without one is the function before the
 * bill email was ours, where Stripe always sent it.
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

/** The copies as the client reads them off the function's answer. */
export type BillCopiesRead = {
  /** The copy-list addresses a copy went to. */
  sent: string[]
  failedCount: number
  /** A test-mode bill: the sender's address, when the one test copy reached it. */
  testTo: string | null
  /** A test-mode bill: the copy list, which nothing went to. Null on a live bill. */
  heldBack: string[] | null
}

export function parseBillCopiesOutcome(body: unknown): BillCopiesRead {
  const b = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>
  const emails = (v: unknown) => (Array.isArray(v) ? v.filter((e): e is string => typeof e === 'string' && e.trim() !== '').map((e) => e.trim()) : [])
  const testTo = typeof b.copies_test_to === 'string' ? b.copies_test_to.trim() : ''
  const isTest = Array.isArray(b.copies_held_back) || testTo !== '' || b.copies_skipped === 'test_without_sender'
  return {
    sent: emails(b.copies_sent),
    failedCount: Array.isArray(b.copies_failed) ? b.copies_failed.length : 0,
    testTo: testTo || null,
    heldBack: isTest ? emails(b.copies_held_back) : null,
  }
}

/** What the success toast adds about the copies; '' when there is nothing to say. Starts with a space. */
export function billCopiesSentHint(copies: BillCopiesRead): string {
  if (copies.heldBack == null) return copies.sent.length > 0 ? ` Copies went to ${copies.sent.join(', ')}.` : ''
  const spared = copies.heldBack.length > 0 ? `nothing went to ${copies.heldBack.join(', ')}` : ''
  if (copies.testTo) return spared ? ` The copy came to you too; ${spared}.` : ' The copy came to you too.'
  return spared ? ` No copy went out; ${spared}.` : ''
}

/** The error toast for copies that could not be sent, or null. */
export function billCopiesFailedMessage(copies: BillCopiesRead): string | null {
  if (copies.failedCount <= 0) return null
  if (copies.heldBack != null) return 'The test copy could not be sent to you. Nothing went to the copy list.'
  return `${copies.failedCount} copy email${copies.failedCount === 1 ? '' : 's'} failed to send — the payer's own email went out.`
}
