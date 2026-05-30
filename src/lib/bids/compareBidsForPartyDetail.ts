/** Minimal bid shape needed to order bids in the party-detail "All bids" table. */
export type PartyDetailSortBid = {
  bid_date_sent: string | null
  outcome: string | null
  bid_due_date: string | null
}

/**
 * Ordering for the "All bids" table in the GC/Builder and customer detail modals:
 * unsent first, then won, started/complete, lost, then anything else; ties broken by
 * `bid_due_date` ascending (null treated as empty string).
 */
export function compareBidsForPartyDetail(a: PartyDetailSortBid, b: PartyDetailSortBid): number {
  const order = (bid: PartyDetailSortBid) =>
    !bid.bid_date_sent ? 0 : bid.outcome === 'won' ? 1 : bid.outcome === 'started_or_complete' ? 2 : bid.outcome === 'lost' ? 3 : 4
  const o = order(a) - order(b)
  if (o !== 0) return o
  return (a.bid_due_date ?? '').localeCompare(b.bid_due_date ?? '')
}
