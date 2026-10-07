/**
 * GC mode design spike: their dates to meet only, onto a running job, the Gantt's G-145 (mock-up
 * `to-dos/gc-mode/mockups/G-145.md`). A customer or the architect hands us a file mid-job with new
 * dates to meet. G-137 brings a whole schedule only before Start; this reads the same two files
 * through its reader and takes only their dates. Each is set beside ours with the difference in
 * days, ticked by the office, and written as the job's dates to meet. Nothing else on the schedule
 * moves and nothing is sent. The contract's finish changes only on its own tick, and the days signed
 * change orders added to it are read as part of their day, so nothing counts them twice.
 *
 * Its own file, out of the barrel: the reducer and the Schedule tab's window read it.
 */
// What moved to main (the real build) is re-exported from there, so there is one copy.
export type { TheirDate, TheirDateRow, TheirDates } from '../gc/schedule/theirDates'
export { changeOrderWords, contractWords, differenceWords, rowNotes, theirDates, theirDatesLogWords, theirDatesRefusal, withTheirDates } from '../gc/schedule/theirDates'

