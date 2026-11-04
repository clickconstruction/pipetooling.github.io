/**
 * A locked bid says what went out (v2.6510).
 *
 * Pricing locks after send (`pricingLock.ts`, v2.3591): every write to the bid's prices refuses
 * until **Revise…**. But the number itself was never held — the grid and the letter recompute from
 * the bid's price copy, and `sentVsToday.ts` only says both figures. A bid that went out at one
 * figure read eleven thousand dollars lower the week after, and the estimator chased the sent
 * figure by hand through Revise. The customer-facing amount — the ★ card on the Pricing tab and
 * the letter's headline — now reads `bids.bid_value`, the figure stamped at send, while the lock
 * holds. Revise… puts the live number back (the sent-vs-today line still says both), as does a
 * custom amount on the letter and an options letter, where `bid_value` is the lead option's ★ and
 * never the letter's sum.
 */
import type { PricingLockState } from './pricingLock'

export type QuoteToShow = { amount: number; source: 'sent' | 'live' }

/** The sent figure while the lock holds and one was stamped; else the live one, null while it loads. */
export function quoteToShow(input: { lockState: PricingLockState; bidValue: number | string | null | undefined; live: number | null | undefined }): QuoteToShow | null {
  const sent = sentValueOf(input.bidValue)
  if (input.lockState === 'locked' && sent != null) return { amount: sent, source: 'sent' }
  if (input.live == null || !Number.isFinite(input.live)) return null
  return { amount: input.live, source: 'live' }
}

/** `bids.bid_value` as a positive number, or null — never stamped, zero, or unreadable. */
export function sentValueOf(bidValue: number | string | null | undefined): number | null {
  if (bidValue == null) return null
  const n = typeof bidValue === 'number' ? bidValue : Number(bidValue)
  return Number.isFinite(n) && n > 0 ? n : null
}

/** The words that ride the ★ card while it shows the sent figure. */
export function sentTagWords(q: QuoteToShow | null): string | null {
  return q?.source === 'sent' ? 'as sent' : null
}
