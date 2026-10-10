/**
 * GC mode design spike: telling the trades their dates moved, the Gantt's Phase 3
 * (`to-dos/gc-mode/GANTT_PLAN.md`, G-112, G-113). A move on the schedule changes some companies'
 * days. Each of those companies gets one message naming its old and new days and why, in its own
 * language, and answers from its portal: the dates work, or it needs another day. Nothing leaves
 * the app in the prototype; the message is written and kept.
 *
 * Its own file, out of the barrel: the reducer and the portal read it.
 */
// What moved to main (the real build) is re-exported from there, so there is one copy.
export { datesMessage, datesNotices } from '../gc/schedule/tellTrades'

export type { CompanyToTell, DatesAsk, DatesNotice, MovedLine } from '../gc/schedule/tellTrades'
export { companiesToTell, datesAsksForOffice, datesAsksOpen, moveAnswerWords, movedLines, untoldMoves } from '../gc/schedule/tellTrades'
