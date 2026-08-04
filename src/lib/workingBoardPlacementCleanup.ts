import { bidEligibleForWorkingBoardArchive } from './workingBoardArchiveEligibility'

/**
 * Pure kernel deciding which Working-board placement rows may be hard-deleted
 * (v2.1383). A placement is deletable ONLY when its bid was re-fetched by id
 * (unfiltered) and positively confirmed off the user's board: sent, terminal
 * outcome, or reassigned away from the user.
 *
 * Bids ABSENT from the confirmation fetch are always KEPT. The pre-v2.1383
 * cleanup deleted any placement whose bid wasn't in the currently loaded list —
 * but that list is filtered by the selected trade, so switching Plumbing →
 * Electrical while on the Unsent/Working tab mass-deleted the user's plumbing
 * placements and dumped every bid back to Inbox (reported 2026-08-04).
 * Truly deleted bids need no client cleanup: the placement bid_id FK is
 * ON DELETE CASCADE.
 */

export type PlacementCleanupBid = {
  id: string
  bid_date_sent: string | null
  outcome: string | null
  estimator_id: string | null
  account_manager_id: string | null
}

export function placementBidIdsSafeToDelete(
  placementBidIds: string[],
  confirmedBids: PlacementCleanupBid[],
  userId: string,
): string[] {
  const byId = new Map(confirmedBids.map((b) => [b.id, b]))
  const out: string[] = []
  const seen = new Set<string>()
  for (const bidId of placementBidIds) {
    if (seen.has(bidId)) continue
    seen.add(bidId)
    const bid = byId.get(bidId)
    if (!bid) continue
    const assignedToUser = bid.estimator_id === userId || bid.account_manager_id === userId
    if (!assignedToUser || !bidEligibleForWorkingBoardArchive(bid)) out.push(bidId)
  }
  return out
}
