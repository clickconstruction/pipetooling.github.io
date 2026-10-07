/**
 * Move a payment Stripe already holds (v2.4803, PR 2 of punch list #98). A bill marked paid in
 * Stripe by our own out-of-band mark cannot reopen — Stripe keeps a paid invoice paid — so a
 * payment that landed on the wrong job still needs the credit note and a fresh bill (v2.4082).
 * Here that is one press of Move to job…: the pick, the words for what will happen in order,
 * where the money lands on the other job and how it is written there, and the words when a
 * step after the credit note fails. The window runs the steps; this file decides them. Pure.
 *
 * v2.4822 (the live test): the words name a check only when it is one; the landing on another
 * job's Stripe bill follows Mark Paid's own rules (`heldLandingWrite`) — a whole-balance check
 * is held for the sweep, any other whole payment is recorded and closed in Stripe at once, a
 * part payment takes the credit-note path — so no Stripe invoice is left open behind a bill the
 * app reads Paid; and the moved event carries the office's reason alone, since its trace line
 * already names the job.
 */
import type { JobWithDetails } from '../../types/jobWithDetails'
import type { JobsLedgerInvoiceRow, PaymentRow } from './jobFormTypes'
import { stripeHoldsPaymentReason } from './jobFormPaymentPredicates'
import { isCheckPayment } from './checkClearing'
import { formatYmdMonthDay } from './billedExpectedPay'
import { heldStripeCloseYmd, markPaidHoldsStripeClose } from './heldStripeMark'
import { stripePaymentPlan } from './stripePartPayment'

/** The row's bill is marked paid in Stripe by our mark (not a credit-note part payment) and still Paid here. */
export function stripeHeldMoveOffered(row: PaymentRow, job: JobWithDetails | null): boolean {
  if (stripeHoldsPaymentReason(row, job) !== 'paid_in_stripe') return false
  const inv = (job?.invoices ?? []).find((i) => i.id === row.invoice_id)
  return inv?.status === 'paid'
}

export type HeldMoveNoun = 'check' | 'payment'

/** What the window calls the money: a check when it is one, else a payment (v2.4822). */
export function heldMoveNoun(row: Pick<PaymentRow, 'payment_type'>): HeldMoveNoun {
  return isCheckPayment({ payment_type: row.payment_type ?? null }) ? 'check' : 'payment'
}

export function stripeHeldMoveTitle(noun: HeldMoveNoun): string {
  return `Move this ${noun}`
}

export function stripeHeldMoveIntro(noun: HeldMoveNoun, fromLabel: string): string {
  return `Stripe holds this ${noun} as paid, and Stripe never reopens a paid invoice. Moving it reverses that mark with a credit note, sends ${fromLabel}'s bill back for a fresh one, and lands the ${noun} on the job you pick.`
}

/** The toast when every step went through. */
export function stripeHeldMoveDoneWords(noun: HeldMoveNoun, fromLabel: string, toLabel: string): string {
  const what = noun === 'check' ? 'Check' : 'Payment'
  return `${what} moved to ${toLabel}. ${fromLabel} is Ready to Bill. Press Bill Customer there for a fresh bill.`
}

/**
 * The reason the credit note's memo and the `removed` event carry: "Moved to J922 · wrong job".
 * The moved event carries the office's reason alone — its trace line already says where.
 */
export function stripeHeldMoveReason(toLabel: string, reason: string): string {
  const why = reason.trim()
  return why ? `Moved to ${toLabel} · ${why}` : `Moved to ${toLabel}`
}

export type HeldLanding =
  | { kind: 'bill'; invoiceId: string; billAmount: number; remaining: number; stripeHosted: boolean }
  | { kind: 'job' }

/**
 * Where the payment lands on the other job: on its one open bill with room for the amount, else
 * on the job under Other money. Two open bills, or none that fits, land on the job: a person picks.
 */
export function planHeldLanding(
  bills: ReadonlyArray<{ id: string; status: string | null; amount: number | null; applied: number; stripeHosted?: boolean }>,
  amount: number,
): HeldLanding {
  const open = bills.filter((b) => b.status === 'billed' && Number(b.amount ?? 0) - b.applied + 0.005 >= amount)
  if (open.length !== 1) return { kind: 'job' }
  const b = open[0]!
  const billAmount = Number(b.amount ?? 0)
  return { kind: 'bill', invoiceId: b.id, billAmount, remaining: Math.round((billAmount - b.applied) * 100) / 100, stripeHosted: Boolean(b.stripeHosted) }
}

/**
 * How the payment is written on the bill it lands on — Mark Paid's own rules (v2.4822):
 * - a bill that is not a Stripe bill, or a whole-balance check on one (held for the sweep): `mark_invoice_paid`;
 * - any other whole payment on a Stripe bill: `mark_invoice_paid`, then the Stripe invoice closed
 *   out of band at once (`allow_app_paid`, the Accounts Receivable pattern);
 * - a part payment on a Stripe bill: the credit-note path, which writes the row itself.
 */
export type HeldLandingWrite = 'mark_paid' | 'mark_paid_then_close' | 'stripe_part'

