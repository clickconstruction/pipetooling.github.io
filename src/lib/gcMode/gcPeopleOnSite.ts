/**
 * GC mode design spike: people on site per week, the Gantt's G-84 (the mock-up and plan are
 * `to-dos/gc-mode/mockups/G-84.md`). The office's chart can show, under its rows, each week's
 * busiest day as the plan has it against the busiest day the daily log has, the gap being the news.
 *
 * - **The plan** counts each trade once on each day one of its bars runs by the plan's own dates
 *   (not G-60's `runsOn`: a late bar not done would otherwise fill every week ahead; the log is what
 *   shows a late bar's crew while it is still there). Each trade's number, in order: its own count
 *   for the week (G-142's `crewCountsNow`, the `told` argument), else the daily log's last count for
 *   it, else ASSUMED_CREW, named on the strip. Our own crew counts like any trade;
 *   inspections and added activities have no crew.
 * - **The log**: each week's busiest logged day, its total of every crew, with how many days were
 *   logged. Days without a log are not guessed.
 *
 * Whole job, whatever the chart filters or folds. Its own file, out of the barrel.
 */
// What moved to main (the real build) is re-exported from there, so there is one copy.
export type { CountFrom, PeopleWeek } from '../gc/schedule/peopleOnSite'
export { ASSUMED_CREW, SHORT_BY, crewNumbers, peopleOnSite } from '../gc/schedule/peopleOnSite'

