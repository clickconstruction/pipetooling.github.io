/**
 * Bid Board → Bid Value column: red-dollar alert predicate.
 *
 * Returns true when a bid is in the "Not yet won or lost" group (already sent,
 * no terminal outcome) **and** still has an empty `bid_value`. Mirrors the
 * existing `submissionPending` / `bidCostsPending` filter in `src/pages/Bids.tsx`
 * (sent + outcome not won/lost/started_or_complete) so the icon is gated on the
 * same slice of bids that appear in the "Not yet won or lost" sections.
 *
 * Empty bid_value = `null`, `undefined`, or numerically zero. Negative or
 * non-finite numbers are also treated as empty (defensive — should never happen
 * for a saved bid_value but the icon should still nudge a fix).
 */

export type BidBoardEmptyBidValueAlertInput = {
  bid_date_sent: string | null | undefined
  outcome: string | null | undefined
  bid_value: number | string | null | undefined
}

/** Outcomes that exclude a bid from the "Not yet won or lost" group. */
const TERMINAL_OUTCOMES: readonly string[] = ['won', 'lost', 'started_or_complete']

function hasSentDate(value: string | null | undefined): boolean {
  return typeof value === 'string' && value.trim() !== ''
}

function isTerminalOutcome(value: string | null | undefined): boolean {
  if (typeof value !== 'string') return false
  return TERMINAL_OUTCOMES.includes(value)
}

function isEmptyBidValue(value: number | string | null | undefined): boolean {
  if (value == null) return true
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (trimmed === '') return true
    const n = Number(trimmed)
    return !Number.isFinite(n) || n <= 0
  }
  return !Number.isFinite(value) || value <= 0
}

export function shouldShowEmptyBidValueAlert(bid: BidBoardEmptyBidValueAlertInput): boolean {
  if (!hasSentDate(bid.bid_date_sent)) return false
  if (isTerminalOutcome(bid.outcome)) return false
  return isEmptyBidValue(bid.bid_value)
}
