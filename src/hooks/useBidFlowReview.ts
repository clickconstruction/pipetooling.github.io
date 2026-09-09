import { useCallback, useMemo } from 'react'
import { useMarkBidReviewed } from './useMarkBidReviewed'
import { useUserDisplayNames } from './useUserDisplayNames'
import { bidReviewFields, reviewStampLabel, reviewStampTooltip } from '../lib/bids/bidReview'
import { formatShortDate } from '../lib/bids/bidFormatting'

/**
 * What a flow-strip host needs for the Review step: the Mark reviewed action
 * and the stamp caption/tooltip for each bid it shows (reviewer names resolved
 * once per id set). Works before the migration too — `stampFor` returns null
 * when the row has no review columns.
 */
export function useBidFlowReview(bids: ReadonlyArray<object>): {
  markReviewed: (bid: { id: string; project_name: string | null }) => Promise<boolean>
  stampFor: (bid: object) => { label: string | null; tooltip: string | null } | null
} {
  const markReviewed = useMarkBidReviewed()
  const reviewerIds = useMemo(() => bids.map((b) => bidReviewFields(b)?.reviewed_by ?? null), [bids])
  const names = useUserDisplayNames(reviewerIds)
  const stampFor = useCallback(
    (bid: object) => {
      const f = bidReviewFields(bid)
      if (!f?.reviewed_at) return null
      const reviewerName = f.reviewed_by ? (names[f.reviewed_by] ?? null) : null
      return {
        label: reviewStampLabel({ reviewed_at: f.reviewed_at, reviewerName }, formatShortDate),
        tooltip: reviewStampTooltip({ reviewed_at: f.reviewed_at, reviewerName, review_note: f.review_note }, formatShortDate),
      }
    },
    [names],
  )
  return { markReviewed, stampFor }
}
