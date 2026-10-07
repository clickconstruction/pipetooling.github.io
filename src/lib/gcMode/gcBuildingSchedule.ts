/**
 * GC mode — design spike: the schedule (Building lane). The owner's shape (2026-10-02): several
 * activities per trade, which are the lines of its statement of work (or the stages our own crew
 * runs); we draw the dates and what waits on what; Start locks it as the baseline. Four measures
 * are read in Building: work done against the plan, spare days (the critical path), milestones hit
 * within a few days, and how often the look-ahead's activities get done as planned.
 *
 * An inspection is an activity of its own (owner, 2026-10-03): the job's, not a trade's line, with
 * no dollars. It counts on the critical path, not in work done against the plan.
 *
 * Days are calendar days in the prototype. Import from `./gcModel`, which re-exports this file.
 */
// What moved to main (the real build) is re-exported from there, so there is one copy.
export type { LookAheadState, LookAheadWeek, MilestoneRow, MilestoneState, OpenFailure, ProjectedFinish, PushedAfter, ScheduleItem, ScheduleRow, ScheduleSummary, VerifyItem } from '../gc/schedule/schedule'
export { ADDED_TRADE, INSPECTION_COMPANY, INSPECTION_TRADE, LOOKAHEAD_WEEKS, MILESTONE_GRACE_DAYS, RELIABILITY_WEEKS, activityName, daysBetween, draftSchedule, inspectedTrades, inspectionItems, isSubstantial, lagOf, lookAheadReliability, lookAheadWeeks, markReason, markState, milestoneHitRate, milestoneRows, mondayOf, openInspectionFailures, plannedPct, projectedFinish, pushAfter, pushedAfterWords, scheduleFloat, scheduleItems, scheduleLinesOf, scheduleMeasures, scheduleRows, scheduleSummary, scheduleSummaryWords, substantialCompletionOn, verifyList, withBaselineKept, workVsPlan, wouldLoop } from '../gc/schedule/schedule'

