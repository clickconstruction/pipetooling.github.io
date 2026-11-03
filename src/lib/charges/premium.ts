/**
 * Premium and shortfall (punch list #254, PR 3): the stand of a job's price against its charges. The price is the
 * job's revenue; the charges are its labor at the crew rates and its materials at the markup. Price above charges is
 * a premium, below a shortfall, the same a wash. Office words only: the customer copy never prints them (the owner,
 * 2026-11-03, who considered warranty and discount and dropped both because each means something else in the app).
 */
import { moneyWords } from './moneyParts'

export type PremiumKind = 'premium' | 'shortfall' | 'even'

export type Premium = {
  kind: PremiumKind
  /** Always ≥ 0: the size of the gap. */
  amount: number
  /** Signed: price − charges. */
  signed: number
  price: number
  charges: number
  /** `a $406.27 premium`, `a $537.73 shortfall`, `even`. */
  words: string
  /** `The price stands $406.27 above the charges.` */
  sentence: string
}

const cents = (n: number): number => Math.round(Math.round(n * 1000) / 10) / 100

export function premiumOf(price: number, charges: number): Premium {
  const p = cents(Number.isFinite(price) ? price : 0)
  const c = cents(Number.isFinite(charges) ? charges : 0)
  const signed = cents(p - c)
  const amount = Math.abs(signed)
  const kind: PremiumKind = signed > 0 ? 'premium' : signed < 0 ? 'shortfall' : 'even'
  const words = kind === 'even' ? 'even' : `a ${moneyWords(amount)} ${kind}`
  const sentence =
    kind === 'even'
      ? 'The price and the charges are even.'
      : `The price stands ${moneyWords(amount)} ${kind === 'premium' ? 'above' : 'below'} the charges.`
  return { kind, amount, signed, price: p, charges: c, words, sentence }
}

/**
 * The premium waits while any day prices at nothing (punch list #254, the live pass): the charges are short by those
 * days, so a premium read against them would be wrong, not rough. Office words, like the premium itself.
 */
export function premiumWaitsWords(unpricedDays: number): string {
  return `The premium waits until every day prices: ${unpricedDays} ${unpricedDays === 1 ? 'day prices' : 'days price'} at nothing.`
}

/** What the gap carries, for the office copy's one sentence under it. */
export const PREMIUM_CARRIES = 'A fixed price carries the risk of the work running long, the supervision, the equipment and the warranty.'
