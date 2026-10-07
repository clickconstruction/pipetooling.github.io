/**
 * GC mode design spike: the projected finish with weather and crews, the Gantt's G-57
 * (`to-dos/gc-mode/GANTT_PLAN.md`, mock-up `to-dos/gc-mode/mockups/G-57.md`). The Projected
 * finish measure reads the plan and the pace of the work so far (G-56). This is a second line
 * beside it, never in its place: the same projection with each piece of work left given more days
 * by two plain rules, each named where it is read.
 *
 * - **Weather**: so many days a month on the work of the trades the daily log has seen stopped by
 *   the weather (G-58's reading, never guessed from the trade). The log's own rate once it covers a
 *   month, our rule until then.
 * - **Crews**: a trade's work left goes at its crew now against its crew so far on the log. The crew
 *   now is its own count for the week the work falls in (G-142), else its crew this week: its count
 *   for this week, else, with work under way, its newest day on the log. A trade with all its work
 *   ahead is not here yet, not short. A smaller crew stretches the work left. A bigger one is not
 *   counted on until the work shows it. Nobody this week is said by name, not divided.
 *
 * The days go through `projectedFinish`'s own walk, so what waits on the work moves too, the later
 * of plan and pace still wins, and the line never comes before today's. Nothing moves; nothing
 * reaches the customer.
 *
 * Its own file, out of the barrel: the Schedule tab and the call list read it.
 */
// What moved to main (the real build) is re-exported from there, so there is one copy.
export type { CrewShort, CrewTold, FinishOutlook } from '../gc/schedule/finishOutlook'
export { CREW_NOW_DAYS, LOG_MONTH_DAYS, WEATHER_DAYS_A_MONTH, finishOutlook, shortCrewDetail, shortCrewReason } from '../gc/schedule/finishOutlook'

