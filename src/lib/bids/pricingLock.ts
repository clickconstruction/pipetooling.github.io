/**
 * Lock pricing after send (frozen bid prices, PR 3 — v2.3591).
 *
 * A bid that has been marked sent carries `bid_date_sent`, and from then on the
 * grid is a recomputation of a quote the customer already holds (`sentVsToday.ts`
 * says both numbers). Every write keyed to the bid's pricing — assign or remove
 * an entry, a typed price, the brush, the solver's Apply, fill from book, copy
 * from a scenario, the v2.2444 "Use $X on this bid" offer — now refuses while
 * the bid is locked, with the sent date in the toast. **Revise** on the Pricing
 * header unlocks the bid for this browser session (sessionStorage; a reload
 * keeps it, a new tab does not), so a post-send change is on purpose and the
 * sent-vs-today line explains itself. Nothing is stored on the bid.
 */

export type PricingLockState = 'open' | 'locked' | 'revising'

export const PRICING_REVISE_STORAGE_KEY = 'bids_pricing_revise_v1'

export function pricingLockState(input: { bidDateSent: string | null | undefined; bidId: string | null | undefined; revised: ReadonlySet<string> }): PricingLockState {
  const { bidDateSent, bidId, revised } = input
  if (!bidDateSent || !bidId) return 'open'
  return revised.has(bidId) ? 'revising' : 'locked'
}

/** The toast when a locked bid refuses a write. */
export function pricingLockedMessage(bidDateSent: string, currentYear: number): string {
  return `This bid was sent ${formatSentDay(bidDateSent, currentYear)} — press Revise on the Pricing header to change its prices.`
}

/** The chip beside the sent-vs-today line. */
export function pricingLockChipText(state: PricingLockState, bidDateSent: string | null | undefined, currentYear: number): string | null {
  if (state === 'open' || !bidDateSent) return null
  const day = formatSentDay(bidDateSent, currentYear)
  return state === 'locked' ? `Sent ${day} · pricing locked` : `Revising a bid sent ${day}`
}

export function formatSentDay(ymd: string, currentYear: number): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(ymd)
  if (!m) return ymd
  const year = Number(m[1])
  const d = new Date(Date.UTC(year, Number(m[2]) - 1, Number(m[3])))
  const monthDay = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
  return year === currentYear ? monthDay : `${monthDay}, ${year}`
}

/** The bids this session has chosen to revise; anything unreadable is an empty set. */
export function readRevisedBids(storage: Pick<Storage, 'getItem'> | null | undefined): Set<string> {
  try {
    const raw = storage?.getItem(PRICING_REVISE_STORAGE_KEY)
    if (!raw) return new Set()
    const parsed: unknown = JSON.parse(raw)
    return new Set(Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string' && x.trim() !== '') : [])
  } catch {
    return new Set()
  }
}

export function writeRevisedBid(storage: Pick<Storage, 'getItem' | 'setItem'> | null | undefined, bidId: string, revising: boolean): Set<string> {
  const next = readRevisedBids(storage)
  if (revising) next.add(bidId)
  else next.delete(bidId)
  try {
    storage?.setItem(PRICING_REVISE_STORAGE_KEY, JSON.stringify([...next]))
  } catch {
    /* the session just won't remember */
  }
  return next
}
