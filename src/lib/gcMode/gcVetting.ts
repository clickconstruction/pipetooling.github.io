/**
 * GC mode — design spike: vetting a company we do not know (the owner, 2026-10-04, question 3).
 * Anyone can quote; award stays locked until the office approves them, or approves them up to a
 * dollar limit. A company with no vetting record is one we know: approved, no limit.
 */
// What moved to main (the real build) is re-exported from there, so there is one copy.
export { awardGate, canAward, ourTeam, partnersToVet, vettingOf, vettingWords } from '../gc/vetting'

