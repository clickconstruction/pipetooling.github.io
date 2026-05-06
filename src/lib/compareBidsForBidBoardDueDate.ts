/** Shared shape for Bid Board row ordering (due date ascending, unmarked last). */
export type BidBoardDueDateSortBid = {
  id: string
  bid_due_date: string | null
}

function normalizedDueYmd(d: string | null | undefined): string | null {
  const t = (d ?? '').trim()
  return t === '' ? null : t
}

/**
 * Sort key for Bid Board: oldest → newest by `bid_due_date`, then rows with no due date
 * ("unmarked") last; stable `id` when tied (including among unmarked).
 */
export function compareBidsForBidBoardDueDate(a: BidBoardDueDateSortBid, b: BidBoardDueDateSortBid): number {
  const ad = normalizedDueYmd(a.bid_due_date)
  const bd = normalizedDueYmd(b.bid_due_date)
  if (ad == null && bd == null) return a.id.localeCompare(b.id)
  if (ad == null) return 1
  if (bd == null) return -1
  const byDate = ad.localeCompare(bd)
  if (byDate !== 0) return byDate
  return a.id.localeCompare(b.id)
}
