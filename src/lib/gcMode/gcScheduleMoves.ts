/**
 * GC mode design spike: moving a bar, the Gantt's Phase 2 (`to-dos/gc-mode/GANTT_PLAN.md`). The
 * owner, 2026-10-05: "anyone on our team may move a bar, when a bar is moved an explanation should
 * be given and recorded with that saved somewhere." So a move is planned first (what it pushes,
 * what it does to the finish), saved only with a reason and their own words, kept on the schedule
 * for good, and the last one can be undone.
 *
 * Its own file, out of the barrel: the reducer reads it, and it reads the schedule.
 */
// What moved to main (the real build) is re-exported from there, so there is one copy.
export type { MoveLimits, MovePlan, MoveRow } from '../gc/schedule/moves'
export { MOVE_NOTE_MIN, MOVE_REASONS, moveActivityName, moveReasonLabel, moveRecord, moveRows, moveWhyProblem, planMove, redoMove, redoableMove, scheduleFinish, spanWords, undoMove, undoableMove, whatIfSlips } from '../gc/schedule/moves'

