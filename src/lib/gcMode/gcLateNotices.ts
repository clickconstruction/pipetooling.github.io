/**
 * GC mode design spike: a trade tells us it will be late, the Gantt's Phase 3 (G-117; mock-up
 * `to-dos/gc-mode/mockups/G-117.md`). From its own chart in its portal, a company sends the day it
 * will finish (or start, for work not started) and why, while the day is still ahead. The office
 * reads it as a move to take or push back on: taking it saves an ordinary move that carries the
 * trade's reason and words; pushing back sends the office's words to the portal, and the company
 * answers that it will make the day or sends another.
 *
 * Where a notice stands is read each time from the schedule, never copied: a standing move that
 * carries it, a newer notice, the bar's dates, the office's answer.
 *
 * Its own file, out of the barrel: the reducer, the portal, Follow up and the walk read it.
 */
// What moved to main (the real build) is re-exported from there, so there is one copy. lateNoticeProblem since the
// schedule's PR 14a (#5356, schedule-pr14a.lift.json).
export type { LateDoor, LateNoticeRow, LateNoticeState, LateWaiting, OpenLateNotice } from '../gc/schedule/lateNotices'
export { LATE_REASONS, companyLateNotice, lateAheadWords, lateDayAsked, lateDayChanged, lateDoor, lateKeepLogWords, lateMoveNote, lateNoticeLogWords, lateNoticeMove, lateNoticeMoveWords, lateNoticeProblem, lateNoticeReasons, lateNoticeRows, lateNoticeState, lateNoticeTails, lateNoticesToAnswer, latePushBackLogWords, lateSaysWords, lateTarget, lateWaiting, lateWalkFact, nextLateNoticeId, openLateNotices, portalLateNotice } from '../gc/schedule/lateNotices'
