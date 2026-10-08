/**
 * GC mode design spike: what holds a bar on the chart, in one place. Moved unchanged out of the
 * Schedule tab (its private `holdsOf`, then G-77's `withNotReady`) for G-118, so the Daily log tab's
 * morning list reads the very holds the chart draws.
 *
 * A submittal not yet approved (owner, 2026-10-04), or a question about the plans not yet answered
 * (the Gantt, G-71); a submittal wins when both hold one line. Then a delivery, a decision, a permit
 * or the utility (G-73 to G-75) where nothing else holds the line. Last, a trade not ready to start
 * (G-77): its papers, read on each bar's start day.
 *
 * Its own file, out of the barrel: it reads the RFIs, the submittals, the waits and the trades' papers.
 */
// What moved to main (the real build) is re-exported from there, so there is one copy.
export { chartHolds } from '../gc/schedule/chartHolds'

