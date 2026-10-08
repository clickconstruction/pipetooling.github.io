/**
 * GC mode — design spike. Get started: everything that has to be true before work starts.
 * Split out of gcModel.ts verbatim; import from `./gcModel`, which re-exports every file.
 */
// What moved to main (the real build) is re-exported from there, so there is one copy.
export type { StartCheck, StartChecklist, StartTradeRow } from '../gc/start'
export { startChecklist } from '../gc/start'

