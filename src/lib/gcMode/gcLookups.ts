/**
 * GC mode — design spike. Small lookups many areas read: a plan set's label, the newest set, a company by id.
 * Split out of gcModel.ts verbatim; import from `./gcModel`, which re-exports every file.
 */
// What moved to main (the real build) is re-exported from there, so there is one copy.
export { currentRev, planLabel } from '../gc/lookups'

export { ownBidPriced, partnerById } from '../gc/lookups'
