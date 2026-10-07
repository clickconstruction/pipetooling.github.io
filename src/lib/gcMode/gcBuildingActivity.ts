/**
 * GC mode — design spike: what a trade did on the job, for its company's Activity (the owner,
 * 2026-10-04: "add their submittals, punch items and inspections to Activity"). The Board's
 * `partnerActivity` (gcCompanyFile.ts) reads it for the trade we awarded, under *On the job*.
 *
 * Import from `./gcModel`.
 */
// What moved to main (the real build) is re-exported from there, so there is one copy.
export type { BuildingEvent } from '../gc/buildingActivity'
export { buildingActivity } from '../gc/buildingActivity'

