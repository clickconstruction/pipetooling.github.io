export type SubmissionSectionKey = 'unsent' | 'pending' | 'won' | 'startedOrComplete' | 'lost'

/** Minimal bid shape needed to classify a bid into a section (satisfied by BidWithBuilder). */
export type SubmissionSectionSource = {
  outcome: string | null
  bid_date_sent: string | null
}

/**
 * Classify a bid into one of the submission/followup sections.
 * Shared by the Submission & Followup tab, the Bid Board bucketing,
 * and the Customer review modal kernel.
 */
export function getSubmissionSectionKey(bid: SubmissionSectionSource): SubmissionSectionKey | null {
  if (bid.outcome === 'won') return 'won'
  if (bid.outcome === 'started_or_complete') return 'startedOrComplete'
  if (bid.outcome === 'lost') return 'lost'
  if (!bid.bid_date_sent) return 'unsent'
  return 'pending'
}
