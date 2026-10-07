/**
 * GC mode design spike: the baseline, the Gantt's Phase 2 (G-41). Start locks the plan as the
 * baseline every measure reads against. After a signed change order adds days, that plan is no
 * longer the one anyone agreed to, and every bar reads as late against it. A new baseline takes
 * the plan as it stands as the one measured against, and the old one is kept and named, so "what
 * the plan was at Start" is never lost. Who may set one is the owner's call 9; the prototype lets
 * anyone on our team, like a move, and says so.
 *
 * Its own file, out of the barrel: the reducer and the Schedule tab read it.
 */
// What moved to main (the real build) is re-exported from there, so there is one copy.
export { FIRST_BASELINE_NAME, baselineDue, baselineHistory, baselineName, baselineWords, nextBaselineName, withNewBaseline } from '../gc/schedule/baseline'

