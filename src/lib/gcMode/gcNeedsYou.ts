/**
 * GC mode — design spike: GC Follow up on the dashboard's Needs you list (the owner, 2026-10-04).
 * One item, like the dashboard's others: how many people we are waiting on, the first few by name
 * and why, and red when anyone is late. The count is Follow up's badge and the board rows' sum
 * ("make them match"): allPeople, each person once across every job.
 */
// What moved to main (the real build) is re-exported from there, so there is one copy.
export type { GcNeedsYou } from '../gc/needsYou'
export { gcNeedsYou, phraseFor } from '../gc/needsYou'

