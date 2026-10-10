/**
 * GC mode — design spike: the weekly report to the customer (Building lane, the owner's go-ahead
 * 2026-10-05; mock-up artifact 7rjejsyWCFv523rrii7RCi). Friday afternoon each job being built has
 * a draft drawn from the week's records: the daily logs, the schedule and its finish forecast,
 * inspections, submittals, what held work up, next week's look-ahead and change orders. The office
 * reads it, adds a line and sends it, from me by default. It never goes out on its own. It never
 * names our costs or a trade's price, and names a company only when the office ticks it.
 *
 * Import from `./gcModel`.
 */
// What moved to main (the real build) is re-exported from there, so there is one copy.
export { weeklyReport } from '../gc/buildingWeekly'

export type { WeeklyChoice, WeeklyReport, WeeklySection, WeeklySectionKey } from '../gc/buildingWeekly'
export { WEEKLY_REPORT_DAY, WEEKLY_SECTIONS, latestWeeklyReports, weeklyReportReady, weeklyReportSent, weeklyReportText } from '../gc/buildingWeekly'
