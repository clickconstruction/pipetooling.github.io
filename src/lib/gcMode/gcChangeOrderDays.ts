/**
 * GC mode design spike: a signed change order's days on the chart, the Gantt's Phase 4
 * (`to-dos/gc-mode/GANTT_PLAN.md`, G-76). When the customer signs a change order that adds days,
 * the contract's finish moves by itself (`substantialCompletionOn` counts the signed orders). The
 * chart did not: the work the change belongs to sat as drawn, and the two disagreed. Here the days
 * are given a home, the trade's bar running the day it was signed, drawn as a tail on that bar
 * until someone puts them on the schedule, and put there as a move like any other, with the change
 * order as its reason, so the trades are told and the customer's What changed says so.
 *
 * Its own file, out of the barrel: it reads the schedule, the moves and Owner Billing's change orders.
 */
// What moved to main (the real build) is re-exported from there, so there is one copy.
export type { ChangeOrderOnChart } from '../gc/schedule/changeOrderDays'
export { changeOrderMove, changeOrderMoveNote, changeOrderMoveOf, changeOrderTails, changeOrdersOnChart, customerContractDays, whereWorkIs } from '../gc/schedule/changeOrderDays'

