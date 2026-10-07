/**
 * GC mode design spike: days lost, the Gantt's Phase 4 (`to-dos/gc-mode/GANTT_PLAN.md`). Two
 * readings of the same question, where did the time go:
 *
 * - **Weather days from the daily log** (G-58): a log that says work stopped for the weather, or
 *   that a trade was held by it, puts a lost day on every bar that trade had running that day. The
 *   walk shows them on the bar and offers them as the move, with the weather as the reason.
 * - **Days lost by cause** (G-96): the moves' reasons added up across the job, the customer's,
 *   the weather's, ours, a trade's, with what they did to the finish. The numbers a time
 *   extension ask is written from.
 *
 * Its own file, out of the barrel: it reads the daily log, the schedule and the moves.
 */
// What moved to main (the real build) is re-exported from there, so there is one copy.
export type { CauseRow, DaysLost, LostCause, LostDay } from '../gc/schedule/daysLost'
export { CAUSE_OF, CAUSE_WORDS, daysLostByCause, lostDayTitle, lostDaysByLine, lostDaysMoveNote, lostDaysUnanswered, lostDaysWords, weatherLostDays } from '../gc/schedule/daysLost'

