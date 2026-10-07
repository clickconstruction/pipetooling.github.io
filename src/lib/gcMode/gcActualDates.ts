/**
 * GC mode design spike: actual start and finish, the Gantt's Phase 2 (G-55). The planned dates
 * are what the chart draws; the days work really started and finished are kept beside them, set
 * by the walk ("it started Monday") or on the opened activity. A trade's report setting them is
 * the real build's (the owner's call: it moves the golden walk's snapshots). The pair is what a
 * trade's record and a time extension ask are read from later.
 *
 * Its own file, out of the barrel.
 */
// What moved to main (the real build) is re-exported from there, so there is one copy.
export { actualProblem, actualWords, withReportedActuals } from '../gc/schedule/actualDates'

