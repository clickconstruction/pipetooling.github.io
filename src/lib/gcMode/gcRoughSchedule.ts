/**
 * GC mode design spike: a rough schedule while we bid, the Gantt's G-45 (mock-up and plan
 * `to-dos/gc-mode/mockups/G-45.md`). A customer comparing bids asks how much and how long, and Our
 * number answered only the first. The rough is drawn by the first draft's own kernel
 * (`scheduleDraft`) from the trades' scope lines, with this job's stage lengths, so the bid's weeks
 * to build come from a chart, not a guess.
 *
 * It is kept on the job as the record of the weeks we bid and never copied into the schedule: once
 * we win, each trade's statement of work brings the lines its bars must be on, and the first draft
 * starts from the rough's start day and stage lengths. Nothing here reaches the trades or the
 * customer, whose views read `GcProject.schedule` only.
 *
 * One count (`roughWeeks`), worked out on the draw while we bid and kept as it went when the bid
 * goes in, so the record cannot drift from the proposal. Its own file, out of the barrel.
 */
// What moved to main (the real build) is re-exported from there, so there is one copy.
export type { RoughStageRow, RoughWeeks } from '../gc/schedule/rough'
export { bidSentWeeksWords, drawWeeks, firstDraftAgainstBid, keepRough, proposalWeeksWords, roughDraw, roughDrawnWords, roughFirstDraftWords, roughStages, roughWeeks, roughWeeksWords } from '../gc/schedule/rough'

