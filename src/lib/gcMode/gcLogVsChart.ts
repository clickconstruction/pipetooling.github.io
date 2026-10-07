/**
 * GC mode design spike: the daily log and the chart disagree, the Gantt's Phase 4 (G-60; the
 * mock-up and plan are `to-dos/gc-mode/mockups/G-60.md`). The log says who was on site each day,
 * by trade; the chart says whose work runs. This week, on the days with a log, they can tell two
 * different stories:
 *
 * - **On site, no bar**: a trade's crew is on site on a day none of its bars runs. One day is
 *   enough: a crew on site is a fact. Most often a bar started early, or the trade came back.
 * - **Not on site**: a trade's bars that are not done run on LOG_ABSENT_DAYS or more logged
 *   weekdays, and its crew is on none of them. A day the log says the weather stopped the site,
 *   the job or that trade does not count (G-58's weather), and a held bar is explained by its hold.
 *
 * It reads the week the way the walk does (`onSiteWords`: Monday to today), so a row here and the
 * walk's fact for the same bar name the same days. Our own crew counts like any trade; inspections
 * and added activities have no crew in the log, so they never do.
 *
 * Its own file, out of the barrel: it reads the daily log, the schedule and the chart's holds.
 */
// What moved to main (the real build) is re-exported from there, so there is one copy.
export type { LogChartBar, LogChartGap, LogChartKind } from '../gc/schedule/logVsChart'
export { LOG_ABSENT_DAYS, logChartGaps, logChartNotes, runsOn } from '../gc/schedule/logVsChart'

