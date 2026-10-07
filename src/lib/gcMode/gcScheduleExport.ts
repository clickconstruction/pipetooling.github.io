/**
 * GC mode design spike: the schedule as a file, the Gantt's G-136 (mock-up and plan
 * `to-dos/gc-mode/mockups/G-136.md`). A customer who keeps a master schedule of their own in
 * Microsoft Project or Primavera P6 asks for ours in it; an owner asks for it in Excel. Two files
 * from one set of rows (`scheduleExport`): a spreadsheet (`scheduleCsv`) and the project file both
 * programs read (`scheduleMspdi`, the common part of Microsoft Project's XML schema, MSPDI).
 *
 * A file is the logic of the job, so it is always the whole schedule: the chart's filters and folds
 * never reach it, since a bar left out would cut the waits the rest hang on. It reads the chart's
 * bars, which read `project.schedule`, so the rough (G-45, `project.rough`) and a what-if copy never
 * reach a file. The customer's copies read `customerSchedulePicture` and nothing else: what a
 * customer may see is decided in `gcCustomerSchedule.ts`, once, for the portal, the letter, the
 * paper and the files.
 *
 * Every day is a working day (the owner's 365-day rule), so the project file carries one calendar
 * with seven working days and a bar of 12 days is 12 days in both programs. Both programs place a
 * task as early as its waits allow, so each task starts no earlier than its day in our plan
 * (`ConstraintType` 4): the programs draw our dates, and only work held past its start by what it
 * waits on moves, which is the hold the chart shows.
 *
 * Its own file, out of the barrel: it reads the Gantt's kernel, the print's words and the
 * customer's schedule.
 */
// What moved to main (the real build) is re-exported from there, so there is one copy.
export type { ExportCopy, ExportKind, ExportRow, GanttExportInput, ScheduleExport } from '../gc/schedule/export'
export { CSV_COLUMNS, EXPORT_DATES_CUSTOMER, EXPORT_DATES_TEAM, EXPORT_STAGES_GROUP, EXPORT_WAITS_GROUP, MSPDI_NAMESPACE, MSPDI_TEXT1, MSPDI_TEXT2, csvColumns, csvHeads, exportFileName, isMilestoneRow, isWaitRow, scheduleCsv, scheduleExport, scheduleMspdi } from '../gc/schedule/export'