export function heldLandingWrite(landing: Extract<HeldLanding, { kind: 'bill' }>, paymentType: string | null | undefined, amount: number): HeldLandingWrite {
  if (!landing.stripeHosted) return 'mark_paid'
  const plan = stripePaymentPlan(amount, landing.remaining)
  if (plan.kind === 'part') return 'stripe_part'
  if (plan.kind !== 'full') return 'mark_paid'
  return markPaidHoldsStripeClose({ stripeHosted: true, paymentType, planKind: 'full' }) ? 'mark_paid' : 'mark_paid_then_close'
}

function money(n: number): string {
  return `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

/** When the sweep closes a held check's new bill: on its day, or the next morning once it is a week old. */
function heldCloseWhen(paidOnYmd: string | null, todayYmd: string): string {
  if (!paidOnYmd || !/^\d{4}-\d{2}-\d{2}$/.test(paidOnYmd)) return 'Stripe closes that bill once the check has cleared'
  const closeYmd = heldStripeCloseYmd(paidOnYmd)
  if (closeYmd <= todayYmd) return 'Stripe closes that bill the next morning, since the check is over seven days old'
  return `Stripe closes that bill ${formatYmdMonthDay(closeYmd)}, once the check has cleared`
}

/** The ordered list the window shows before Move. */
export function stripeHeldMoveSteps(args: {
  fromLabel: string
  toLabel: string
  amount: number
  billAmount: number
  landing: HeldLanding | null
  noun: HeldMoveNoun
  paymentType: string | null | undefined
  paidOnYmd: string | null
  todayYmd: string
}): string[] {
  const out = [
    `A credit note in Stripe reverses the paid mark on ${args.fromLabel}'s ${money(args.billAmount)} bill`,
    `That bill is sent back and ${args.fromLabel} is Ready to Bill, so a fresh bill with a new number goes out`,
  ]
  const what = `The ${money(args.amount)} ${args.noun}`
  const landing = args.landing
  if (!landing) out.push(`${what} lands on ${args.toLabel}`)
  else if (landing.kind === 'job') out.push(`${what} lands on ${args.toLabel} under Other money, with no bill picked`)
  else {
    const bill = `${args.toLabel}'s ${money(landing.billAmount)} bill`
    const write = heldLandingWrite(landing, args.paymentType, args.amount)
    const part = landing.remaining - args.amount > 0.005
    if (write === 'stripe_part') out.push(`${what} pays part of ${bill}, and its pay link asks for the rest`)
    else if (write === 'mark_paid_then_close') out.push(`${what} pays ${bill}, and Stripe closes that bill at once`)
    else if (landing.stripeHosted) out.push(`${what} pays ${bill}. ${heldCloseWhen(args.paidOnYmd, args.todayYmd)}`)
    else out.push(`${what} pays ${part ? 'part of ' : ''}${bill}`)
  }
  out.push(`Both jobs get the grey line: moved → ${args.toLabel}`)
  return out
}

export type HeldMoveStep = 'reverse' | 'send_back' | 'land' | 'close' | 'trace'

/**
 * What the office does by hand when a step failed after the one before it wrote. The reverse
 * step writes nothing on failure, so it has no words here.
 */
export function stripeHeldMoveStoppedWords(
  step: Exclude<HeldMoveStep, 'reverse'>,
  args: { fromLabel: string; toLabel: string; amount: number; paidOn: string | null; reference: string | null; message: string; noun: HeldMoveNoun },
): string {
  const what = `${money(args.amount)} ${args.noun}${args.reference ? ` ${args.reference}` : ''}${args.paidOn ? ` dated ${args.paidOn}` : ''}`
  if (step === 'send_back') {
    return `The paid mark is reversed and the payment is off ${args.fromLabel}, but its bill did not go back: ${args.message}. Open View bill on ${args.fromLabel}'s Billed row and press Check didn't clear · send back…, then record the ${what} on ${args.toLabel} by hand.`
  }
  if (step === 'land') {
    return `${args.fromLabel} is sent back, but the ${args.noun} did not land: ${args.message}. Record the ${what} on ${args.toLabel} by hand.`
  }
  if (step === 'close') {
    return `The ${args.noun} is on ${args.toLabel}'s bill, but Stripe did not close that bill: ${args.message}. Mark it paid out of band in the Stripe Dashboard so its pay link cannot be paid again.`
  }
  return `The ${args.noun} is on ${args.toLabel}, but the grey line could not be written: ${args.message}.`
}

export type HeldMoveSnapshot = Pick<PaymentRow, 'amount' | 'paid_on' | 'sent_on' | 'note' | 'payment_type' | 'reference_number' | 'invoice_id'>

/** The event row both jobs' trace lines read; `payment_id` is the row the payment landed as, or null. */
export function heldMoveEventRow(args: {
  snapshot: HeldMoveSnapshot
  fromJobId: string
  toJobId: string
  landedPaymentId: string | null
  /** The office's reason alone ("wrong job"); the trace line names the job itself. */
  reason: string | null
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
    reason: (args.reason ?? '').trim() || null,
    actor_user_id: args.actorUserId,
    actor_name: args.actorName,
  }
}

/** The bill the row sits on, for the window's words. */
export function heldMoveBill(row: PaymentRow, job: JobWithDetails | null): JobsLedgerInvoiceRow | null {
  return (job?.invoices ?? []).find((i) => i.id === row.invoice_id) ?? null
}
