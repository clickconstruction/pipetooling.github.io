/**
 * GC mode design spike: the counts (the lead's go, 2026-10-06; `to-dos/gc-mode/mockups/counts.md`).
 * The schedule's reasons on the board row, Follow up and Needs you, each from its own kernel's read.
 *
 * - A company's move becomes a reason under that company (`scheduleReasons`): the board row's pill,
 *   Follow up's badge and rows, and Needs you's names count it. One call covers every reason, so a
 *   company counts once, however many bars.
 * - Our move becomes a line on the ring's card and one Needs you line for every job
 *   (`ourScheduleMoves`, `gcScheduleMovesNeedsYou`). It stays out of the people count.
 *
 * The first part is lifted out of the call list (G-115) as it was, so the counts and By company say
 * the same words: new dates told and not answered (G-113), a first day nobody confirmed (G-114),
 * and a short crew that alone moves the finish (G-57). The call list calls these.
 *
 * Its own file, out of the barrel. Nothing imported here is read when the module loads: the people
 * kernel reaches it through an import loop that works only at call time.
 */
// What moved to main (the real build) is re-exported from there, so there is one copy.
export type { GcScheduleMovesNeedsYou, OurMove, ScheduleCode } from '../gc/schedule/counts'
export { boardFollowPeople, gcScheduleMovesNeedsYou, ourMoveLines, ourScheduleMoves, pastContract } from '../gc/schedule/counts'

export type { BarCode, BarReason, DatesLine, DatesRef, ScheduleReason } from '../gc/schedule/counts'
export { CALL_LIST_SAYS, CONFIRM_WITHIN_DAYS, REASON_GROUPS, barReasons, crewCalls, gapIsTheirs, reasonGroup, scheduleReasons, unconfirmedDates, unconfirmedStarts, uninsuredReasons } from '../gc/schedule/counts'
