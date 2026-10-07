/**
 * Move a check Stripe already holds (v2.4803, PR 2 of punch list #98). A bill marked paid in
 * Stripe by our own out-of-band mark cannot reopen — Stripe keeps a paid invoice paid — so a
 * check that landed on the wrong job still needs the credit note and a fresh bill (v2.4082).
 * Here that is one press of Move to job…: the pick, the words for what will happen in order,
 * where the money lands on the other job, and the words when a step after the credit note
 * fails. The window runs the steps; this file decides them. Pure.
 */
import type { JobWithDetails } from '../../types/jobWithDetails'
import type { JobsLedgerInvoiceRow, PaymentRow } from './jobFormTypes'
import { stripeHoldsPaymentReason } from './jobFormPaymentPredicates'

/** The row's bill is marked paid in Stripe by our mark (not a credit-note part payment) and still Paid here. */
export function stripeHeldMoveOffered(row: PaymentRow, job: JobWithDetails | null): boolean {
  if (stripeHoldsPaymentReason(row, job) !== 'paid_in_stripe') return false
  const inv = (job?.invoices ?? []).find((i) => i.id === row.invoice_id)
  return inv?.status === 'paid'
}

/** The reason the credit note, the trail and the moved event carry: "Moved to J922 · wrong job". */
export function stripeHeldMoveReason(toLabel: string, reason: string): string {
  const why = reason.trim()
  return why ? `Moved to ${toLabel} · ${why}` : `Moved to ${toLabel}`
}

export type HeldLanding = { kind: 'bill'; invoiceId: string; billAmount: number } | { kind: 'job' }

/**
 * Where the check lands on the other job: on its one open bill with room for the amount
 * (recorded there the way Mark Paid · Check records — held, Stripe or not), else on the job
 * under Other money. Two open bills, or none that fits, land on the job: a person picks.
 */
export function planHeldLanding(
  bills: ReadonlyArray<{ id: string; status: string | null; amount: number | null; applied: number }>,
  amount: number,
): HeldLanding {
  const open = bills.filter((b) => b.status === 'billed' && Number(b.amount ?? 0) - b.applied + 0.005 >= amount)
  if (open.length === 1) return { kind: 'bill', invoiceId: open[0]!.id, billAmount: Number(open[0]!.amount ?? 0) }
  return { kind: 'job' }
}

function money(n: number): string {
  return `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

/** The ordered list the window shows before Move. */
export function stripeHeldMoveSteps(args: { fromLabel: string; toLabel: string; amount: number; billAmount: number; landing: HeldLanding | null }): string[] {
  const out = [
    `A credit note in Stripe reverses the paid mark on ${args.fromLabel}'s ${money(args.billAmount)} bill`,
    `That bill is sent back and ${args.fromLabel} is Ready to Bill, so a fresh bill with a new number goes out`,
  ]
  if (!args.landing) out.push(`The ${money(args.amount)} check lands on ${args.toLabel}`)
  else if (args.landing.kind === 'bill') out.push(`The ${money(args.amount)} check pays ${args.toLabel}'s ${money(args.landing.billAmount)} bill, held for seven days like any check`)
  else out.push(`The ${money(args.amount)} check lands on ${args.toLabel} under Other money, with no bill picked`)
  out.push(`Both jobs get the grey line: moved → ${args.toLabel}`)
  return out
}

export type HeldMoveStep = 'reverse' | 'send_back' | 'land' | 'trace'

/**
 * What the office does by hand when a step failed after the one before it wrote. The reverse
 * step writes nothing on failure, so it has no words here.
 */
export function stripeHeldMoveStoppedWords(step: Exclude<HeldMoveStep, 'reverse'>, args: { fromLabel: string; toLabel: string; amount: number; paidOn: string | null; reference: string | null; message: string }): string {
  const check = `${money(args.amount)} check${args.reference ? ` ${args.reference}` : ''}${args.paidOn ? ` dated ${args.paidOn}` : ''}`
  if (step === 'send_back') {
    return `The paid mark is reversed and the payment is off ${args.fromLabel}, but its bill did not go back: ${args.message}. Open View bill on ${args.fromLabel}'s Billed row and press Check didn't clear · send back…, then record the ${check} on ${args.toLabel} by hand.`
  }
  if (step === 'land') {
    return `${args.fromLabel} is sent back, but the check did not land: ${args.message}. Record the ${check} on ${args.toLabel} by hand.`
  }
  return `The check is on ${args.toLabel}, but the grey line could not be written: ${args.message}.`
}

export type HeldMoveSnapshot = Pick<PaymentRow, 'amount' | 'paid_on' | 'sent_on' | 'note' | 'payment_type' | 'reference_number' | 'invoice_id'>

/** The event row both jobs' trace lines read; `payment_id` is the row the check landed as, or null. */
export function heldMoveEventRow(args: {
  snapshot: HeldMoveSnapshot
  fromJobId: string
  toJobId: string
  landedPaymentId: string | null
  reason: string
  actorUserId: string | null
  actorName: string | null
}): Record<string, unknown> {
  const s = args.snapshot
  return {
    kind: 'moved',
    payment_id: args.landedPaymentId,
    from_job_id: args.fromJobId,
    to_job_id: args.toJobId,
    amount: Number(s.amount ?? 0),
    paid_on: s.paid_on ?? null,
    sent_on: s.sent_on ?? null,
    note: s.note ?? null,
    payment_type: s.payment_type ?? null,
    reference_number: s.reference_number ?? null,
    invoice_id: s.invoice_id ?? null,
    mercury_transaction_id: null,
    sequence_order: null,
    reason: args.reason,
    actor_user_id: args.actorUserId,
    actor_name: args.actorName,
  }
}

/** The bill the row sits on, for the window's words. */
export function heldMoveBill(row: PaymentRow, job: JobWithDetails | null): JobsLedgerInvoiceRow | null {
  return (job?.invoices ?? []).find((i) => i.id === row.invoice_id) ?? null
}
