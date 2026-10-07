/**
 * GC mode design spike: the schedule as a Gantt, Phase 1 (the owner, 2026-10-05: "start with phase
 * 1 … make this look great and be very informative"; `to-dos/gc-mode/GANTT_PLAN.md`, features
 * numbered in `GANTT_FEATURES.md`). What the chart draws, worked out here so the screen only draws:
 * the working calendar, each bar's standing, the groups, the filters, the links and the time axis.
 *
 * The calendar is the owner's (2026-10-05): "holidays and weekends do not have to be taken off,
 * anyone can work 365 days a year." So every day is a working day and a bar's length is its
 * calendar days. A weekend and a holiday are only marked on the chart, so a date reads at a glance
 * and nobody is surprised to find work planned on Thanksgiving.
 *
 * Its own file, out of the barrel: it reads the schedule and New Project's stages.
 */
// What moved to main (the real build) is re-exported from there, so there is one copy.
export type { GanttAxis, GanttBar, GanttCompany, GanttFilters, GanttGroup, GanttGroupBy, GanttHold, GanttLink, GanttRowEntry, GanttStatus, GanttZoom } from '../gc/schedule/gantt'
export { BEHIND_POINTS, NO_FILTERS, TIGHT_SPARE_DAYS, ZOOM_PX, ganttAxis, ganttBars, ganttCompanies, ganttCounts, ganttFilter, ganttGroups, ganttLinks, ganttListGroups, ganttNeighbors, holidayOn, holidaysIn, holidaysOf, isWeekend, isWorkingDay, lastFinishDay, linkPath, rowsInView, spareTail, workingDays } from '../gc/schedule/gantt'

