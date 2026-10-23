/**
 * The Customers list's quietest fact (v2.5767): how long a customer takes to pay after a bill, from the same
 * pay-speed read the Pipeline's expected-pay dates use (`get_billed_customer_pay_speeds` → `paySpeedSpread`).
 * Null with no history, so the row says nothing rather than a guess.
 */
import { formatPaysIn, type PaySpeedSpread } from '../jobs/paymentReliability'

/** *pays in ~30d* · *pays in 9–41d* · null with too little history. Lowercase: it sits in the row's muted line, not as a title. */
export function paysInWords(spread: PaySpeedSpread | null): string | null {
  const words = formatPaysIn(spread)
  return words ? words.charAt(0).toLowerCase() + words.slice(1) : null
}

/** The hover: where the number comes from. */
export function paysInTitle(spread: PaySpeedSpread | null): string | null {
  if (!spread) return null
  const n = spread.samples
  return `Typical days from a bill to its payment, from ${n} payment${n === 1 ? '' : 's'} in the last 12 months. The Pipeline's expected pay dates use the same figure.`
}
