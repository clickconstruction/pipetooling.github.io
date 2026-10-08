/**
 * GC mode design spike: Ask for the days, the Gantt's G-141 (`to-dos/gc-mode/GANTT_PLAN.md`, mock-up
 * `to-dos/gc-mode/mockups/G-141.md`). G-98 says whose door the late days lie at. Asking the customer
 * for them took a change order written by hand, which the form refused for having no cost, and
 * which G-76 would then have pushed onto the bars a second time. Here the ask is drafted from the
 * moves themselves: the days they put on the finish, the moves, and the customer's own words for
 * why. Signed, it moves the contract's day, and the bars stay where they are.
 *
 * The days are every day the customer's moves put on the finish, not only the ones late today. A
 * time extension covers the delay they caused, and a day in hand is ours (the lead, 2026-10-06).
 *
 * Its own file, out of the barrel: G-98's line, the reducer and the change orders read it.
 */
// What moved to main (the real build) is re-exported from there, so there is one copy.
export type { TimeExtensionAsk, TimeExtensionMove } from '../gc/timeExtension'
export { askedMoveIds, isTimeExtension, openAskMoves, timeExtensionAsk, timeExtensionLines, timeExtensionRule } from '../gc/timeExtension'

