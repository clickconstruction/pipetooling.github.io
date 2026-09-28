import { formatYmdShort } from './gcChecksApplied'

/**
 * Sending back a Stripe-hosted billed line when Stripe still shows it paid
 * (v2.4072).
 *
 * A bill marked paid by check through Mark Paid is closed in Stripe
 * "out of band": Stripe's status turns `paid`, `amount_paid` stays 0 and no
 * charge exists — Stripe holds no money, only ClickTooling's own mark. When
 * that check never clears, the mark is ours to reverse: a credit note in
 * Stripe (the same one Undo out-of-band payment issues), the billed line
 * removed, the job back to Ready to Bill so Bill Customer mints a fresh
 * invoice. Stripe never reopens a paid invoice, so the old pay link is dead
 * either way and a new bill is the only way to collect again.
 *
 * Real money in Stripe (a card or ACH charge: `amount_paid > 0`) is never
 * reversed from here — that is a refund in the Stripe Dashboard.
 */
export type StripeDetailForSendBack = {
  amount_paid: number
  paid_at: number | null
  oob_paid_on: string | null
}

export type StripeSendBackKind = 'void_open' | 'reverse_oob_mark'

/** Stripe shows the bill paid, but no money moved through Stripe: an out-of-band mark. */
export function stripeShowsOobMarkOnly(d: StripeDetailForSendBack | null | undefined): boolean {
  if (!d) return false
  if (d.amount_paid > 0) return false
  return d.paid_at != null || d.oob_paid_on != null
}

/**
 * Which send-back a Stripe-hosted billed line gets from View bill. null = no
 * send-back from here: the line is not billed, payments still sit on it, or
 * Stripe holds real money.
 */
export function stripeSendBackKind(args: {
  invoiceStatus: string | null | undefined
  applied: number
  detail: StripeDetailForSendBack | null | undefined
}): StripeSendBackKind | null {
  if (args.invoiceStatus !== 'billed') return null
  if (args.applied > 0) return null
  if (!args.detail) return null
  if (args.detail.amount_paid > 0) return null
  return stripeShowsOobMarkOnly(args.detail) ? 'reverse_oob_mark' : 'void_open'
}

/** "Sep 24" for the day the out-of-band mark says the check was paid; null when Stripe gave no day. */
export function oobMarkPaidOnWords(d: StripeDetailForSendBack | null | undefined): string | null {
  if (!d) return null
  if (d.oob_paid_on && /^\d{4}-\d{2}-\d{2}$/.test(d.oob_paid_on)) return formatYmdShort(d.oob_paid_on)
  if (d.paid_at != null && Number.isFinite(d.paid_at)) {
    return new Date(d.paid_at * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'America/Chicago' })
  }
  return null
}

export type StripeSendBackWords = {
  /** The footer button on View bill. */
  button: string
  /** The confirm's title. */
  title: string
  /** What will happen, in order. */
  bullets: string[]
  /** The amber line under the bullets. */
  note: string
  /** The checkbox. */
  confirm: string
  /** The confirm's action button. */
  action: string
}

function money(n: number): string {
  return `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export function stripeSendBackWords(kind: StripeSendBackKind, opts: { amount: number; paidOn: string | null }): StripeSendBackWords {
  if (kind === 'reverse_oob_mark') {
    const when = opts.paidOn ? ` on ${opts.paidOn}` : ''
    return {
      button: "Check didn't clear · send back…",
      title: "Check didn't clear?",
      bullets: [
        `Stripe shows this ${money(opts.amount)} bill paid by check${when}, but no money moved through Stripe. ClickTooling will issue a credit note in Stripe that reverses that mark; Stripe keeps the old invoice number as paid and reversed.`,
        'ClickTooling will remove this billed line.',
        'The job moves back to Ready to Bill. Press Bill Customer to send a fresh bill with a new pay link — the old link cannot be reused.',
      ],
      note: 'If the customer actually paid by card or bank transfer through Stripe, refund it in the Stripe Dashboard instead; this door only reverses a check or cash mark.',
      confirm: 'I understand the old pay link stays dead and I will bill this job again.',
      action: 'Send back',
    }
  }
  return {
    button: 'Void Stripe invoice…',
    title: 'Void Stripe invoice?',
    bullets: [
      'Stripe will delete a draft invoice or void an open unpaid invoice so this hosted link cannot be paid.',
      'ClickTooling will remove this billed line.',
      'If this is the last billed invoice on the job, the job moves back to Ready to Bill.',
    ],
    note: 'A bill paid by card or bank transfer in Stripe, or one with payments recorded here, cannot be voided this way; refund it in Stripe or unlink the payments first.',
    confirm: 'I understand this bill line will be removed and the job may return to Ready to Bill.',
    action: 'Void invoice',
  }
}

/**
 * The Edit Job payments row: a payment Stripe holds as a whole-bill
 * out-of-band mark (no credit note of its own) offers "Check didn't clear…"
 * while its bill is still Paid — the door is the Undo out-of-band payment
 * modal with the send-back on.
 */
export function paymentRowOffersCheckDidNotClear(args: {
  holdsReason: 'credit_note' | 'paid_in_stripe' | null
  invoiceStatus: string | null | undefined
}): boolean {
  return args.holdsReason === 'paid_in_stripe' && args.invoiceStatus === 'paid'
}

export const CHECK_DID_NOT_CLEAR_LABEL = "Check didn't clear…"
export const CHECK_DID_NOT_CLEAR_TITLE =
  'The check behind this payment did not clear. Reverses the paid mark in Stripe with a credit note, takes the payment off the job, and sends the bill back to Ready to Bill so you can bill again with a fresh pay link.'
export const CHECK_DID_NOT_CLEAR_REASON = 'Check did not clear'

/** The toast after Undo out-of-band payment, with or without the send-back. */
export function oobUnwindDoneWords(sentBack: boolean): string {
  return sentBack
    ? 'Payment undone and the bill sent back. Press Bill Customer to bill this job again with a fresh pay link.'
    : 'Out-of-band payment undone. Stripe keeps the old invoice as paid and reversed; send the bill back and bill again to collect.'
}
