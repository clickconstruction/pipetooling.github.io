/**
 * Part cash on a Stripe bill (v2.3695) — the words and the arithmetic behind
 * the Record a cash or check payment window when the bill is a Stripe bill.
 *
 * Stripe has no "part paid in cash" button. Under the open balance, the
 * record-stripe-invoice-out-of-band-payment function creates a credit note on
 * the open invoice for the cash amount (so the pay link asks for the rest) and
 * writes the ledger row itself; at the balance it marks the invoice paid
 * out-of-band as before. This kernel decides which of those the typed amount
 * means and what the window says about it. Pure.
 */

const CENT = 0.005

function money(n: number): string {
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export type StripePaymentPlan =
  | { kind: 'empty' }
  | { kind: 'over'; remaining: number }
  | { kind: 'full'; amount: number }
  | { kind: 'part'; amount: number; staysDue: number }

/** What the typed amount means against the bill's open balance (dollars). */
export function stripePaymentPlan(amountRaw: string | number, remaining: number): StripePaymentPlan {
  const amount = typeof amountRaw === 'number' ? amountRaw : Number(String(amountRaw).replace(/,/g, '').trim())
  if (!Number.isFinite(amount) || amount <= 0) return { kind: 'empty' }
  if (amount > remaining + CENT) return { kind: 'over', remaining }
  if (Math.abs(amount - remaining) < CENT) return { kind: 'full', amount: remaining }
  return { kind: 'part', amount, staysDue: Math.round((remaining - amount) * 100) / 100 }
}

/** The line the customer will read on the pay link and the invoice PDF. */
export function stripeCreditLineText(paymentType: string, paidOnYmd: string, amount: number, reference?: string | null): string {
  const type = paymentType.trim() || 'Payment'
  const ref = (reference ?? '').trim()
  const who = type === 'Check' && ref ? `Check #${ref}` : type
  return `${who} received ${shortDate(paidOnYmd)} · $${money(amount)}`
}

function shortDate(ymd: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd.trim())
  if (!m) return ymd
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

/** The explanation under the amount for a part payment. */
export function stripePartPaymentNote(plan: Extract<StripePaymentPlan, { kind: 'part' }>, creditLine: string): string {
  return `Part payment. Stripe lowers the bill to $${money(plan.staysDue)} due. The pay link shows the new balance with a line that reads “${creditLine}”. The rest can be paid online, or recorded here later.`
}

/** The confirm button's label — both numbers, so nobody confirms blind. */
export function stripePaymentButtonLabel(plan: StripePaymentPlan): string {
  switch (plan.kind) {
    case 'part':
      return `Record $${money(plan.amount)} · $${money(plan.staysDue)} stays due`
    case 'full':
      return `Record $${money(plan.amount)}`
    default:
      return 'Confirm'
  }
}

/** The validation message, or null when the amount can be recorded. */
export function stripePaymentBlocker(plan: StripePaymentPlan): string | null {
  if (plan.kind === 'empty') return 'Enter a valid amount greater than 0'
  if (plan.kind === 'over') return `That is more than the $${money(plan.remaining)} open on this bill. Record up to the open balance; anything over is a tip or a separate job payment.`
  return null
}
