/**
 * GC mode — design spike: bill day across every job (owner's go-ahead 2026-10-05). On the bill day
 * each job that is ours sends its pay application; this gathers them: what each asks, when that
 * customer usually pays, and what to know before it goes. The notes warn and never stop, the same
 * as on Bill the customer (owner's call 2026-10-02 on waivers).
 *
 * Import from `./gcModel`.
 */
// What moved to main (the real build) is re-exported from there, so there is one copy.
export type { BillDay, BillDayJob, BillDayNote } from '../gc/ownerBillingDay'
export { billDay } from '../gc/ownerBillingDay'

