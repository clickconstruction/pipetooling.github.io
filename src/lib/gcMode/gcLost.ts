/**
 * GC mode — design spike. A bid we lost (the owner, 2026-10-03: a way out of Bidding for a job the
 * owner gave to someone else). The project keeps its stage ('pursuing') and leaves Bidding for the
 * board's Lost section once `lostOn` is set; nobody is chased on it. The reasons are Trades mode's
 * loss reasons (`bidLossCategories.ts`) in the words that fit us bidding to an owner.
 */
// What moved to main (the real build) is re-exported from there, so there is one copy.
export { LOST_WHY, isLost, lostWhyLabel, lostWords } from '../gc/lost'

