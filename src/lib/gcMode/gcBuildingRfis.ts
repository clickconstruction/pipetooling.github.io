/**
 * GC mode — design spike: questions about the plans while we build (RFIs). The owner, 2026-10-05,
 * on the Building lane's mock-up: its own tab, trades ask from their portal, the answer is needed 3
 * days before the work it holds, and an answer that costs money starts a change order in one click.
 *
 * A question comes from our superintendent or a trade. It is ours to send to the architect or to
 * answer ourselves; then it is with the architect; then it is answered. It holds the work it is
 * about until then. Bidding questions stay on Plans (`gcPlans.ts`); these start once the job is ours.
 *
 * Import from `./gcModel`.
 */
// What moved to main (the real build) is re-exported from there, so there is one copy.
export type { RfiRow, RfiState } from '../gc/buildingRfis'
export { RFI_NEEDED_DAYS, portalCanAskRfi, portalRfis, rfiAnsweredWords, rfiChangeOrderDescription, rfiCounts, rfiDefaultHolds, rfiHolds, rfiImpactWords, rfiLabel, rfiNeededBy, rfiRows, rfiState } from '../gc/buildingRfis'

