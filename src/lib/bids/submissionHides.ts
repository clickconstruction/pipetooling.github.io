import type { BidCountRowSubmissionHide } from './bidPricingEngineTypes'

/**
 * Count-row ids hidden from submission documents for a given price book version.
 * Shared by the Pricing tab (grid/print/CSV), the cover-letter totals, and the
 * submission-followup print code.
 */
export function submissionHiddenIdsForVersion(
  hides: readonly BidCountRowSubmissionHide[],
  versionId: string,
): Set<string> {
  const s = new Set<string>()
  for (const h of hides) {
    if (h.price_book_version_id === versionId) s.add(h.count_row_id)
  }
  return s
}
