/**
 * GC mode design spike: a trade's own crew count, from its portal (G-142; mock-up
 * `to-dos/gc-mode/mockups/G-142.md`). Beside its weekly look-ahead marks, a trade says how many
 * people a day it will have on site each coming week, one count a trade the way the daily log counts
 * them. The superintendent's morning list (G-118) reads it beside the log's count, so a short crew,
 * a missing one or a cut count is news; G-84's people-per-week strip reads the same record.
 *
 * One record on the project (`crewCounts`, newest first): the newest for a trade and week is the one
 * that counts, and the ones before it say when a count was cut.
 *
 * Its own file, out of the barrel: the reducer, the portal and the morning list read it.
 */
// What moved to main (the real build) is re-exported from there, so there is one copy. crewCountProblem and
// portalCrewAsks since the schedule's PR 14a (#5356, schedule-pr14a.lift.json).
export type { CrewCountNow, CrewSaid, PortalCrewWeek } from '../gc/schedule/crewCounts'
export { CREW_MAX, crewCountAllowed, crewCountLogWords, crewCountOn, crewCountProblem, crewCountsNow, crewLogWords, crewWeeks, portalCrewAsks } from '../gc/schedule/crewCounts'
