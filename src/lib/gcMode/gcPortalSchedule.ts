/**
 * GC mode design spike: a company's own chart in its portal, the Gantt's Phase 3 (G-110). Its
 * bars on a job, the work its bars wait on, and the work waiting on its bars: dates and percent,
 * other companies by the name of the work, never a price.
 *
 * Its own file, out of the barrel: the portal reads it.
 */
// What moved to main (the real build) is re-exported from there, so there is one copy.
export type { PortalSchedule, PortalScheduleBar } from '../gc/schedule/portalSchedule'
export { portalSchedule, portalScheduleX } from '../gc/schedule/portalSchedule'

