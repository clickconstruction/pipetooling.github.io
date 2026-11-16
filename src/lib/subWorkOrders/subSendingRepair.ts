/**
 * A repair to money already recorded (punch list #347's residue), shown before anything is saved.
 *
 * `overToCreditPlan`: a sheet paid past its total becomes a credit. The payment that went over reads the part the
 * sheet needed, and the rest is kept as the sub's credit with that same payment, so what left the bank is the figure
 * it always was. (`convert_sub_overpayment_to_credit`, migration `…_sub_overpayment_to_credit.sql`.)
 *
 * It does not change what a sheet owes or what a sub was paid. Pure: no React, no Supabase.
 */
import { SUB_PAYMENT_TOLERANCE } from './subPaymentWindow'

const cents = (n: number): number => Math.round(n * 100) / 100
const usd = (n: number): string => `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

export type OverPayment = { id: string; amount: number; dayWords: string; fromCredit: boolean; carriesCredit: boolean; at: string }

export type OverToCreditPlan =
  | {
      ok: true
      over: number
      /** The payment that changes: what it reads on the sheet after, and the credit kept with it. */
      paymentId: string
      before: number
      after: number
      words: string[]
      confirmLabel: string
    }
  | { ok: false; reason: 'not_over' | 'no_person' | 'no_payment'; error: string }

/**
 * `sheet.over` is what was paid past the sheet's total. The newest payment that can carry it does: money that left
 * the bank (not a payment made from a credit), with no credit kept on it yet, and more on it than the overage, so
 * the row never drops to zero.
 */
export function overToCreditPlan(sheet: { label: string; total: number; paid: number; over: number }, payments: readonly OverPayment[], sub: { personId: string | null; name: string }): OverToCreditPlan {
  const over = cents(sheet.over)
  if (over <= SUB_PAYMENT_TOLERANCE) return { ok: false, reason: 'not_over', error: 'This sheet is not paid past its total.' }
  if (!sub.personId) return { ok: false, reason: 'no_person', error: 'A credit needs the sub on the roster as one person. Link the sheet to one sub first.' }
  const carrier = payments
    .filter((p) => p.amount > over + SUB_PAYMENT_TOLERANCE && !p.fromCredit && !p.carriesCredit)
    .slice()
    .sort((a, b) => (a.at < b.at ? 1 : -1))[0]
  if (!carrier) return { ok: false, reason: 'no_payment', error: `No single payment on this sheet is larger than the ${usd(over)} over. Edit the payments on the sheet instead.` }
  const after = cents(carrier.amount - over)
  const name = sub.name.trim() || 'the sub'
  return {
    ok: true,
    over,
    paymentId: carrier.id,
    before: carrier.amount,
    after,
    words: [
      `${sheet.label} comes to ${usd(sheet.total)} and ${usd(sheet.paid)} was paid on it: ${usd(over)} over.`,
      `The payment of ${carrier.dayWords} reads ${usd(after)} on this sheet and ${usd(over)} kept as ${name}'s credit.`,
      `${usd(carrier.amount)} left the bank, as before. The sheet reads paid in full, and the next payment to ${name} offers the credit first.`,
    ],
    confirmLabel: `Keep ${usd(over)} as their credit`,
  }
}
