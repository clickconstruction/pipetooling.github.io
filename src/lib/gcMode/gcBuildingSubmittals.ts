/**
 * GC mode — design spike: submittals (Building lane, owner 2026-10-04). Each trade sends product
 * data, shop drawings or samples; we look and send them to the architect; the architect approves,
 * approves as noted, or sends them back to revise. A submittal holds the schedule lines it covers
 * until it is approved, and is needed by the first of their starts less its lead days.
 *
 * Import from `./gcModel`.
 */
// What moved to main (the real build) is re-exported from there, so there is one copy.
export type { SubmittalRow, SubmittalState } from '../gc/buildingSubmittals'
export { nextSubmittalId, nextSubmittalNumber, submittalApprovedOn, submittalCounts, submittalHolding, submittalNeededBy, submittalRows, submittalRowsOn, submittalState } from '../gc/buildingSubmittals'

