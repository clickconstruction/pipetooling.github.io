/**
 * GC mode design spike: the superintendent's morning list, the Gantt's Phase 4 (G-118; the mock-up
 * and plan are `to-dos/gc-mode/mockups/G-118.md`). The chart read for one day: every company with
 * work running, what it is doing and where that stands, who the daily log last had on site, and the
 * day's inspections and arrivals. Once the day's log is written, a company it does not have goes
 * first, in red: the call to make.
 *
 * No trade reports a crew count, so the count is the log's own, said as the log's. A bar runs on a
 * day by G-60's rule (`runsOn`), and its holds are the chart's (`chartHolds`), so the list never
 * argues with the chart.
 *
 * Its own file, out of the barrel: it reads the schedule, the chart's holds, the waits, G-117's late
 * notices and the daily log.
 */
// What moved to main (the real build) is re-exported from there, so there is one copy.
export type { MorningBar, MorningCompany, MorningList } from '../gc/schedule/morningList'
export { morningList, morningSteps } from '../gc/schedule/morningList'

