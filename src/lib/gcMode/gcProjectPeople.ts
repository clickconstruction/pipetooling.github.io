/**
 * GC mode — design spike: the people we are waiting on for one job (the owner, 2026-10-04:
 * "everything in this column are follow up actions … instead … say number of people to call and
 * then when a user hovers over it they see the details"; mock-up `people-to-call-mockup.html`).
 * Each person once, with every reason under their name: one call covers them all. Trades, the
 * architect and the customer count; our own moves (a draft not sent) do not, the ring lists those.
 */
// What moved to main (the real build) is re-exported from there, so there is one copy.
export { allFollowPeople, allPeople } from '../gc/projectPeople'

export type { PeopleTone, PersonReason, ProjectPeopleSummary, ProjectPerson } from '../gc/projectPeople'
export { customerAsPerson, projectFollowPeople, projectPeople } from '../gc/projectPeople'
