/** Absolute URL to open this bid on Bids → Submission & Followup (SPA route). */
export function submissionFollowupBidShareUrl(bidId: string): string {
  const base = typeof window !== 'undefined' ? window.location.origin : ''
  return `${base}/bids?bidId=${encodeURIComponent(bidId)}&tab=submission-followup`
}
