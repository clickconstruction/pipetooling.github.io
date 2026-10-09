/**
 * GC mode — design spike: change requests a trade sent from its portal that wait on us (the
 * owner, 2026-10-05, on the Portal lane's "A trade asks for a change"). They are our move, not
 * someone we wait on, so they stay out of Who to call: the dashboard has its own Needs you line,
 * and the job's ring card names each one under what it does not count.
 */
// What moved to main (the real build) is re-exported from there, so there is one copy.
export type { GcChangeRequestsNeedsYou, WaitingChangeRequest } from '../gc/changeRequestsWaiting'
export { CHANGE_REQUEST_LATE_DAYS, changeRequestLine, changeRequestLinesFor, changeRequestsWaiting, gcChangeRequestsNeedsYou } from '../gc/changeRequestsWaiting'

