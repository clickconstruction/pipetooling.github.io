import type { BidWithBuilder } from '../../types/bidWithBuilder'

export type SubmissionSectionKey = 'unsent' | 'pending' | 'won' | 'startedOrComplete' | 'lost'

/**
 * Classify a bid into one of the submission/followup sections.
 * Shared by the Submission & Followup tab and the Bid Board bucketing.
 */
export function getSubmissionSectionKey(bid: BidWithBuilder): SubmissionSectionKey | null {
  if (bid.outcome === 'won') return 'won'
  if (bid.outcome === 'started_or_complete') return 'startedOrComplete'
  if (bid.outcome === 'lost') return 'lost'
  if (!bid.bid_date_sent) return 'unsent'
  return 'pending'
}
