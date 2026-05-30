/** Minimal bid shape needed to derive a human-readable status label. */
export type BidStatusLabelBid = {
  bid_date_sent: string | null
  outcome: string | null
}

/**
 * Human-readable status for a bid, matching the Bids page semantics:
 * unsent until a send date exists, then won/lost/started, else "not yet won or lost".
 */
export function getBidStatusLabel(bid: BidStatusLabelBid): string {
  if (!bid.bid_date_sent) return 'Unsent'
  if (bid.outcome === 'won') return 'Won'
  if (bid.outcome === 'lost') return 'Lost'
  if (bid.outcome === 'started_or_complete') return 'Started or Complete'
  return 'Not yet won or lost'
}
