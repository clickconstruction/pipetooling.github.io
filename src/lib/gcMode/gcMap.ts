/**
 * GC mode — design spike. The map: towns, the drive, and the list of companies beside it.
 * Split out of gcModel.ts verbatim; import from `./gcModel`, which re-exports every file.
 */
// What moved to main (the real build) is re-exported from there, so there is one copy.
export type { LineupRow, Travel } from '../gc/map'
export { TOWNS, driveMiles, milesBetween, nextToAsk, townFromAddress, tradeLineup, travelFor, travelWords } from '../gc/map'

