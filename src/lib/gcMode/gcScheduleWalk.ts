/**
 * GC mode design spike: the weekly walk of the schedule, the Gantt's Phase 2
 * (`to-dos/gc-mode/GANTT_PLAN.md`, G-52, G-53, G-59; the owner, 2026-10-05: "build the weekly
 * walk"). A chart is only accurate on the day someone last went through it. The walk lists every
 * bar that should have moved this week, each with what the trade reported and what the daily log
 * shows, and offers the day its pace points to. Each is kept as drawn or moved with an
 * explanation. The walk is recorded, and a schedule nobody has walked in a week says so.
 *
 * Its own file, out of the barrel: it reads the Gantt's bars, the daily log and the moves.
 */
// What moved to main (the real build) is re-exported from there, so there is one copy.
export type { WalkItem, WalkKind, WalkStanding } from '../gc/schedule/walk'
export { WALK_STALE_DAYS, WALK_STARTING_DAYS, paceFinish, walkChanges, walkItems, walkStanding, walkTally } from '../gc/schedule/walk'

