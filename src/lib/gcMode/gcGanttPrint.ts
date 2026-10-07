/**
 * GC mode design spike: the chart on paper, the Gantt's G-21 ("print and PDF of the chart as it is
 * filtered, on one or more landscape pages"; the mock-up and plan are
 * `to-dos/gc-mode/mockups/G-21.md`).
 *
 * The paper is a document of its own, drawn from the bars the chart draws, never the screen sent to
 * a printer: the chart scrolls sideways, draws only the rows in view and keeps its facts in hover
 * cards. So the filters, the grouping, the folds and the links carry over, and the paper picks its
 * own scale. Three copies:
 *
 * - **Our team's**: the chart as the person has it, with the companies and the spare days. With
 *   Next 3 weeks on, it is the look-ahead sheet: last week through three weeks out, a day at a time.
 *   With Show people on site on, the strip of people per week prints under the last page's rows (G-144).
 * - **The customer's, as stages** (an owner): their portal's stages, what changed and what we need
 *   from them (call 3).
 * - **The customer's, every bar** (a GC or an owner's rep): every bar by stage, today first, as
 *   their portal's list (call 5). No company, no spare days.
 *
 * The customer's copies draw `customerSchedulePicture` and nothing else: what the customer may see
 * is decided in `gcCustomerSchedule.ts`, once, for the portal, the letter and the paper.
 *
 * Its own file, out of the barrel: it reads the Gantt's kernel and the customer's schedule.
 */
// What moved to main (the real build) is re-exported from there, so there is one copy.
export type { GanttPrint, GanttPrintAxis, GanttPrintColumn, GanttPrintColumnKey, GanttPrintFor, GanttPrintInput, GanttPrintJob, GanttPrintLink, GanttPrintMark, GanttPrintMilestone, GanttPrintRow } from '../gc/schedule/ganttPrint'
export { PRINT_AXIS_H, PRINT_GROUP, PRINT_PAGE, PRINT_PEOPLE, PRINT_ROW, forWords, ganttPrint, ganttPrintHtml, lookAheadWindow, placeMilestones, printAxis, printPages } from '../gc/schedule/ganttPrint'

