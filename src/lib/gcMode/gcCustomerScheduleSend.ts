/**
 * GC mode design spike: the customer's schedule sent on its own, the Gantt's Phase 3 (G-94). The
 * Friday report carries the schedule's words; a customer who asks "where are we" on a Tuesday gets
 * this: the same picture as their portal, as a dated letter, kept as it went, and printable to a
 * PDF. Nothing leaves the app in the prototype; the record is the letter.
 *
 * Its own file, out of the barrel: it reads the customer's schedule kernel. Since the schedule's PR 15a
 * (v2.5198) the letter is main's too, with its fix for a customer with no contact's name, so the whole
 * file is re-exported from there.
 */
// What moved to main (the real build) is re-exported from there, so there is one copy.
export type { ScheduleLetter } from '../gc/schedule/customerScheduleSend'
export { customerScheduleHtml, customerScheduleLetter, scheduleSendRecord, scheduleSends } from '../gc/schedule/customerScheduleSend'
