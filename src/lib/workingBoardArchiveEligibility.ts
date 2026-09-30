import type { BidWithBuilder } from '../types/bidWithBuilder'
import { formatWorkDateYmdFriendly } from '../utils/dateUtils'

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

const OUTCOME_WORDS: Record<string, string> = {
  won: 'Won',
  lost: 'Lost',
  started_or_complete: 'Started or complete',
}

/**
 * Why the Edit Bid footer's "Archive from board" button is greyed for this bid and this user —
 * null when the press may go ahead. One home for the words: the button's hover title and the
 * toast a greyed press raises both read it. Every reason ends with a door.
 */
export function archiveFromBoardBlockedReason(
  bid: BidWithBuilder | undefined,
  userId: string | undefined,
  myRole: string | null | undefined,
): string | null {
  if (!bid || !userId) return null
  if (bid.working_board_archived_at) return null
  if (bid.bid_date_sent) {
    return `Sent ${formatWorkDateYmdFriendly(bid.bid_date_sent.slice(0, 10))}. A sent bid is already off the working board. If it is dead, mark it Lost in Outcome.`
  }
  const outcomeWord = bid.outcome ? OUTCOME_WORDS[bid.outcome] : undefined
  if (outcomeWord) {
    return `This bid is ${outcomeWord}. It left the working board when its outcome was set.`
  }
  if (myRole === 'dev' || bid.estimator_id === userId || bid.account_manager_id === userId) return null
  return "Only this bid's estimator or account man can archive it. Ask them, or a dev."
}
