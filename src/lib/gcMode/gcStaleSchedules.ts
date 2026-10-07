/**
 * GC mode design spike: schedules not walked lately, for the dashboard's Needs you (the Gantt,
 * G-59; the owner's OK 2026-10-06). A chart is only true on the day someone last went through it;
 * a job being built whose schedule nobody has walked in a week is our move, so it has its own
 * line, like change requests, and stays out of the people count.
 *
 * Its own file, out of the barrel: the dashboard's hook reads it through the barrel's store.
 */
// What moved to main (the real build) is re-exported from there, so there is one copy.
export type { GcStaleSchedulesNeedsYou, StaleSchedule } from '../gc/schedule/staleSchedules'
export { WALK_LATE_DAYS, gcStaleSchedulesNeedsYou, staleSchedules } from '../gc/schedule/staleSchedules'

