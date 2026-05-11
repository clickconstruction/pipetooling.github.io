import type { BidWithBuilder } from '../types/bidWithBuilder'

/** Unsent and not in a terminal outcome — bids that can be soft-archived from the working board. */
export function bidEligibleForWorkingBoardArchive(bid: {
  bid_date_sent: string | null
  outcome: string | null
}): boolean {
  if (bid.bid_date_sent) return false
  const o = bid.outcome
  return o !== 'won' && o !== 'lost' && o !== 'started_or_complete'
}

/** User sees the bid on their personal Unsent/Working Kanban when not archived. */
export function isBidEligibleForWorkingBoard(bid: BidWithBuilder, userId: string | undefined): boolean {
  if (!userId) return false
  return (
    (bid.estimator_id === userId || bid.account_manager_id === userId) && bidEligibleForWorkingBoardArchive(bid)
  )
}

export function canUserArchiveBidOnWorkingBoard(
  bid: BidWithBuilder | undefined,
  userId: string | undefined,
  myRole: string | null | undefined,
): boolean {
  if (!bid || !userId) return false
  if (!bidEligibleForWorkingBoardArchive(bid)) return false
  if (myRole === 'dev') return true
  return bid.estimator_id === userId || bid.account_manager_id === userId
}
