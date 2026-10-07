/**
 * GC mode design spike: an activity that is no trade's line, the Gantt's Phase 2 (G-38): mobilize,
 * cure time, the customer's own work, a punch walk. Until now every bar was a line of a statement of
 * work or an inspection, so a week of concrete cure had nowhere to go but a gap nobody could see.
 * An added activity is the job's own: no dollars, nobody reports it, the office marks it done. It
 * waits on work and work waits on it like any other bar, and it counts on the critical path.
 *
 * Its own file, out of the barrel: the reducer and the Schedule tab read it.
 */
// What moved to main (the real build) is re-exported from there, so there is one copy.
export { ADDED_WHO, addedActivityProblem, addedActivityWords, nextOwnId } from '../gc/schedule/addedActivity'

