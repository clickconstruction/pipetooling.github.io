/** Shared shape for Bid Board row ordering (due date ascending, unmarked last). */
export type BidBoardDueDateSortBid = {
  id: string
  bid_due_date: string | null
  /** Optional 'HH:MM'/'HH:MM:SS' time-of-day the bid is due. */
  bid_due_time?: string | null
}

function normalizedDueYmd(d: string | null | undefined): string | null {
  const t = (d ?? '').trim()
  return t === '' ? null : t
}

/**
 * Sort key for Bid Board: oldest → newest by `bid_due_date`, then rows with no due date
 * ("unmarked") last; same-day bids with a due time sort earliest-first ahead of those
 * without one; stable `id` when tied (including among unmarked).
 */
/** Shape for the pending section's recency ordering (v2.1760). */
export type BidBoardPendingRecencySortBid = {
  id: string
  bid_date_sent: string | null
  bid_due_date: string | null
}

/**
 * "Not yet won or lost" ordering (v2.1760): most recently SENT first, using
 * `bid_due_date` for any row without a sent date (pending bids always have one
 * today — the fallback keeps the order sane if that ever loosens). Rows with
 * neither date sort last; stable `id` when tied.
 */
export function compareBidsForBidBoardPendingRecency(
  a: BidBoardPendingRecencySortBid,
  b: BidBoardPendingRecencySortBid,
): number {
  const ad = normalizedDueYmd(a.bid_date_sent) ?? normalizedDueYmd(a.bid_due_date)
  const bd = normalizedDueYmd(b.bid_date_sent) ?? normalizedDueYmd(b.bid_due_date)
  if (ad == null && bd == null) return a.id.localeCompare(b.id)
  if (ad == null) return 1
  if (bd == null) return -1
  const byDate = bd.localeCompare(ad)
  if (byDate !== 0) return byDate
  return a.id.localeCompare(b.id)
}

export function compareBidsForBidBoardDueDate(a: BidBoardDueDateSortBid, b: BidBoardDueDateSortBid): number {
  const ad = normalizedDueYmd(a.bid_due_date)
  const bd = normalizedDueYmd(b.bid_due_date)
  if (ad == null && bd == null) return a.id.localeCompare(b.id)
  if (ad == null) return 1
  if (bd == null) return -1
  const byDate = ad.localeCompare(bd)
  if (byDate !== 0) return byDate
  const at = normalizedDueYmd(a.bid_due_time)
  const bt = normalizedDueYmd(b.bid_due_time)
  if (at != null || bt != null) {
    if (at == null) return 1
    if (bt == null) return -1
    const byTime = at.localeCompare(bt)
    if (byTime !== 0) return byTime
  }
  return a.id.localeCompare(b.id)
}
