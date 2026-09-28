/**
 * Who sends a Stripe bill's email, and to whom — decided before anything goes out.
 *
 * Ours is the default (`stripeBillEmail.ts`). Stripe's own stays one secret away
 * (`BILL_EMAIL_SENDER=stripe`) and is also where a send falls when ours cannot go: no Resend
 * key, or Resend refused the email — a bill that reaches the customer from Stripe beats one
 * that reached nobody. A test-mode bill never reaches a customer: Stripe delivers nothing in
 * test mode, and ours goes to whoever pressed Send, marked as a test. Pure; tested from
 * `src/lib/billing/billEmailPlan.test.ts`.
 */

export type BillEmailSender = 'clicktooling' | 'stripe'

/** The function secret's reading: only the exact word `stripe` hands the email back to Stripe. */
export function billEmailSenderFromEnv(raw: string | null | undefined): BillEmailSender {
  return (raw ?? '').trim().toLowerCase() === 'stripe' ? 'stripe' : 'clicktooling'
}

export type BillEmailPlan =
  | { via: 'stripe'; reason: 'configured' | 'no_resend_key' | 'test_without_sender' }
  | {
      via: 'clicktooling'
      /** The address the email goes to. */
      to: string
      /** Set on a test-mode bill: the customer's address, which the email did NOT go to. */
      testIntendedFor: string | null
    }

export function planBillEmail(input: {
  sender: BillEmailSender
  hasResendKey: boolean
  stripeMode: 'test' | 'live'
  /** The payer's address, as Stripe holds it. */
  customerEmail: string
  /** The signed-in sender's address. */
  callerEmail: string | null | undefined
}): BillEmailPlan {
  if (input.sender === 'stripe') return { via: 'stripe', reason: 'configured' }
  if (!input.hasResendKey) return { via: 'stripe', reason: 'no_resend_key' }
  const customer = input.customerEmail.trim()
  if (input.stripeMode === 'test') {
    const caller = (input.callerEmail ?? '').trim()
    if (!caller) return { via: 'stripe', reason: 'test_without_sender' }
    return { via: 'clicktooling', to: caller, testIntendedFor: customer }
  }
  return { via: 'clicktooling', to: customer, testIntendedFor: null }
}

/** What the function answers the client, so the toast names who sent the email and where it went. */
export type BillEmailOutcome = {
  sent_by: BillEmailSender
  /** The address the email went to (Stripe's: the customer's). */
  delivered_to: string
  /** Why Stripe sent it when ours was meant to; absent when ours went or Stripe is configured. */
  fallback_reason?: 'no_resend_key' | 'test_without_sender' | 'send_failed'
  /** True when a test-mode bill went to the sender instead of the customer. */
  test_redirected?: boolean
}
