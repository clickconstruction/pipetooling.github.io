/**
 * GC mode design spike: the late-finish days in the contract, counted against the projected
 * finish, the Gantt's G-98 (`to-dos/gc-mode/GANTT_PLAN.md`, mock-up `to-dos/gc-mode/mockups/G-98.md`).
 * The contract's day and the projected finish were each said in their own place, and nobody put
 * them in one sentence: how many days past the contract, what they cost at the contract's fee,
 * which change orders moved the contract's day and which would, and whose door the late days lie
 * at. The customer reads the same days in their own words, never a company and never the fee.
 *
 * One call: the days come from Owner Billing's `ownerFinishRisk` (the projected finish against
 * substantial completion with signed orders' days), so the Schedule tab, Bill the customer and the
 * customer's sentence move together. Its own file, out of the barrel.
 */
// What moved to main (the real build) is re-exported from there, so there is one copy.
export type { LateFinish, LateFinishOrder } from '../gc/lateFinish'
export { lateFinish } from '../gc/lateFinish'

