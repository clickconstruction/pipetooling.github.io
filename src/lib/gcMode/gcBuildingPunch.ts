/**
 * GC mode — design spike: the punch list (Building lane, owner 2026-10-03). Our superintendent
 * walks a trade's work and lists what is left to fix; the trade marks each item fixed in its
 * portal; our superintendent checks it, or sends it back with a note. We accept a trade's work
 * (Closeout) once every item on it is checked fixed. Our own crew's closeout runs on the Pipeline,
 * so the list here is for the trades we hire.
 *
 * Types only, so gcBuilding can read it without a loop. Import from `./gcModel`.
 */
// What moved to main (the real build) is re-exported from there, so there is one copy.
export type { PunchCounts, PunchState } from '../gc/buildingPunch'
export { nextPunchId, punchClear, punchCounts, punchItems, punchState, punchWords } from '../gc/buildingPunch'

