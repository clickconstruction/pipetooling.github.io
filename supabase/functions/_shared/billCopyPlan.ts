/**
 * Who a Stripe bill's copies go to — decided before any copy goes out.
 *
 * A live bill copies every address on the bill's copy list, one email each
 * (`stripeBillCopyEmail.ts`). A test-mode bill never reaches a customer-side address — the
 * customer's contact persons, the GC, a one-off: ONE copy goes to whoever pressed Send, marked
 * as a test and naming the addresses it did not go to, the way the payer's own email does
 * (`billEmailPlan.ts`). A test bill with no sender address copies nobody. Pure; tested from
 * `src/lib/billing/billCopyPlan.test.ts`.
 */

export const BILL_COPY_MAX = 10

const COPY_EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** The copy list on the row, cleaned the way the client kernel cleans it (≤10, lowercase, unique, plausible). */
export function copyEmailsFromRow(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  const out: string[] = []
  for (const v of raw) {
    if (typeof v !== 'string') continue
    const e = v.trim().toLowerCase()
    if (e && COPY_EMAIL_RE.test(e) && !out.includes(e)) out.push(e)
  }
  return out.slice(0, BILL_COPY_MAX)
}

export type BillCopyPlan =
  /** Nobody is on the copy list. */
  | { kind: 'none' }
  /** One email per address on the copy list. */
  | { kind: 'live'; to: string[] }
  /** One email, to the sender; `heldBack` is the copy list, which nothing goes to. */
  | { kind: 'test'; to: string; heldBack: string[] }
  /** Nothing goes out; `heldBack` is the copy list. */
  | { kind: 'skip'; reason: 'test_without_sender'; heldBack: string[] }

export function planBillCopies(input: {
  /** The mode the send runs in (the row's, `effectiveRowStripeMode`). */
  stripeMode: 'test' | 'live'
  /** Stripe's own word on the invoice; `false` makes the bill a test whatever the row says. */
  invoiceLivemode?: boolean | null
  /** The cleaned copy list (`copyEmailsFromRow`). */
  copyEmails: readonly string[]
  /** The signed-in sender's address. */
  callerEmail: string | null | undefined
}): BillCopyPlan {
  if (input.copyEmails.length === 0) return { kind: 'none' }
  const isTest = input.stripeMode === 'test' || input.invoiceLivemode === false
  if (!isTest) return { kind: 'live', to: [...input.copyEmails] }
  const caller = (input.callerEmail ?? '').trim()
  // The sender's own address on the list is not held back: the test copy reaches it.
  const heldBack = input.copyEmails.filter((e) => e !== caller.toLowerCase())
  if (!caller) return { kind: 'skip', reason: 'test_without_sender', heldBack }
  return { kind: 'test', to: caller, heldBack }
}

export type BillCopiesSkipped = 'no_resend_key' | 'no_hosted_url' | 'test_without_sender'

/** What the copies did, as the function answers the client. */
export type BillCopiesOutcome = {
  /** The copy-list addresses a copy went to; empty on a test-mode bill. */
  copies_sent: string[]
  copies_failed: Array<{ email: string; error: string }>
  copies_skipped?: BillCopiesSkipped
  /** Test mode: the sender's address, which the one test copy went to. */
  copies_test_to?: string
  /** Test mode: the copy-list addresses, which nothing went to. */
  copies_held_back?: string[]
}
