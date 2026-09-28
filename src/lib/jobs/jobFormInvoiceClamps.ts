/**
 * The job form's invoice clamps — the money rules its invoice doors check before anything is
 * written. Every comparison is in whole cents, so a typed 100.10 and a computed 100.1 agree.
 */

const cents = (dollars: number): number => Math.round(dollars * 100)

export type TypedInvoicePlan =
  /** The typed amount is not a number above zero. */
  | { kind: 'invalid' }
  /** Nothing is left unallocated on the job. */
  | { kind: 'nothing-left' }
  /** The whole remainder of a Ready to Bill job: that is Bill Customer, not a draft. */
  | { kind: 'bill-customer'; amount: number; amountCents: number; adjusted: boolean }
  /** A draft for this amount. */
  | { kind: 'draft'; amount: number; amountCents: number; adjusted: boolean }

/**
 * A typed invoice amount against what is left to bill: never more than the remainder
 * (`adjusted` when the amount was cut back to it), and on a Ready to Bill job the whole
 * remainder goes to Bill Customer instead of a draft.
 */
export function planTypedInvoice(args: { typedAmount: number; remainingDollars: number; jobStatus: string | null | undefined }): TypedInvoicePlan {
  const { typedAmount: amount, remainingDollars: remaining, jobStatus } = args
  if (!(amount > 0)) return { kind: 'invalid' }
  const amountCents = Math.min(cents(amount), cents(remaining))
  const amountToUse = amountCents / 100
  if (!(amountToUse > 0)) return { kind: 'nothing-left' }
  const adjusted = amountCents < cents(amount)
  if (jobStatus === 'ready_to_bill' && cents(amountToUse) === cents(remaining)) {
    return { kind: 'bill-customer', amount: amountToUse, amountCents, adjusted }
  }
  return { kind: 'draft', amount: amountToUse, amountCents, adjusted }
}

/**
 * A segment selection against what is left: `empty` when nothing billable is picked, `over`
 * when its net would bill past the remainder (the cents-exact backstop for the screen's clamp,
 * v2.1132), else `ok`.
 */
export function segmentSelectionBillCheck(args: { netDollars: number; count: number; remainingDollars: number }): 'empty' | 'over' | 'ok' {
  if (args.count === 0 || !(args.netDollars > 0)) return 'empty'
  if (cents(args.netDollars) > cents(args.remainingDollars)) return 'over'
  return 'ok'
}

/** Moving a Working job to Ready to Bill takes the full unallocated amount, to the cent, and something must be left. */
export function isFullRemainingAmount(amount: number, remainingDollars: number): boolean {
  return remainingDollars > 0 && cents(amount) === cents(remainingDollars)
}
