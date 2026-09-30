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
  started_or_complete: 'Started / Complete',
}

/** Display names by user id (the Estimator / Account Man dropdowns' list), so a refusal can say who. */
export type ArchiveReasonNames = Record<string, string | undefined>

/**
 * Why the Edit Bid footer's "Archive from board" button is greyed for this bid and this user —
 * null when the press may go ahead. One home for the words: the button's hover title and the
 * toast a greyed press raises both read it. Every reason says what to change, in the form's own
 * field names, so the user can archive the bid themselves — or who to ask when they cannot.
 */
export function archiveFromBoardBlockedReason(
  bid: BidWithBuilder | undefined,
  userId: string | undefined,
  myRole: string | null | undefined,
  names: ArchiveReasonNames = {},
): string | null {
  if (!bid || !userId) return null
  if (bid.working_board_archived_at) return null
  if (bid.bid_date_sent) {
    return `Archive is for bids that have not been sent. This one was sent ${formatWorkDateYmdFriendly(bid.bid_date_sent.slice(0, 10))}. To archive it, clear its Bid Date Sent first. If the bid is dead, set Win / Loss to Lost instead.`
  }
  const outcomeWord = bid.outcome ? OUTCOME_WORDS[bid.outcome] : undefined
  if (outcomeWord) {
    return `Archive is for open bids. This one is ${outcomeWord}. To archive it, set Win / Loss back to Open first.`
  }
  if (myRole === 'dev' || bid.estimator_id === userId || bid.account_manager_id === userId) return null
  const estimator = bid.estimator_id ? names[bid.estimator_id] : undefined
  const accountMan = bid.account_manager_id ? names[bid.account_manager_id] : undefined
  const estimatorWords = estimator ? `estimator, ${estimator},` : 'estimator'
  const accountManWords = accountMan ? `account man, ${accountMan},` : 'account man'
  return `Only this bid's ${estimatorWords} or its ${accountManWords} can archive it. A dev can too. To archive it yourself, set yourself as its Estimator or Account Man first, or ask one of them.`
}
