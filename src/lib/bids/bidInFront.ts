/**
 * The bid in front (punch list #445, the bids of the day). The Bids page keeps the open bid in the address
 * (`/bids?tab=pricing&bidId=…`), so the beat that says "this person was at work on this bid" reads it from there and
 * asks no screen to report anything. Pure.
 */

/** The bid a page has in front, and the Bids tab it is open on ('' when the address names none). */
export type BidInFront = { bidId: string; tab: string }

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const TAB_RE = /[^a-z0-9_-]/g

/** The bid the address has in front, or null: only the Bids page counts, and only a whole bid id. */
export function bidInFrontFromLocation(pathname: string, search: string): BidInFront | null {
  const first = (pathname ?? '').split('/').filter(Boolean)[0] ?? ''
  if (first.toLowerCase() !== 'bids') return null
  let bidId = ''
  let tab = ''
  try {
    const params = new URLSearchParams(search ?? '')
    bidId = (params.get('bidId') ?? '').trim()
    tab = (params.get('tab') ?? '').trim().toLowerCase().replace(TAB_RE, '').slice(0, 40)
  } catch {
    return null
  }
  if (!UUID_RE.test(bidId)) return null
  return { bidId: bidId.toLowerCase(), tab }
}

/** One string for a bid in front, so an effect can key on it: '' for none. */
export function bidInFrontKey(front: BidInFront | null): string {
  return front ? `${front.bidId}:${front.tab}` : ''
}

/** A person counts as at work on the bid for this long after their last press, key or scroll. */
export const BID_BEAT_IDLE_MS = 5 * 60_000

/** True while the last sign of the person is fresh enough for a beat to count. */
export function isAtWork(lastInputAt: number, now: number): boolean {
  return now - lastInputAt <= BID_BEAT_IDLE_MS
}

/**
 * The seconds one stretch adds, or 0 for none. A stretch runs from `startedAt` to `now` on one bid. It counts only
 * up to the idle limit past the last sign of the person, never more than a minute, and nothing under five seconds:
 * a glance at a bid on the way to another is not work on it.
 */
export function beatSeconds(startedAt: number, lastInputAt: number, now: number): number {
  const end = Math.min(now, lastInputAt + BID_BEAT_IDLE_MS)
  const ms = end - startedAt
  if (ms < 5_000) return 0
  return Math.min(60, Math.round(ms / 1000))
}
